// --- PostgREST API Provider ---
// Interacts with a PostgREST endpoint which exposes a PostgreSQL database.
import JSZip from 'jszip';
import { FORMAT_VERSION } from './exportFormat';
import {
    getMimeTypeFromFilename,
    readFileAsBase64,
    base64ToBlob,
    createCSV,
    parseCSV
} from './providerUtils';

// Helper to generate headers, extracting token from settings
const defaultHeaders = (settings, preferRepresentation = true) => {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    // Crucial for getting created/updated records back from POST/PATCH
    if (preferRepresentation) {
        headers['Prefer'] = 'return=representation';
    }
    // Access the token via the settings object using the key defined in the registry
    if (settings?.postgrestApiToken) {
        headers['Authorization'] = `Bearer ${settings.postgrestApiToken}`;
    }
    return headers;
};

// handleResponse updated for PostgREST error format
const handleResponse = async (res, operation, entityDescription) => {
    if (!res.ok) {
        let errorText = `Status ${res.status}`;
        let errorDetails = '';
        try {
            const errorJson = await res.json();
            // Extract message, details, hint from PostgREST error response
            errorText = errorJson.message || errorText;
            errorDetails = errorJson.details ? ` Details: ${errorJson.details}` : '';
            if (errorJson.hint) errorDetails += ` Hint: ${errorJson.hint}`;
            if (errorJson.code) errorDetails += ` Code: ${errorJson.code}`;
        } catch (e) {
            // If response is not JSON, use the raw text
            errorText = await res.text() || errorText;
        }
        const fullError = `Failed to ${operation} ${entityDescription}: ${errorText}${errorDetails}`;
        console.error(fullError, res);
        throw new Error(fullError);
    }
    // For successful POST/PATCH with Prefer: return=representation, response body contains the data
    // For successful GET, response body contains the data
    // For successful DELETE or PATCH without representation, body might be empty
    if (res.status === 204) {
        return { success: true, status: res.status, data: null };
    }
    try {
        const responseData = await res.json();
        return { success: true, status: res.status, data: responseData };
    } catch (e) {
        // Handle cases where response is OK but not JSON (shouldn't happen with Accept header)
        console.warn(`Could not parse JSON response for ${operation} ${entityDescription}, status ${res.status}`);
        return { success: true, status: res.status, data: null };
    }
};

// --- Exported API Methods (Bound by ApiContext) ---
// These are the functions listed in the providerRegistry 'methods' array.
// They receive the 'settings' object as the first argument from ApiContext.

// --- Locations ---
export const listLocations = async (settings) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    const queryUrl = `${baseUrl}/locations?order=created_at.desc`; // Selects * by default, including uuid
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: defaultHeaders(settings, false) // No representation needed for GET list
    });

    const result = await handleResponse(res, 'list', 'locations');
    console.log("Fetched locations:", result.data);
    return result.data || []; // PostgREST returns an array directly
};

export const addLocation = async (settings, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    // PG handles uuid generation by default, but include if provided (e.g., during import)
    const locationData = { ...data, uuid: data.uuid || undefined, updated_at: null }; // PG trigger handles created_at

    const res = await fetch(`${baseUrl}/locations`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Request representation
        body: JSON.stringify(locationData),
    });

    const result = await handleResponse(res, 'add', 'location');
    // Response is an array with the new object: [{ "location_id": 123, ... }]
    if (!result.data || result.data.length === 0 || !result.data[0].location_id || !result.data[0].uuid) {
        console.error("Could not find location_id in PostgREST response:", result.data);
        throw new Error("Failed to retrieve location_id after insert.");
    }
    const newLocationId = result.data[0].location_id;
    const newUuid = result.data[0].uuid;
    console.log("Retrieved new location ID:", newLocationId, "UUID:", newUuid);
    return { success: true, newId: newLocationId, uuid: newUuid };
};

export const updateLocation = async (settings, locationId, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for update.");

    const updateUrl = `${baseUrl}/locations?location_id=eq.${locationId}`;
    // PG trigger handles updated_at
    const { uuid, ...payload } = data; // Exclude uuid from update payload

    const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: defaultHeaders(settings, false), // Representation not strictly needed, trigger handles timestamp
        body: JSON.stringify(payload),
    });

    await handleResponse(res, 'update', `location ID ${locationId}`);
    return { success: true };
};

export const deleteLocation = async (settings, locationId) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for deletion.");

    // Constraint Check: Check if any items use this location
    const checkUrl = `${baseUrl}/items?location_id=eq.${locationId}&select=item_id&limit=1`;
    const checkRes = await fetch(checkUrl, { method: 'GET', headers: defaultHeaders(settings, false) });
    const checkResult = await handleResponse(checkRes, 'check usage for', `location ID ${locationId}`);
    if (checkResult.data && checkResult.data.length > 0) {
        console.warn(`Attempted to delete location ${locationId} which is in use.`);
        return { success: false, message: 'Cannot delete location: It is currently assigned to one or more items.' };
    }

    // Proceed with deletion
    const deleteUrl = `${baseUrl}/locations?location_id=eq.${locationId}`;
    const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: defaultHeaders(settings, false),
    });

    await handleResponse(res, 'delete', `location ID ${locationId}`);
    return { success: true };
};

// --- Categories (Mirror Locations structure) ---
export const listCategories = async (settings) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    const queryUrl = `${baseUrl}/categories?order=created_at.desc`; // Selects * including uuid
    const res = await fetch(queryUrl, { method: 'GET', headers: defaultHeaders(settings, false) });
    const result = await handleResponse(res, 'list', 'categories');
    console.log("Fetched categories:", result.data);
    return result.data || [];
};

export const addCategory = async (settings, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    const categoryData = { ...data, uuid: data.uuid || undefined, updated_at: null };
    const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(categoryData),
    });
    const result = await handleResponse(res, 'add', 'category');
    if (!result.data || result.data.length === 0 || !result.data[0].category_id || !result.data[0].uuid) {
        console.error("Could not find category_id in PostgREST response:", result.data);
        throw new Error("Failed to retrieve category_id after insert.");
    }
    const newCategoryId = result.data[0].category_id;
    const newUuid = result.data[0].uuid;
    console.log("Retrieved new category ID:", newCategoryId, "UUID:", newUuid);
    return { success: true, newId: newCategoryId, uuid: newUuid };
};

export const updateCategory = async (settings, categoryId, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for update.");
    const updateUrl = `${baseUrl}/categories?category_id=eq.${categoryId}`;
    const { uuid, ...payload } = data; // Exclude uuid
    const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: defaultHeaders(settings, false),
        body: JSON.stringify(payload),
    });
    await handleResponse(res, 'update', `category ID ${categoryId}`);
    return { success: true };
};

export const deleteCategory = async (settings, categoryId) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for deletion.");

    // Constraint Check
    const checkUrl = `${baseUrl}/items?category_id=eq.${categoryId}&select=item_id&limit=1`;
    const checkRes = await fetch(checkUrl, { method: 'GET', headers: defaultHeaders(settings, false) });
    const checkResult = await handleResponse(checkRes, 'check usage for', `category ID ${categoryId}`);
    if (checkResult.data && checkResult.data.length > 0) {
        console.warn(`Attempted to delete category ${categoryId} which is in use.`);
        return { success: false, message: 'Cannot delete category: It is currently assigned to one or more items.' };
    }

    const deleteUrl = `${baseUrl}/categories?category_id=eq.${categoryId}`;
    const res = await fetch(deleteUrl, { method: 'DELETE', headers: defaultHeaders(settings, false) });
    await handleResponse(res, 'delete', `category ID ${categoryId}`);
    return { success: true };
};

// --- Owners (Mirror Locations structure) ---
export const listOwners = async (settings) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    const queryUrl = `${baseUrl}/owners?order=created_at.desc`; // Selects * including uuid
    const res = await fetch(queryUrl, { method: 'GET', headers: defaultHeaders(settings, false) });
    const result = await handleResponse(res, 'list', 'owners');
    console.log("Fetched owners:", result.data);
    return result.data || [];
};

export const addOwner = async (settings, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    const ownerData = { ...data, uuid: data.uuid || undefined, updated_at: null };
    const res = await fetch(`${baseUrl}/owners`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(ownerData),
    });
    const result = await handleResponse(res, 'add', 'owner');
    if (!result.data || result.data.length === 0 || !result.data[0].owner_id || !result.data[0].uuid) {
        console.error("Could not find owner_id in PostgREST response:", result.data);
        throw new Error("Failed to retrieve owner_id after insert.");
    }
    const newOwnerId = result.data[0].owner_id;
    const newUuid = result.data[0].uuid;
    console.log("Retrieved new owner ID:", newOwnerId, "UUID:", newUuid);
    return { success: true, newId: newOwnerId, uuid: newUuid };
};

export const updateOwner = async (settings, ownerId, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for update.");
    const updateUrl = `${baseUrl}/owners?owner_id=eq.${ownerId}`;
    const { uuid, ...payload } = data; // Exclude uuid
    const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: defaultHeaders(settings, false),
        body: JSON.stringify(payload),
    });
    await handleResponse(res, 'update', `owner ID ${ownerId}`);
    return { success: true };
};

export const deleteOwner = async (settings, ownerId) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for deletion.");

    // Constraint Check
    const checkUrl = `${baseUrl}/items?owner_id=eq.${ownerId}&select=item_id&limit=1`;
    const checkRes = await fetch(checkUrl, { method: 'GET', headers: defaultHeaders(settings, false) });
    const checkResult = await handleResponse(checkRes, 'check usage for', `owner ID ${ownerId}`);
    if (checkResult.data && checkResult.data.length > 0) {
        console.warn(`Attempted to delete owner ${ownerId} which is in use.`);
        return { success: false, message: 'Cannot delete owner: They are currently assigned to one or more items.' };
    }

    const deleteUrl = `${baseUrl}/owners?owner_id=eq.${ownerId}`;
    const res = await fetch(deleteUrl, { method: 'DELETE', headers: defaultHeaders(settings, false) });
    await handleResponse(res, 'delete', `owner ID ${ownerId}`);
    return { success: true };
};

// --- Image Handling ---

/**
 * Internal: Inserts image data and filename, returns the new ID and UUID.
 * Sends base64 data as a string in the JSON payload.
 * Accepts an optional UUID for import scenarios.
 */
const _insertImage = async (settings, base64Data, mimeType, filename, imageUuid = undefined) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    const imageData = {
        uuid: imageUuid || undefined, // Use provided UUID or let PG generate
        // PG trigger handles created_at
        image_data: base64Data, // Store base64 string directly (will go into TEXT column)
        image_mimetype: mimeType,
        image_filename: filename || 'image', // Store filename, provide default
    };

    const res = await fetch(`${baseUrl}/images`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Request representation
        body: JSON.stringify(imageData),
    });
    const result = await handleResponse(res, 'insert', 'image');
    if (!result.data || result.data.length === 0 || !result.data[0].image_id || !result.data[0].uuid) {
        console.error("Could not find image_id in PostgREST response:", result.data);
        throw new Error("Failed to retrieve image_id after insert.");
    }
    return { imageId: result.data[0].image_id, imageUuid: result.data[0].uuid }; // Return both ID and UUID
};

/**
 * Internal: Updates image data and filename for an existing image ID using PATCH.
 * Sends base64 data as a string in the JSON payload.
 */
const _updateImage = async (settings, imageId, base64Data, mimeType, filename) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    const updateUrl = `${baseUrl}/images?image_id=eq.${imageId}`;
    const payload = { // uuid is NOT updated
        image_data: base64Data, // Send base64 string directly (will update TEXT column)
        image_mimetype: mimeType,
        image_filename: filename || 'image', // Update filename too
    };
    const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: defaultHeaders(settings, false), // No representation needed
        body: JSON.stringify(payload)
    });
    return handleResponse(res, 'update', `image ID ${imageId}`);
};

/**
 * Internal: Deletes an image record by ID.
 */
const _deleteImage = async (settings, imageId) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!imageId) {
        console.warn("_deleteImage called with null/undefined imageId");
        return { success: true }; // Nothing to delete
    }

    const deleteUrl = `${baseUrl}/images?image_id=eq.${imageId}`;
    const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: defaultHeaders(settings, false)
    });
    // Ignore 404 errors if image was already deleted somehow
    if (!res.ok && res.status !== 404) {
        return handleResponse(res, 'delete', `image ID ${imageId}`);
    }
    console.log(`Deleted or confirmed deletion of image ID ${imageId}`);
    return { success: true };
};

// --- Items ---

/**
 * Adds a single item record with basic details.
 * Expects data like { name, description, location_id, category_id, owner_id }
 * and optionally `imageFile` (a File object).
 * Can also accept `uuid` and `image_uuid` if importing. */
export const addItem = async (settings, data) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required.");
    }

    let imageId = null;
    let imageUuid = null; // Store image UUID separately
    if (data.imageFile instanceof File) { // Ensure it's a File object
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            // Pass image_uuid if provided (e.g., during import)
            const imageResult = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name, data.image_uuid);
            imageId = imageResult.imageId;
            imageUuid = imageResult.imageUuid; // This will be the UUID used (either provided or PG-generated)
        } catch (error) {
            console.error("Failed to process or insert image:", error);
            throw new Error(`Failed to handle image upload: ${error.message}`);
        }
    }
    const newItemUuid = data.uuid || undefined; // Use provided UUID or let PG generate
    // Prepare the row data, ensuring description is null if empty
    const itemRowData = {
        name: data.name,
        description: data.description || null,
        location_id: data.location_id,
        category_id: data.category_id,
        owner_id: data.owner_id,
        uuid: newItemUuid, // Add item UUID (or undefined for PG default)
        image_id: imageId, // Use the inserted image ID or null
        image_uuid: imageUuid, // Use the inserted image UUID or null
        updated_at: null // Explicitly set updated_at to null on creation
        // PG trigger handles created_at
    };

    const res = await fetch(`${baseUrl}/items`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Request representation
        body: JSON.stringify(itemRowData),
    });

    const result = await handleResponse(res, 'add', 'item');
    if (!result.data || result.data.length === 0 || !result.data[0].item_id || !result.data[0].uuid) {
        console.error("Could not find item_id in PostgREST response:", result.data);
        // Don't throw error here, as the operation might have succeeded, just log
    } else {
        console.log("Added item with ID:", result.data[0].item_id, "UUID:", result.data[0].uuid);
        // Optionally return the generated UUID if needed: return { success: true, status: result.status, uuid: result.data[0].uuid };
    }
    return { success: true, status: result.status };
};


/**
 * Updates an item's details, including potentially the image.
 * Expects itemId and data like { name, description, location_id, category_id, owner_id, imageFile?, removeImage? }
 */
export const updateItem = async (settings, itemId, data) => { // data should NOT contain uuid
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for update.");
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required for update.");
    }

    // Fetch current item data to get existing image_id and image_uuid
    const currentItemUrl = `${baseUrl}/items?item_id=eq.${itemId}&select=image_id,image_uuid`; // Fetch image_uuid too
    const currentItemRes = await fetch(currentItemUrl, { headers: defaultHeaders(settings, false) });
    // Handle case where item might have been deleted between listing and updating
    if (!currentItemRes.ok && currentItemRes.status !== 404) {
        await handleResponse(currentItemRes, 'fetch current item data for update', `item ID ${itemId}`);
    }
    const currentItemData = currentItemRes.ok ? await currentItemRes.json() : [];
    const existingImageId = currentItemData[0]?.image_id; // PostgREST returns array
    let existingImageUuid = currentItemData[0]?.image_uuid;

    let newImageId = existingImageId; // Assume image doesn't change initially
    let newImageUuid = existingImageUuid; // Assume image UUID doesn't change

    if (data.removeImage && existingImageId) {
        await _deleteImage(settings, existingImageId);
        newImageId = null;
        newImageUuid = null; // Clear image UUID
    } else if (data.imageFile instanceof File) { // Check it's a File
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            if (existingImageId) {
                // Update existing image record
                await _updateImage(settings, existingImageId, base64Data, data.imageFile.type, data.imageFile.name);
                // UUID of image doesn't change on update
                newImageId = existingImageId; // ID remains the same
            } else {
                // Insert new image record
                const imageResult = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name);
                newImageId = imageResult.imageId;
                newImageUuid = imageResult.imageUuid;
            }
        } catch (error) {
            console.error("Failed to process or update/insert image:", error);
            throw new Error(`Failed to handle image update: ${error.message}`);
        }
    }

    const updateUrl = `${baseUrl}/items?item_id=eq.${itemId}`;
    const { uuid, ...updateData } = data; // Ensure item's own UUID isn't in the update payload
    const payload = {
        // PG trigger handles updated_at
        name: updateData.name,
        description: updateData.description || null,
        location_id: updateData.location_id,
        category_id: updateData.category_id,
        owner_id: updateData.owner_id,
        image_id: newImageId, // Set the potentially updated image ID
        image_uuid: newImageUuid, // Set the potentially updated image UUID
    };

    const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: defaultHeaders(settings, true), // Request representation
        body: JSON.stringify(payload),
    });

    const updateOpResult = await handleResponse(res, 'update', `item ID ${itemId}`);
    if (!updateOpResult.success) {
         // Should be caught by handleResponse throwing
        throw new Error(`Update item ${itemId} failed`);
    }
    // newImageUuid is determined by the logic within updateItem
    // If Prefer: return=representation was used, updateOpResult.data[0].image_uuid could be used.
    // However, newImageUuid is more reliable as it's set based on the logic flow (remove, add new, keep existing).
    return { success: true, image_uuid: newImageUuid };
};

/**
 * Deletes an item record.
 */
export const deleteItem = async (settings, itemId) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for deletion.");

    // 1. Get the image_id associated with the item *before* deleting the item
    const itemUrl = `${baseUrl}/items?item_id=eq.${itemId}&select=image_id`;
    const itemRes = await fetch(itemUrl, { headers: defaultHeaders(settings, false) });

    let imageIdToDelete = null;
    if (itemRes.ok) {
        const itemData = await itemRes.json();
        imageIdToDelete = itemData[0]?.image_id;
    } else if (itemRes.status !== 404) {
        // If item fetch fails for reason other than not found, throw error
        await handleResponse(itemRes, 'fetch item for deletion', `item ID ${itemId}`);
    } // If 404, item already gone, proceed to ensure image is gone if we somehow know its ID (unlikely here)

    // 2. Delete the item record
    const deleteItemUrl = `${baseUrl}/items?item_id=eq.${itemId}`;
    const deleteItemRes = await fetch(deleteItemUrl, {
        method: 'DELETE',
        headers: defaultHeaders(settings, false),
    });

    // Check item deletion result (ignore 404)
    if (!deleteItemRes.ok && deleteItemRes.status !== 404) {
        await handleResponse(deleteItemRes, 'delete', `item ID ${itemId}`); // This will throw if not ok
        // If handleResponse doesn't throw (e.g. if it's modified not to), then we need to return failure.
        // Assuming current handleResponse throws on error:
    }

    // 3. If item deletion was successful (or item was already gone) AND we found an image ID, delete the image
    if (imageIdToDelete) {
        await _deleteImage(settings, imageIdToDelete); // _deleteImage handles its own errors/404s
    }

    console.log(`Deletion process completed for item ID ${itemId}`);
    return { success: true }; // Return success
};

// listItems: Remove options, pagination, filtering, sorting, and direct image fetching.
export const listItems = async (settings) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    try {
        // Fetch all items metadata, including all relevant IDs and UUIDs
        // Ensure select includes: item_id, uuid, name, description, location_id, category_id, owner_id, image_id, image_uuid, created_at, updated_at
        const itemsUrl = `${baseUrl}/items?select=*,image_id,image_uuid&order=created_at.desc`;
        const itemsRes = await fetch(itemsUrl, {
            method: 'GET',
            headers: defaultHeaders(settings, false)
        });
        const itemsResult = await handleResponse(itemsRes, 'list', 'all items metadata');
        return itemsResult.data || []; // Return raw metadata array
    } catch (error) {
        console.error("Error in PostgREST listItems:", error);
        throw error;
    }
};

// New internal helper to get image by UUID
const _getImageByUuid = async (settings, imageUuid) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");
    if (!imageUuid) {
        console.warn("_getImageByUuid called with no UUID");
        return null;
    }

    const queryUrl = `${baseUrl}/images?uuid=eq.${imageUuid}&select=image_data,image_mimetype,image_filename&limit=1`;
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: defaultHeaders(settings, false)
    });

    if (!res.ok) {
        if (res.status === 404) {
            console.log(`Image not found for UUID: ${imageUuid}`);
            return null;
        }
        // For other errors, let handleResponse process it, then catch and re-throw or return null
        try {
            await handleResponse(res, 'fetch image by UUID', `image UUID ${imageUuid}`);
        } catch (e) {
            console.error(`Failed to fetch image by UUID ${imageUuid}: ${e.message}`);
            throw e; // Or return null if preferred
        }
        return null; // Should be unreachable if handleResponse throws
    }
    
    const result = await res.json(); // handleResponse would do this, but we need more direct control for 404
    const imageDataArray = result; // PostgREST returns an array

    if (!imageDataArray || imageDataArray.length === 0) {
        console.log(`Image data not found in response for UUID: ${imageUuid}`);
        return null;
    }
    const imageData = imageDataArray[0];

    if (imageData.image_data && imageData.image_mimetype) {
        const blob = base64ToBlob(imageData.image_data, imageData.image_mimetype);
        return { blob, filename: imageData.image_filename || `image_${imageUuid}` };
    }
    return null;
};

// New exported method getImage
export const getImage = async (settings, imageUuid) => {
    if (!imageUuid) return null;
    try {
        const imageDetails = await _getImageByUuid(settings, imageUuid);
        if (imageDetails && imageDetails.blob) {
            return new File([imageDetails.blob], imageDetails.filename, { type: imageDetails.blob.type });
        }
        return null;
    } catch (error) {
        console.error(`Error in getImage for PostgREST, UUID ${imageUuid}:`, error);
        return null;
    }
};

// --- Export/Import ---

export const exportData = async (settings) => {
    const zip = new JSZip();
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    try {
        // 1. Fetch all data using list functions
        const locations = await listLocations(settings);
        const categories = await listCategories(settings);
        const owners = await listOwners(settings);
        // listItems now returns all item metadata without File objects.
        const itemsMetadata = await listItems(settings); // Changed variable name

        // Fetch all image metadata separately for images.csv
        const imagesMetaUrl = `${baseUrl}/images?select=image_id,uuid,image_mimetype,image_filename,created_at&order=image_id`;
        const imagesMetaRes = await fetch(imagesMetaUrl, { headers: defaultHeaders(settings, false) });
        const imagesMetaResult = await handleResponse(imagesMetaRes, 'list image metadata for export', 'images');
        const allImagesMeta = imagesMetaResult.data || [];

        // 2. Create CSVs
        const locationHeaders = ['location_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('locations.csv', createCSV(locationHeaders, locations));

        const categoryHeaders = ['category_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('categories.csv', createCSV(categoryHeaders, categories));

        const ownerHeaders = ['owner_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('owners.csv', createCSV(ownerHeaders, owners));

        const imageHeaders = ['image_id', 'uuid', 'image_mimetype', 'image_filename', 'created_at'];
        zip.file('images.csv', createCSV(imageHeaders, allImagesMeta));

        const itemHeaders = ['item_id', 'uuid', 'name', 'description', 'location_id', 'category_id', 'owner_id', 'image_id', 'image_uuid', 'image_zip_filename', 'image_original_filename', 'created_at', 'updated_at'];
        const itemsForCsv = [];
        const imagesFolder = zip.folder('images');

        for (const item of itemsMetadata) { // Iterate over metadata
            const itemCsvRow = { ...item };
            itemCsvRow.image_zip_filename = '';
            itemCsvRow.image_original_filename = '';

            if (item.image_uuid) { // Check if there's an associated image UUID
                const imageFile = await getImage(settings, item.image_uuid); // Fetch the image File object
                if (imageFile instanceof File) {
                    const fileExtension = imageFile.name.split('.').pop() || 'bin';
                    const zipFilename = `${item.item_id}.${fileExtension}`;
                    itemCsvRow.image_zip_filename = zipFilename;
                    itemCsvRow.image_original_filename = imageFile.name;
                    imagesFolder.file(zipFilename, imageFile);
                }
            }
            itemsForCsv.push(itemCsvRow);
        }
        zip.file('items.csv', createCSV(itemHeaders, itemsForCsv));

        // 3. Create Manifest
        const manifest = {
            exportFormatVersion: FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            sourceProvider: "postgrest" // Identify source
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        console.log('PostgRESTProvider: Export generated successfully.');
        return blob;

    } catch (error) {
        console.error("Error during PostgREST export:", error);
        throw new Error(`Export failed: ${error.message}`);
    }
};

/*
// --- importData v1: your existing code, but taking a pre-loaded JSZip ---
*/
async function importDataV1(settings, loadedZip) {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    try {
        // Validate essential files
        if (!loadedZip.file('manifest.json') || !loadedZip.file('items.csv') || !loadedZip.file('locations.csv') || !loadedZip.file('categories.csv') || !loadedZip.file('owners.csv') || !loadedZip.file('images.csv')) {
            throw new Error("Import file is missing required CSV or manifest files.");
        }

        // --- Clear existing data ---
        console.log("Clearing existing PostgREST data (Items first)...");
        await destroyData(settings); // Use destroyData for thorough cleaning
        console.log("Existing data cleared.");

        // --- Parse and Import ---
        const locationMap = {}; // exported_id -> new_postgrest_id
        const categoryMap = {};
        const ownerMap = {};
        const imageMap = {}; // exported_image_id -> { newId: new_postgrest_id, uuid: image_uuid }

        // Import Locations
        const locations = parseCSV(await loadedZip.file('locations.csv').async('string'));
        for (const loc of locations) {
            const { location_id: exportedId, ...locData } = loc;
            // Preserve timestamps if they exist in the CSV
            // Pass UUID from CSV
            const payload = {
                uuid: locData.uuid, // Pass UUID
                name: locData.name,
                description: locData.description,
                created_at: locData.created_at || undefined, // Let PG handle if null/missing
                updated_at: locData.updated_at || null, // Set explicitly null or use value
            };
            // Remove undefined keys
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
            const result = await addLocation(settings, payload); // addLocation handles POST and gets new ID
            if (result.success) locationMap[exportedId] = result.newId;
            else throw new Error(`Failed to import location: ${loc.name}`);
        }

        // Import Categories
        const categories = parseCSV(await loadedZip.file('categories.csv').async('string'));
        for (const cat of categories) {
            const { category_id: exportedId, ...catData } = cat;
            // Pass UUID from CSV
            const payload = {
                uuid: catData.uuid, // Pass UUID
                name: catData.name,
                description: catData.description,
                created_at: catData.created_at || undefined,
                updated_at: catData.updated_at || null,
            };
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
            const result = await addCategory(settings, payload);
            if (result.success) categoryMap[exportedId] = result.newId;
            else throw new Error(`Failed to import category: ${cat.name}`);
        }

        // Import Owners
        const owners = parseCSV(await loadedZip.file('owners.csv').async('string'));
        for (const owner of owners) {
            const { owner_id: exportedId, ...ownerData } = owner;
            // Pass UUID from CSV
            const payload = {
                uuid: ownerData.uuid, // Pass UUID
                name: ownerData.name,
                description: ownerData.description,
                created_at: ownerData.created_at || undefined,
                updated_at: ownerData.updated_at || null,
            };
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
            const result = await addOwner(settings, payload);
            if (result.success) ownerMap[exportedId] = result.newId;
            else throw new Error(`Failed to import owner: ${owner.name}`);
        }

        // Import Images first to get new IDs mapped to UUIDs
        // Correction: Process images within the item loop using addItem's logic

        // Import Items
        const items = parseCSV(await loadedZip.file('items.csv').async('string'));
        for (const item of items) {
            const { item_id: exportedItemId, uuid: itemUuid, image_id: exportedImageId, image_uuid: imageUuidFromCsv, image_zip_filename, image_original_filename, location_id, category_id, owner_id, ...itemMetadata } = item;
            let imageFile = null;

            if (image_zip_filename && loadedZip.file(`images/${image_zip_filename}`)) {
                try {
                    const imageBlob = await loadedZip.file(`images/${image_zip_filename}`).async('blob');
                    const originalFilename = image_original_filename || image_zip_filename;
                    const determinedMimeType = getMimeTypeFromFilename(originalFilename);
                    imageFile = new File([imageBlob], originalFilename, { type: determinedMimeType });
                    // We pass imageFile and imageUuidFromCsv to addItem below
                } catch (zipError) {
                     // TODO: Handle image processing errors more gracefully (e.g., import item without image)
                     console.error(`Error processing image ${image_zip_filename} from zip for item ${item.name}:`, zipError);
                     // Decide if you want to skip the item or throw the error
                     // continue; // Example: skip item if image processing fails
                     throw new Error(`Failed to process image ${image_zip_filename} from zip: ${zipError.message}`);
                }
            }

            const newItemData = {
                name: itemMetadata.name,
                description: itemMetadata.description || null,
                uuid: itemUuid, // Pass item UUID from CSV
                location_id: locationMap[location_id], // Map to new ID
                category_id: categoryMap[category_id], // Map to new ID
                owner_id: ownerMap[owner_id],       // Map to new ID
                image_uuid: imageFile ? imageUuidFromCsv : undefined, // <<< ADD THIS LINE: Pass image UUID from CSV if there's an image
                imageFile: imageFile,               // Pass the File object (addItem will handle base64 conversion)
                created_at: itemMetadata.created_at || undefined, // Preserve timestamp or let PG handle
                updated_at: itemMetadata.updated_at || null   // Preserve timestamp or set null
            };

            // Ensure mapped IDs are valid before adding
            if (!newItemData.location_id || !newItemData.category_id || !newItemData.owner_id) {
                 console.warn(`Skipping item "${item.name}" due to missing mapped ID (Location: ${location_id}=>${newItemData.location_id}, Category: ${category_id}=>${newItemData.category_id}, Owner: ${owner_id}=>${newItemData.owner_id})`);
                 continue; // Skip this item if any mapping failed
            }

            // Remove undefined keys
            Object.keys(newItemData).forEach(key => newItemData[key] === undefined && delete newItemData[key]);

            // Use addItem, which now handles UUIDs and image insertion correctly
            const res = await addItem(settings, newItemData);
            // Check response, throw error if import failed for this item
            // Note: addItem returns { success: true, status: ... }, handleResponse is not needed here
            // We might need a more robust check if addItem's return value changes
            if (!res.success) {
                 throw new Error(`Failed to import item "${item.name}" with status ${res.status}`);
            }
        }

        console.log('PostgRESTProvider: Import completed successfully.');
        return {
            success: true,
            counts: {
                locations: locations.length,
                categories: categories.length,
                owners: owners.length,
                items: items.length
            }
        };

    } catch (error) {
        console.error("Error during PostgREST import:", error);
        // PostgREST uses transactions implicitly per request, but full rollback is hard here.
        return { success: false, error: `Import failed: ${error.message}. Data might be in an inconsistent state.` };
    }
}

// --- importData dispatcher for versioning ---
export const importData = async (settings, zipFile) => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    // read manifest version (fallback to current)
    let version = FORMAT_VERSION;
    const mf = loadedZip.file("manifest.json");
    if (mf) {
        try {
            const m = JSON.parse(await mf.async("string"));
            version = m.exportFormatVersion || version;
        } catch (_) { /* ignore */ }
    }

    switch (version) {
        case FORMAT_VERSION:
            return importDataV1(settings, loadedZip);
        default:
            return {
                success: false,
                error: `Unsupported export format version: ${version}`,
            };
    }
};

export const destroyData = async (settings) => {
    const baseUrl = settings?.postgrestApiUrl;
    if (!baseUrl) throw new Error("PostgREST API URL is not configured.");

    try {
        // Order: Items (handles images via deleteItem), then Owners, Categories, Locations
        // (Reverse dependency order)

        // 1. Delete Items (which should trigger image deletion via deleteItem logic)
        console.log("Fetching items to delete...");
        const itemsMetadataToDelete = await listItems(settings); // Fetches all item metadata
        console.log(`Deleting ${itemsMetadataToDelete.length} items...`);
        for (const item of itemsMetadataToDelete) { // Iterate over metadata
            await deleteItem(settings, item.item_id); // deleteItem handles image deletion
        }
        console.log("Items cleared.");

        // 2. Delete Owners
        console.log("Fetching owners to delete...");
        const ownersToDelete = await listOwners(settings);
        console.log(`Deleting ${ownersToDelete.length} owners...`);
        for (const owner of ownersToDelete) {
            // Use direct DELETE here as constraint check is implicitly handled by item deletion above
            const deleteUrl = `${baseUrl}/owners?owner_id=eq.${owner.owner_id}`;
            const res = await fetch(deleteUrl, { method: 'DELETE', headers: defaultHeaders(settings, false) });
            if (!res.ok && res.status !== 404) await handleResponse(res, 'delete', `owner ID ${owner.owner_id}`);
        }
        console.log("Owners cleared.");

        // 3. Delete Categories
        console.log("Fetching categories to delete...");
        const categoriesToDelete = await listCategories(settings);
        console.log(`Deleting ${categoriesToDelete.length} categories...`);
        for (const cat of categoriesToDelete) {
            const deleteUrl = `${baseUrl}/categories?category_id=eq.${cat.category_id}`;
            const res = await fetch(deleteUrl, { method: 'DELETE', headers: defaultHeaders(settings, false) });
             if (!res.ok && res.status !== 404) await handleResponse(res, 'delete', `category ID ${cat.category_id}`);
        }
        console.log("Categories cleared.");

        // 4. Delete Locations
        console.log("Fetching locations to delete...");
        const locationsToDelete = await listLocations(settings);
        console.log(`Deleting ${locationsToDelete.length} locations...`);
        for (const loc of locationsToDelete) {
            const deleteUrl = `${baseUrl}/locations?location_id=eq.${loc.location_id}`;
            const res = await fetch(deleteUrl, { method: 'DELETE', headers: defaultHeaders(settings, false) });
             if (!res.ok && res.status !== 404) await handleResponse(res, 'delete', `location ID ${loc.location_id}`);
        }
        console.log("Locations cleared.");

        // 5. Verify Images are gone (optional sanity check - they should be gone via item deletion)
        const remainingImagesRes = await fetch(`${baseUrl}/images?select=image_id&limit=1`, { headers: defaultHeaders(settings, false) });
        if (remainingImagesRes.ok) {
            const remainingImages = await remainingImagesRes.json();
            if (remainingImages.length > 0) {
                console.warn("Some images might remain after destroy operation. Manual cleanup may be needed.");
                // Optionally attempt direct image deletion here if needed
            } else {
                 console.log("Image table confirmed empty.");
            }
        }


        console.log("PostgRESTProvider: Data destruction completed successfully.");
        return { success: true, summary: `All data successfully destroyed.` };

    } catch (error) {
        console.error("Error during PostgREST data destruction:", error);
        return { success: false, error: `Data destruction failed: ${error.message}. Data might be in an inconsistent state.` };
    }
};
