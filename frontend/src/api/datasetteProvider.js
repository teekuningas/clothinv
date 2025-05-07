import JSZip from 'jszip';
import { FORMAT_VERSION } from './exportFormat';
import { v4 as uuidv4 } from 'uuid';
import {
    getMimeTypeFromFilename,
    readFileAsBase64,
    createCSV,
    parseCSV,
    base64ToBlob // Needed for listItems
} from './providerUtils'; // Import shared utilities

// Helper to generate headers, extracting token from settings
const defaultHeaders = (settings) => {
    const headers = {
        'Content-Type': 'application/json',
    };
    // Access the token via the settings object using the key defined in the registry
    if (settings?.datasetteApiToken) {
        headers['Authorization'] = `Bearer ${settings.datasetteApiToken}`;
    }
    return headers;
};

// handleResponse updated to be more generic and return JSON if possible
const handleResponse = async (res, operation, entityDescription) => {
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`);
    }
    // For write operations, just return success status for now
    return { success: true, status: res.status };
};

// --- Internal Helper Functions (Not Exported Directly to Context) ---
// These now accept the 'settings' object instead of individual config parameters.

export const addCategory = async (settings, data) => {
    const newUuid = data.uuid || uuidv4(); // Use provided UUID or generate
    const categoryData = {
        row: { ...data, uuid: newUuid, updated_at: null } // Add UUID, Explicitly set updated_at to null
        // created_at should be handled by DB default
    };
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const insertRes = await fetch(`${baseUrl}/categories/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(categoryData),
    });
    // Use updated handleResponse
    const insertResult = await handleResponse(insertRes, 'add', 'category');
     if (!insertResult.success) {
         throw new Error(`Category insert failed with status ${insertRes.status}`);
    }

    // After successful insert, fetch the latest category ID
    // Using _shape=array simplifies getting the row directly
    const queryUrl = `${baseUrl}/categories.json?_sort_desc=category_id&_size=1&_shape=array`; // Use _shape=array
    const queryRes = await fetch(queryUrl, {
         method: 'GET',
         headers: { 'Accept': 'application/json' }
    });

    if (!queryRes.ok) {
        const errorText = await queryRes.text();
        console.error(`Failed to fetch latest category ID: ${queryRes.status} ${errorText}`, queryRes);
        throw new Error(`Failed to fetch latest category ID after insert: ${queryRes.status}`);
    }

    const queryData = await queryRes.json();
    // With _shape=array, response is an array of objects. Check the first object.
    if (!queryData || queryData.length === 0 || !queryData[0].category_id) { // Adjust check for array shape
         console.error("Could not find category_id in query response:", queryData);
         throw new Error("Failed to retrieve category_id after insert.");
    }

    const newCategoryId = queryData[0].category_id; // Adjust access for array shape
    console.log("Retrieved new category ID:", newCategoryId);

    // Return success status, the new ID, and the UUID
    return { success: true, status: insertRes.status, newId: newCategoryId, uuid: newUuid };
};

// --- Exported API Methods (Bound by ApiContext) ---
// These are the functions listed in the providerRegistry 'methods' array.
// They receive the 'settings' object as the first argument from ApiContext.


export const addLocation = async (settings, data) => {
    const newUuid = data.uuid || uuidv4(); // Use provided UUID or generate
    const locationData = {
        row: { ...data, uuid: newUuid, updated_at: null } // Add UUID, Explicitly set updated_at to null
        // created_at should be handled by DB default
    };
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Perform the insert
    const insertRes = await fetch(`${baseUrl}/locations/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Pass the whole settings object
        body: JSON.stringify(locationData),
    });
    // Use handleResponse for initial check, but we need the ID later
    const insertResult = await handleResponse(insertRes, 'add', 'location');
    if (!insertResult.success) {
         // Error already thrown by handleResponse, but be explicit
         throw new Error(`Location insert failed with status ${insertRes.status}`);
    }

    // After successful insert, fetch the latest location ID
    // Using _shape=array simplifies getting the row directly
    const queryUrl = `${baseUrl}/locations.json?_sort_desc=location_id&_size=1&_shape=array`;
    const queryRes = await fetch(queryUrl, {
         method: 'GET',
         headers: { 'Accept': 'application/json' } // Ensure we get JSON
    });

    if (!queryRes.ok) {
        const errorText = await queryRes.text();
        console.error(`Failed to fetch latest location ID: ${queryRes.status} ${errorText}`, queryRes);
        throw new Error(`Failed to fetch latest location ID after insert: ${queryRes.status}`);
    }

    const queryData = await queryRes.json();
    // With _shape=array, response is an array of objects. Check the first object.
    if (!queryData || queryData.length === 0 || !queryData[0].location_id) {
         console.error("Could not find location_id in query response:", queryData);
         throw new Error("Failed to retrieve location_id after insert.");
    }

    const newLocationId = queryData[0].location_id;
    console.log("Retrieved new location ID:", newLocationId);

    // Return success status, the new ID, and the UUID
    // Assuming addLocation was called with data containing the UUID or it was generated before calling
    return { success: true, status: insertRes.status, newId: newLocationId, uuid: locationData.row.uuid };
};

export const listLocations = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/locations.json?_shape=array&_sort=location_id`; // Fetch all fields including uuid
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch locations: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch locations: ${res.status}`);
    }

    const data = await res.json();
    console.log("Fetched locations:", data);
    return data; // Returns array like [{location_id: 1, uuid: '...', name: 'Closet', ...}, ...]
};

export const updateLocation = async (settings, locationId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for update.");

    const updateUrl = `${baseUrl}/locations/${locationId}/-/update`;
    const { uuid, ...updateData } = data; // Exclude uuid from update payload
    const payload = {
        update: { ...updateData, updated_at: new Date().toISOString() } // Set updated_at on update
    };

    const res = await fetch(updateUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(payload),
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'update', `location ID ${locationId}`);
};

export const deleteLocation = async (settings, locationId) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for deletion.");

    // Dependency Check: Check if any items use this location
    const checkUrl = `${baseUrl}/items.json?location_id=eq.${locationId}&_shape=count`;
    try {
        const checkRes = await fetch(checkUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            // Handle error during check, but don't necessarily block deletion unless it's a server error
            console.error(`Failed to check item dependencies for location ${locationId}: ${checkRes.status}`);
            // Optionally throw an error here if the check must succeed
        } else {
            const checkData = await checkRes.json();
            if (checkData && checkData.count > 0) {
                console.warn(`Attempted to delete location ${locationId} which is used by ${checkData.count} items.`);
                // Use the specific error message expected by LocationsView
                return { success: false, message: 'Cannot delete location: It is currently assigned to one or more items.' };
            }
        }
    } catch (error) {
        console.error(`Error checking dependencies for location ${locationId}:`, error);
        // Decide if you want to proceed or throw
        // throw new Error(`Failed to check dependencies: ${error.message}`);
    }


    // Proceed with deletion
    const deleteUrl = `${baseUrl}/locations/${locationId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'delete', `location ID ${locationId}`);
};

export const listCategories = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/categories.json?_shape=array&_sort=category_id`; // Fetch all fields including uuid
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch categories: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch categories: ${res.status}`);
    }

    const data = await res.json();
    console.log("Fetched categories:", data);
    return data; // Returns array like [{category_id: 1, uuid: '...', name: 'Tops', ...}, ...]
};

export const updateCategory = async (settings, categoryId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for update.");

    const updateUrl = `${baseUrl}/categories/${categoryId}/-/update`;
    const { uuid, ...updateData } = data; // Exclude uuid from update payload
    const payload = {
        update: { ...updateData, updated_at: new Date().toISOString() } // Set updated_at on update
    };

    const res = await fetch(updateUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(payload),
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'update', `category ID ${categoryId}`);
};

export const deleteCategory = async (settings, categoryId) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for deletion.");

    // Dependency Check: Check if any items use this category
    const checkUrl = `${baseUrl}/items.json?category_id=eq.${categoryId}&_shape=count`;
    try {
        const checkRes = await fetch(checkUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            console.error(`Failed to check item dependencies for category ${categoryId}: ${checkRes.status}`);
        } else {
            const checkData = await checkRes.json();
            if (checkData && checkData.count > 0) {
                console.warn(`Attempted to delete category ${categoryId} which is used by ${checkData.count} items.`);
                // Use the specific error message expected by CategoriesView
                return { success: false, message: 'Cannot delete category: It is currently assigned to one or more items.' };
            }
        }
    } catch (error) {
        console.error(`Error checking dependencies for category ${categoryId}:`, error);
        // throw new Error(`Failed to check dependencies: ${error.message}`);
    }

    // Proceed with deletion
    const deleteUrl = `${baseUrl}/categories/${categoryId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'delete', `category ID ${categoryId}`);
};

export const listOwners = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/owners.json?_shape=array&_sort=owner_id`; // Fetch all fields including uuid
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch owners: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch owners: ${res.status}`);
    }

    const data = await res.json();
    console.log("Fetched owners:", data);
    return data; // Returns array like [{owner_id: 1, uuid: '...', name: 'Alice', ...}, ...]
};

export const addOwner = async (settings, data) => { // Rename to addOwner and export
    const newUuid = data.uuid || uuidv4(); // Use provided UUID or generate
    const ownerData = {
        row: { ...data, uuid: newUuid, updated_at: null } // Add UUID, Explicitly set updated_at to null
        // created_at should be handled by DB default
    };
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Perform the insert
    const insertRes = await fetch(`${baseUrl}/owners/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(ownerData),
    });
    const insertResult = await handleResponse(insertRes, 'add', 'owner');
     if (!insertResult.success) {
         throw new Error(`Owner insert failed with status ${insertRes.status}`);
    }

    // After successful insert, fetch the latest owner ID
    // Using _shape=array simplifies getting the row directly
    const queryUrl = `${baseUrl}/owners.json?_sort_desc=owner_id&_size=1&_shape=array`; // Use _shape=array
    const queryRes = await fetch(queryUrl, {
         method: 'GET',
         headers: { 'Accept': 'application/json' }
    });

    if (!queryRes.ok) {
        const errorText = await queryRes.text();
        console.error(`Failed to fetch latest owner ID: ${queryRes.status} ${errorText}`, queryRes);
        throw new Error(`Failed to fetch latest owner ID after insert: ${queryRes.status}`);
    }

    const queryData = await queryRes.json();
    // With _shape=array, response is an array of objects. Check the first object.
    if (!queryData || queryData.length === 0 || !queryData[0].owner_id) { // Adjust check for array shape
         console.error("Could not find owner_id in query response:", queryData);
         throw new Error("Failed to retrieve owner_id after insert.");
    }

    const newOwnerId = queryData[0].owner_id; // Adjust access for array shape
    console.log("Retrieved new owner ID:", newOwnerId);

    // Return success status, the new ID, and the UUID
    return { success: true, status: insertRes.status, newId: newOwnerId, uuid: newUuid };
};

export const updateOwner = async (settings, ownerId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for update.");

    const updateUrl = `${baseUrl}/owners/${ownerId}/-/update`;
    const { uuid, ...updateData } = data; // Exclude uuid from update payload
    const payload = {
        update: { ...updateData, updated_at: new Date().toISOString() } // Set updated_at on update
    };

    const res = await fetch(updateUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(payload),
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'update', `owner ID ${ownerId}`);
};

export const deleteOwner = async (settings, ownerId) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for deletion.");

    // Dependency Check: Check if any items use this owner
    const checkUrl = `${baseUrl}/items.json?owner_id=eq.${ownerId}&_shape=count`;
    try {
        const checkRes = await fetch(checkUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            console.error(`Failed to check item dependencies for owner ${ownerId}: ${checkRes.status}`);
        } else {
            const checkData = await checkRes.json();
            if (checkData && checkData.count > 0) {
                console.warn(`Attempted to delete owner ${ownerId} which is used by ${checkData.count} items.`);
                // Use the specific error message expected by OwnersView
                return { success: false, message: 'Cannot delete owner: They are currently assigned to one or more items.' };
            }
        }
    } catch (error) {
        console.error(`Error checking dependencies for owner ${ownerId}:`, error);
        // throw new Error(`Failed to check dependencies: ${error.message}`);
    }

    // Proceed with deletion
    const deleteUrl = `${baseUrl}/owners/${ownerId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    return handleResponse(res, 'delete', `owner ID ${ownerId}`);
};

// --- Image Handling ---

/**
 * Internal: Inserts image data and filename, returns the new ID and UUID.
 */
const _insertImage = async (settings, base64Data, mimeType, filename, imageUuid = undefined) => {
    const newUuid = imageUuid || uuidv4(); // Use provided UUID or generate
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const imageData = {
        row: {
            image_data: base64Data, // Store base64 string directly
            uuid: newUuid, // Store UUID
            image_mimetype: mimeType,
            image_filename: filename || 'image', // Store filename, provide default
        }
    };

    const insertRes = await fetch(`${baseUrl}/images/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(imageData),
    });
    await handleResponse(insertRes, 'insert', 'image'); // Check for success

    // Fetch the latest image ID
    const queryUrl = `${baseUrl}/images.json?_sort_desc=image_id&_size=1&_shape=array`;
    const queryRes = await fetch(queryUrl, { headers: { 'Accept': 'application/json' } });
    if (!queryRes.ok) throw new Error(`Failed to fetch latest image ID after insert: ${queryRes.status}`);
    const queryData = await queryRes.json();
    if (!queryData || queryData.length === 0 || !queryData[0].image_id) throw new Error("Failed to retrieve image_id after insert.");

    return { imageId: queryData[0].image_id, imageUuid: newUuid }; // Return both ID and UUID
};

/**
 * Internal: Updates image data and filename for an existing image ID.
 */
const _updateImage = async (settings, imageId, base64Data, mimeType, filename) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const updateUrl = `${baseUrl}/images/${imageId}/-/update`;
    // Exclude uuid from update payload - it should be immutable
    const payload = {
        update: { // uuid is NOT updated
            image_data: base64Data,
            image_mimetype: mimeType,
            image_filename: filename || 'image', // Update filename too
        }
    };
    const res = await fetch(updateUrl, { method: 'POST', headers: defaultHeaders(settings), body: JSON.stringify(payload) });
    return handleResponse(res, 'update', `image ID ${imageId}`);
};

/**
 * Internal: Deletes an image record by ID.
 */
const _deleteImage = async (settings, imageId) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const deleteUrl = `${baseUrl}/images/${imageId}/-/delete`;
    const res = await fetch(deleteUrl, { method: 'POST', headers: defaultHeaders(settings) });
    // We might ignore the response slightly, as the foreign key constraint handles item linking
    // But good to check for errors.
    return handleResponse(res, 'delete', `image ID ${imageId}`);
};

/**
 * Adds a single item record with basic details.
 * Expects data like { name, description, location_id, category_id, owner_id }
 * and optionally `imageFile` (a File object).
 * Can also accept `uuid` and `image_uuid` if importing. */
export const addItem = async (settings, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required.");
    }

    let imageId = null;
    let imageUuid = null; // Store image UUID separately
    if (data.imageFile instanceof File) { // Ensure it's a File object
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            // Pass filename and potentially image_uuid (if importing) to _insertImage
            const imageResult = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name, data.image_uuid);
            imageId = imageResult.imageId;
            imageUuid = imageResult.imageUuid; // Get the generated or provided image UUID
        } catch (error) {
            console.error("Failed to process or insert image:", error);
            throw new Error(`Failed to handle image upload: ${error.message}`);
        }
    }

    const newItemUuid = data.uuid || uuidv4(); // Use provided UUID or generate
    // Prepare the row data, ensuring description is null if empty
    const itemRowData = {
        name: data.name,
        description: data.description || null,
        location_id: data.location_id,
        category_id: data.category_id,
        owner_id: data.owner_id, // Add owner_id
        uuid: newItemUuid, // Add item UUID
        image_id: imageId, // Use the inserted image ID or null
        image_uuid: imageUuid, // Use the inserted image UUID or null
        updated_at: null // Explicitly set updated_at to null on creation
    };
    const itemPayload = { row: itemRowData };

    const itemRes = await fetch(`${baseUrl}/items/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(itemPayload),
    });

    // Use handleResponse for the item insert result
    return handleResponse(itemRes, 'add', 'item');
};


/**
 * Updates an item's details, including potentially the image.
 * Expects itemId and data like { name, description, location_id, category_id, owner_id, imageFile?, removeImage? }
 */
export const updateItem = async (settings, itemId, data) => { // data should NOT contain uuid
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for update.");
    // Add checks for location_id and category_id if they are mandatory for update
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required for update.");
    }

    // Fetch current item data to get existing image_id and image_uuid
    // Select uuid as well to ensure it's not overwritten
    const currentItemRes = await fetch(`${baseUrl}/items/${itemId}.json?_shape=object&_select=image_id,image_uuid,uuid`, { headers: { 'Accept': 'application/json' } });
    if (!currentItemRes.ok) throw new Error(`Failed to fetch current item data for update: ${currentItemRes.status}`);
    const currentItemData = await currentItemRes.json();
    const existingImageId = currentItemData[itemId]?.image_id; // Datasette object shape
    let existingImageUuid = currentItemData[itemId]?.image_uuid; // Get existing image UUID

    let newImageId = existingImageId; // Assume image doesn't change initially
    let newImageUuid = existingImageUuid; // Assume image UUID doesn't change

    if (data.removeImage && existingImageId) {
        await _deleteImage(settings, existingImageId);
        newImageId = null;
        newImageUuid = null; // Clear image UUID
    } else if (data.imageFile) {
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            if (existingImageId) {
                // Update existing image record, pass filename
                await _updateImage(settings, existingImageId, base64Data, data.imageFile.type, data.imageFile.name);
                newImageId = existingImageId; // ID remains the same
                newImageUuid = existingImageUuid; // UUID remains the same
            } else {
                // Insert new image record, pass filename
                const imageResult = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name);
                newImageId = imageResult.imageId;
                newImageUuid = imageResult.imageUuid; // Get the new image UUID
            }
        } catch (error) {
            console.error("Failed to process or update/insert image:", error);
            throw new Error(`Failed to handle image update: ${error.message}`);
        }
    }

    const updateUrl = `${baseUrl}/items/${itemId}/-/update`;
    const { uuid, ...updateData } = data; // Ensure item's own UUID isn't in the update payload
    const payload = {
        update: {
            name: updateData.name,
            description: updateData.description || null,
            location_id: updateData.location_id, category_id: updateData.category_id, owner_id: updateData.owner_id,
            image_id: newImageId, // Set the potentially updated image ID
            image_uuid: newImageUuid, // Set the potentially updated image UUID
            updated_at: new Date().toISOString() // Add the current timestamp
        } // created_at is not updated
    };

    const res = await fetch(updateUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(payload),
    });

    return handleResponse(res, 'update', `item ID ${itemId}`);
};

/**
 * Deletes an item record.
 */
export const deleteItem = async (settings, itemId) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for deletion.");

    // 1. Get the image_id associated with the item *before* deleting the item
    const itemRes = await fetch(`${baseUrl}/items/${itemId}.json?_shape=object&_select=image_id`); // Only need image_id
    if (itemRes.ok) {
        const itemData = await itemRes.json();
        const imageId = itemData[itemId]?.image_id;
        if (imageId) await _deleteImage(settings, imageId); // Delete image if it exists (handles its own errors)
    } // Ignore error if item not found

    const deleteUrl = `${baseUrl}/items/${itemId}/-/delete`;

    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed
    });

    return handleResponse(res, 'delete', `item ID ${itemId}`);
};

export const listItems = async (settings, options) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const { page, pageSize, sortBy, sortOrder, filters } = options;

    try {
        // 1. Fetch all items metadata
        const itemsUrl = `${baseUrl}/items.json?_shape=array&_sort_desc=created_at`; // Fetches all columns
        const itemsRes = await fetch(itemsUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!itemsRes.ok) {
            const errorText = await itemsRes.text();
            throw new Error(`Failed to fetch items metadata: ${itemsRes.status} ${errorText}`);
        }
        let allItemsMetadata = await itemsRes.json();
        if (!allItemsMetadata) allItemsMetadata = [];


        // 2. Apply Filtering (client-side)
        let filteredItems = allItemsMetadata.filter(item => {
            let matches = true;
            if (filters.name) {
                const searchTerm = filters.name.toLowerCase();
                const nameMatch = item.name?.toLowerCase().includes(searchTerm);
                const descMatch = item.description?.toLowerCase().includes(searchTerm);
                if (!nameMatch && !descMatch) matches = false;
            }
            if (matches && filters.locationIds && !filters.locationIds.includes(item.location_id)) {
                matches = false;
            }
            if (matches && filters.categoryIds && !filters.categoryIds.includes(item.category_id)) {
                matches = false;
            }
            if (matches && filters.ownerIds && !filters.ownerIds.includes(item.owner_id)) {
                matches = false;
            }
            return matches;
        });

        // 3. Apply Sorting (client-side)
        filteredItems.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;
            return sortOrder === 'desc' ? comparison * -1 : comparison;
        });

        // 4. Calculate totalCount
        const totalCount = filteredItems.length;

        // 5. Apply Pagination
        const startIndex = (page - 1) * pageSize;
        const paginatedItemMetadata = filteredItems.slice(startIndex, startIndex + pageSize);

        if (paginatedItemMetadata.length === 0) {
            return { items: [], totalCount: totalCount };
        }

        // 6. Fetch images only for the paginated subset
        // Datasette doesn't have a direct way to fetch multiple images by ID in one query like `image_id=in.(1,2,3)`
        // So, we fetch all images and then map, or fetch one by one (less efficient).
        // For this phase, let's fetch all images metadata and filter client-side.
        // A more optimized approach would be to fetch images one by one for the page if the images table is large.
        // Or, if the number of images is small, fetching all image data is acceptable.
        // Let's stick to the "fetch all image data then map" for now, similar to original logic but scoped.

        const imageIdsForPage = paginatedItemMetadata
            .map(item => item.image_id)
            .filter(id => id != null);

        let imageMap = {};
        if (imageIdsForPage.length > 0) {
            // To get specific images, we'd ideally filter. If not possible, fetch all and map.
            // For simplicity and consistency with the "fetch all then filter" pattern for items,
            // we'll fetch all images and then pick the ones we need.
            // This is NOT optimal if the images table is huge.
            // A better Datasette-specific way would be multiple `fetch` calls for each image_id or a complex SQL query if possible.
            // Given the constraints of "use existing machinery", we'll fetch all images.
            const imagesUrl = `${baseUrl}/images.json?_shape=array&select=image_id,image_data,image_mimetype,image_filename`;
            const imagesRes = await fetch(imagesUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (imagesRes.ok) {
                const allImagesData = await imagesRes.json();
                const relevantImagesData = allImagesData.filter(img => imageIdsForPage.includes(img.image_id));

                imageMap = relevantImagesData.reduce((map, img) => {
                    if (img.image_id && img.image_data && img.image_mimetype) {
                        const blob = base64ToBlob(img.image_data, img.image_mimetype);
                        if (blob) {
                            map[img.image_id] = {
                                blob: blob,
                                filename: img.image_filename || `image_${img.image_id}`
                            };
                        }
                    }
                    return map;
                }, {});
            } else {
                console.warn(`Failed to fetch images for page: ${imagesRes.status}. Items will be listed without images.`);
            }
        }

        // 7. Merge image File object into paginated items
        const itemsWithFiles = paginatedItemMetadata.map(item => {
            let imageFile = null;
            if (item.image_id && imageMap[item.image_id]) {
                const { blob, filename } = imageMap[item.image_id];
                imageFile = new File([blob], filename, { type: blob.type });
            }
            return { ...item, imageFile: imageFile };
        });

        return { items: itemsWithFiles, totalCount: totalCount };

    } catch (error) {
        console.error("Error in Datasette listItems:", error);
        throw error;
    }
};

// --- Export/Import ---

export const exportData = async (settings) => {
    const zip = new JSZip();

    try {
        // 1. Fetch all data using existing list functions
        const locations = await listLocations(settings);
        console.log(`Export: Fetched ${locations.length} locations.`);
        const categories = await listCategories(settings);
        console.log(`Export: Fetched ${categories.length} categories.`);
        const owners = await listOwners(settings);
        console.log(`Export: Fetched ${owners.length} owners.`);
        const items = await listItems(settings); // This includes imageFile objects and uuids
        console.log(`Export: Fetched ${items.length} items.`);
        // Fetch all image metadata separately for images.csv
        const allImagesMeta = await listImagesMetadata(settings); // Need a new helper function
        console.log(`Export: Fetched ${allImagesMeta.length} image metadata records.`);

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

        for (const item of items) {
            const itemCsvRow = { ...item };
            itemCsvRow.image_zip_filename = '';
            itemCsvRow.image_original_filename = '';
            // image_uuid is already in item object from listItems

            if (item.imageFile instanceof File) {
                const fileExtension = item.imageFile.name.split('.').pop() || 'bin';
                const zipFilename = `${item.item_id}.${fileExtension}`;
                itemCsvRow.image_zip_filename = zipFilename;
                itemCsvRow.image_original_filename = item.imageFile.name;
                // image_id and image_uuid are already part of itemCsvRow
                imagesFolder.file(zipFilename, item.imageFile);
            }
            // Remove the File object before adding to CSV data
            delete itemCsvRow.imageFile;
            itemsForCsv.push(itemCsvRow);
        }
        zip.file('items.csv', createCSV(itemHeaders, itemsForCsv));

        // 3. Create Manifest
        const manifest = {
            exportFormatVersion: FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            sourceProvider: "datasette"
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        console.log('DatasetteProvider: Export generated successfully.');
        return blob;

    } catch (error) {
        console.error("Error during Datasette export:", error);
        throw new Error(`Export failed: ${error.message}`);
    }
};

// Helper function to list only image metadata (id, uuid, filename, mimetype, created_at)
const listImagesMetadata = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const queryUrl = `${baseUrl}/images.json?_shape=array&_select=image_id,uuid,image_mimetype,image_filename,created_at&_sort=image_id`;
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch image metadata: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch image metadata: ${res.status}`);
    }

    const data = await res.json();
    return data || [];
};

/*
// --- importData v1 for Datasette provider ---
*/
async function importDataV1(settings, loadedZip) {
    try {
        // Validate essential files
        if (!loadedZip.file('manifest.json') || !loadedZip.file('items.csv') || !loadedZip.file('locations.csv') || !loadedZip.file('categories.csv') || !loadedZip.file('owners.csv') || !loadedZip.file('images.csv')) {
            throw new Error("Import file is missing required CSV or manifest files.");
        }

        // --- Clear existing data ---
        console.log("Clearing existing Datasette data (Items first)...");
        const existingItems = await listItems(settings);
        for (const item of existingItems) {
            await deleteItem(settings, item.item_id); // deleteItem also handles image deletion
        }
        console.log("Items cleared. Clearing Locations, Categories, Owners...");
        const existingLocations = await listLocations(settings);
        for (const loc of existingLocations) await deleteLocation(settings, loc.location_id);
        const existingCategories = await listCategories(settings);
        for (const cat of existingCategories) await deleteCategory(settings, cat.category_id);
        const existingOwners = await listOwners(settings);
        for (const owner of existingOwners) await deleteOwner(settings, owner.owner_id);
        console.log("Existing data cleared.");

        // --- Parse and Import ---
        const locationMap = {}; // exported_id -> new_datasette_id
        const categoryMap = {};
        const ownerMap = {};
        const imageMap = {}; // exported_image_id -> { newId: new_datasette_id, uuid: image_uuid }

        const locations = parseCSV(await loadedZip.file('locations.csv').async('string'));
        for (const loc of locations) {
            const { location_id: exportedId, ...locData } = loc;
            // Pass timestamps from CSV to preserve them
            // Pass UUID from CSV
            const result = await addLocation(settings, {
                uuid: locData.uuid, // Pass UUID
                name: locData.name, description: locData.description, created_at: locData.created_at, updated_at: locData.updated_at
            });
            if (result.success) locationMap[exportedId] = result.newId;
            else throw new Error(`Failed to import location: ${loc.name}`);
        }

        const categories = parseCSV(await loadedZip.file('categories.csv').async('string'));
        for (const cat of categories) {
            const { category_id: exportedId, ...catData } = cat;
            // Pass UUID from CSV
            const result = await addCategory(settings, {
                uuid: catData.uuid, // Pass UUID
                name: catData.name, description: catData.description, created_at: catData.created_at, updated_at: catData.updated_at
            });
            if (result.success) categoryMap[exportedId] = result.newId;
            else throw new Error(`Failed to import category: ${cat.name}`);
        }

        const owners = parseCSV(await loadedZip.file('owners.csv').async('string'));
        for (const owner of owners) {
            const { owner_id: exportedId, ...ownerData } = owner;
            // Pass UUID from CSV
            const result = await addOwner(settings, {
                uuid: ownerData.uuid, // Pass UUID
                name: ownerData.name, description: ownerData.description, created_at: ownerData.created_at, updated_at: ownerData.updated_at
            });
            if (result.success) ownerMap[exportedId] = result.newId;
            else throw new Error(`Failed to import owner: ${owner.name}`);
        }

        // Import Images first (without data, just to get IDs and UUIDs - assuming addItem handles image data)
        // Correction: addItem handles image insertion. We need to process images *as we process items*.

        const items = parseCSV(await loadedZip.file('items.csv').async('string'));
        for (const item of items) {
            const { item_id, uuid: itemUuid, image_id: exportedImageId, image_uuid: imageUuidFromItemCsv, image_zip_filename, image_original_filename, location_id, category_id, owner_id, ...itemMetadata } = item;
            let imageFile = null;

            if (image_zip_filename && loadedZip.file(`images/${image_zip_filename}`)) {
                try { // Add try...catch for robustness
                    const imageBlob = await loadedZip.file(`images/${image_zip_filename}`).async('blob');
                    const originalFilename = image_original_filename || image_zip_filename;

                    // *** Use the helper function to determine the MIME type ***
                    const determinedMimeType = getMimeTypeFromFilename(originalFilename);

                    // Create the File object, explicitly setting the determined type
                    imageFile = new File([imageBlob], originalFilename, { type: determinedMimeType });

                    // Optional: Log if the determined type differs from blob type (for debugging)
                    if (imageBlob.type && imageBlob.type !== determinedMimeType) {
                         console.warn(`Blob type (${imageBlob.type}) differs from determined type (${determinedMimeType}) for file ${originalFilename}`);
                    } else if (!imageBlob.type) {
                         console.log(`Determined MIME type ${determinedMimeType} for file ${originalFilename} (blob type was empty)`);
                    }

                } catch (zipError) {
                     console.error(`Error processing image ${image_zip_filename} from zip:`, zipError);
                     // Decide if you want to skip the item or throw the error
                     // continue; // Example: skip item if image processing fails
                     throw new Error(`Failed to process image ${image_zip_filename} from zip: ${zipError.message}`);
                }
            }

            const newItemData = {
                ...itemMetadata,
                uuid: itemUuid, // Use item's UUID from CSV
                location_id: locationMap[location_id], // Map to new ID
                category_id: categoryMap[category_id], // Map to new ID
                owner_id: ownerMap[owner_id],       // Map to new ID
                image_uuid: imageUuidFromItemCsv, // Pass image UUID from CSV (addItem will use this for _insertImage)
                imageFile: imageFile,
                created_at: itemMetadata.created_at, // Preserve timestamp
                updated_at: itemMetadata.updated_at  // Preserve timestamp
                // addItem will handle image_id and image_uuid generation/storage
            };

            // Ensure mapped IDs are valid before adding
            if (!newItemData.location_id || !newItemData.category_id || !newItemData.owner_id) {
                 console.warn(`Skipping item "${item.name}" due to missing mapped ID (Location: ${location_id}=>${newItemData.location_id}, Category: ${category_id}=>${newItemData.category_id}, Owner: ${owner_id}=>${newItemData.owner_id})`);
                 continue; // Skip this item if any mapping failed
            }


            await addItem(settings, newItemData); // addItem handles image insertion
        }

        console.log('DatasetteProvider: Import completed successfully.');
        return {
            success: true,
            counts: {
                locations: locations.length,
                categories: categories.length,
                owners: owners.length,
                items: items.length
            }
        };

    } catch (error) { // TODO: Improve error handling and potential rollback/cleanup
        console.error("Error during Datasette import:", error);
        // Datasette rollback is complex, data might be partially imported/deleted.
        return { success: false, error: `Import failed: ${error.message}. Data might be in an inconsistent state.` };
    }
}

// --- importData dispatcher for versioning ---
export const importData = async (settings, zipFile) => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    let version = FORMAT_VERSION;
    const mf = loadedZip.file("manifest.json");
    if (mf) {
        try {
            const m = JSON.parse(await mf.async("string"));
            version = m.exportFormatVersion || version;
        } catch (_) {}
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
    try {
        // --- Clear existing data ---
        console.log("Clearing existing Datasette data (Items first)...");
        const existingItems = await listItems(settings);
        // Delete items first to handle associated images
        for (const item of existingItems) {
            await deleteItem(settings, item.item_id); // deleteItem also handles image deletion
        }
        console.log(`Items (${existingItems.length}) cleared. Clearing Locations, Categories, Owners...`);

        const existingLocations = await listLocations(settings);
        for (const loc of existingLocations) await deleteLocation(settings, loc.location_id);
        console.log(`Locations (${existingLocations.length}) cleared.`);

        const existingCategories = await listCategories(settings);
        for (const cat of existingCategories) await deleteCategory(settings, cat.category_id);
        console.log(`Categories (${existingCategories.length}) cleared.`);

        const existingOwners = await listOwners(settings);
        for (const owner of existingOwners) await deleteOwner(settings, owner.owner_id);
        console.log(`Owners (${existingOwners.length}) cleared.`);

        console.log("Existing data cleared.");
        return { success: true, summary: `All data successfully destroyed.` };

    } catch (error) {
        console.error("Error during Datasette data destruction:", error);
        return { success: false, error: `Data destruction failed: ${error.message}. Data might be in an inconsistent state.` };
    }
};
// Removed JSZip import - already imported above
