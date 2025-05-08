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

// At the top of the file, for convenience
const PROVIDER_NAME = "Datasette Provider";

// Helper to generate headers, extracting token from settings
// The import block that was here has been removed.
// The first import at the very top of the file is sufficient.

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
        // Add provider prefix to console.error
        console.error(`[${PROVIDER_NAME}]: Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`);
    }
    // For write operations, just return success status for now
    return { success: true, status: res.status };
};

// Add this helper function near the top of datasetteProvider.js
const fetchRecordByUuidWithRetry = async (settings, tableName, uuidToFetch, selectFields = "*", entityName = "record") => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error(`[${PROVIDER_NAME}]: Datasette Base URL is not configured for fetchRecordByUuidWithRetry.`);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS_BASE = 250; // Initial delay, increases with retries
    let fetchedRecord = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        // Query by UUID, select specific fields, bypass cache, expect one record
        const queryUrl = `${baseUrl}/${tableName}.json?uuid=${uuidToFetch}&_shape=array&_select=${selectFields}&_ttl=0&_size=1`;

        if (i > 0) { // Log if retrying
            console.log(`[${PROVIDER_NAME}]: Retrying fetch for ${entityName} UUID ${uuidToFetch}, attempt ${i + 1}. URL: ${queryUrl}`);
        }

        const queryRes = await fetch(queryUrl, {
             method: 'GET',
             headers: { 'Accept': 'application/json' }
        });

        if (queryRes.ok) {
            const queryData = await queryRes.json();
            // Ensure we got an array, it's not empty, the record exists, and the UUID matches
            if (queryData && queryData.length > 0 && queryData[0] && queryData[0].uuid === uuidToFetch) {
                fetchedRecord = queryData[0];
                break; // Success!
            } else if (queryData && queryData.length > 0 && queryData[0] && queryData[0].uuid !== uuidToFetch) {
                 // This is unexpected if UUIDs are truly unique and the insert succeeded.
                 console.warn(`[${PROVIDER_NAME}]: Fetched ${entityName} UUID ${queryData[0].uuid} but expected ${uuidToFetch} on attempt ${i + 1}.`);
            } else {
                // queryData was empty or malformed, will retry if attempts remain.
                 console.log(`[${PROVIDER_NAME}]: Fetch for ${entityName} UUID ${uuidToFetch} (attempt ${i+1}) returned no matching record or malformed data. Retrying if possible.`);
            }
        } else {
            console.warn(`[${PROVIDER_NAME}]: Attempt ${i + 1} to fetch ${entityName} for UUID ${uuidToFetch} (URL: ${queryUrl}) failed with status ${queryRes.status}.`);
        }

        if (i < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS_BASE * (i + 1))); // Incremental backoff
        }
    }

    if (!fetchedRecord) {
        const errorMessage = `Failed to retrieve ${entityName} with UUID ${uuidToFetch} after ${MAX_RETRIES} retries. The record might not have been created or become available in time.`;
        console.error(`[${PROVIDER_NAME}]: ${errorMessage}`);
        throw new Error(errorMessage);
    }
    return fetchedRecord; // Return the successfully fetched record object
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

    // Fetch the newly created category by its UUID to get its ID and confirm creation
    const fetchedCategory = await fetchRecordByUuidWithRetry(settings, "categories", newUuid, "category_id,uuid", "category");
    const newCategoryId = fetchedCategory.category_id;
    // newUuid is already known. fetchedCategory.uuid should match newUuid.

    // Return success status, the new ID, and the UUID
    return { success: true, newId: newCategoryId, uuid: newUuid };
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

    // Fetch the newly created location by its UUID to get its ID and confirm creation
    const fetchedLocation = await fetchRecordByUuidWithRetry(settings, "locations", locationData.row.uuid, "location_id,uuid", "location");
    const newLocationId = fetchedLocation.location_id;

    // Return success status, the new ID, and the UUID
    // Assuming addLocation was called with data containing the UUID or it was generated before calling
    return { success: true, newId: newLocationId, uuid: locationData.row.uuid };
};

export const listLocations = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/locations.json?_shape=array&_sort=location_id&_ttl=0`; // Fetch all fields including uuid, bypass cache
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${PROVIDER_NAME}]: Failed to fetch locations: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch locations: ${res.status}`);
    }

    const data = await res.json();
    return data; // Returns array like [{location_id: 1, uuid: '...', name: 'Closet', ...}, ...]
};

export const updateLocation = async (settings, inputData) => {
    const { location_id: locationId, ...data } = inputData;
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
    await handleResponse(res, 'update', `location ID ${locationId}`);
    return { success: true };
};

export const deleteLocation = async (settings, inputData) => {
    const { location_id: locationId } = inputData;
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for deletion.");

    // Dependency Check: Efficiently check if any item uses this location
    const checkUrl = `${baseUrl}/items.json?location_id=${locationId}&_size=1&_shape=array`;
    try {
        const checkRes = await fetch(checkUrl, { headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            // Log error but attempt deletion if check fails, or handle more strictly
            console.error(`[${PROVIDER_NAME}]: Failed to perform dependency check for location ${locationId}: ${checkRes.status} ${await checkRes.text()}`);
            // Depending on policy, you might throw an error here or allow deletion to proceed cautiously.
            // For now, let's be strict:
            return { success: false, error: `Failed to check dependencies for location: ${checkRes.statusText}` };
        }
        const usageCheckData = await checkRes.json();
        if (usageCheckData && usageCheckData.length > 0) {
            console.warn(`[${PROVIDER_NAME}]: Attempted to delete location ${locationId} which is used by items.`);
            return { success: false, errorCode: 'ENTITY_IN_USE' };
        }
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during dependency check for location ${locationId}:`, error);
        return { success: false, error: `Error checking dependencies for location: ${error.message}` };
    }

    const deleteUrl = `${baseUrl}/locations/${locationId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    await handleResponse(res, 'delete', `location ID ${locationId}`);
    return { success: true };
};

export const listCategories = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/categories.json?_shape=array&_sort=category_id&_ttl=0`; // Fetch all fields including uuid, bypass cache
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${PROVIDER_NAME}]: Failed to fetch categories: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch categories: ${res.status}`);
    }

    const data = await res.json();
    return data; // Returns array like [{category_id: 1, uuid: '...', name: 'Tops', ...}, ...]
};

export const updateCategory = async (settings, inputData) => {
    const { category_id: categoryId, ...data } = inputData;
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
    await handleResponse(res, 'update', `category ID ${categoryId}`);
    return { success: true };
};

export const deleteCategory = async (settings, inputData) => {
    const { category_id: categoryId } = inputData;
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for deletion.");

    // Dependency Check: Efficiently check if any item uses this category
    const checkUrl = `${baseUrl}/items.json?category_id=${categoryId}&_size=1&_shape=array`;
    try {
        const checkRes = await fetch(checkUrl, { headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            console.error(`[${PROVIDER_NAME}]: Failed to perform dependency check for category ${categoryId}: ${checkRes.status} ${await checkRes.text()}`);
            return { success: false, error: `Failed to check dependencies for category: ${checkRes.statusText}` };
        }
        const usageCheckData = await checkRes.json();
        if (usageCheckData && usageCheckData.length > 0) {
            console.warn(`[${PROVIDER_NAME}]: Attempted to delete category ${categoryId} which is used by items.`);
            return { success: false, errorCode: 'ENTITY_IN_USE' };
        }
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during dependency check for category ${categoryId}:`, error);
        return { success: false, error: `Error checking dependencies for category: ${error.message}` };
    }

    const deleteUrl = `${baseUrl}/categories/${categoryId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    await handleResponse(res, 'delete', `category ID ${categoryId}`);
    return { success: true };
};

export const listOwners = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/owners.json?_shape=array&_sort=owner_id&_ttl=0`; // Fetch all fields including uuid, bypass cache
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${PROVIDER_NAME}]: Failed to fetch owners: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch owners: ${res.status}`);
    }

    const data = await res.json();
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

    // Fetch the newly created owner by its UUID to get its ID and confirm creation
    const fetchedOwner = await fetchRecordByUuidWithRetry(settings, "owners", newUuid, "owner_id,uuid", "owner");
    const newOwnerId = fetchedOwner.owner_id;
    // newUuid is already known. fetchedOwner.uuid should match newUuid.

    // Return success status, the new ID, and the UUID
    return { success: true, newId: newOwnerId, uuid: newUuid };
};

export const updateOwner = async (settings, inputData) => {
    const { owner_id: ownerId, ...data } = inputData;
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
    await handleResponse(res, 'update', `owner ID ${ownerId}`);
    return { success: true };
};

export const deleteOwner = async (settings, inputData) => {
    const { owner_id: ownerId } = inputData;
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for deletion.");

    // Dependency Check: Efficiently check if any item uses this owner
    const checkUrl = `${baseUrl}/items.json?owner_id=${ownerId}&_size=1&_shape=array`;
    try {
        const checkRes = await fetch(checkUrl, { headers: { 'Accept': 'application/json' } });
        if (!checkRes.ok) {
            console.error(`[${PROVIDER_NAME}]: Failed to perform dependency check for owner ${ownerId}: ${checkRes.status} ${await checkRes.text()}`);
            return { success: false, error: `Failed to check dependencies for owner: ${checkRes.statusText}` };
        }
        const usageCheckData = await checkRes.json();
        if (usageCheckData && usageCheckData.length > 0) {
            console.warn(`[${PROVIDER_NAME}]: Attempted to delete owner ${ownerId} which is used by items.`);
            return { success: false, errorCode: 'ENTITY_IN_USE' };
        }
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during dependency check for owner ${ownerId}:`, error);
        return { success: false, error: `Error checking dependencies for owner: ${error.message}` };
    }

    const deleteUrl = `${baseUrl}/owners/${ownerId}/-/delete`;
    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed for Datasette delete
    });

    // Use handleResponse, customizing operation and entity description
    await handleResponse(res, 'delete', `owner ID ${ownerId}`);
    return { success: true };
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

    // Fetch the newly created image by its UUID to get its ID and confirm creation
    const fetchedImage = await fetchRecordByUuidWithRetry(settings, "images", newUuid, "image_id,uuid", "image");

    return { imageId: fetchedImage.image_id, imageUuid: newUuid }; // Return imageId and the original newUuid used for insert
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
            console.error(`[${PROVIDER_NAME}]: Failed to process or insert image:`, error);
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
    const addResult = await handleResponse(itemRes, 'add', 'item');
    if (!addResult.success) {
        // This case should ideally be covered by handleResponse throwing an error
        throw new Error("Failed to add item, initial insert failed.");
    }

    // Fetch the newly created item by its UUID to get its ID and confirm creation details
    // newItemUuid was generated earlier. imageUuid was determined from _insertImage or was null.
    const fetchedItem = await fetchRecordByUuidWithRetry(settings, "items", newItemUuid, "item_id,uuid,image_uuid", "item");

    // fetchedItem.uuid should match newItemUuid.
    // fetchedItem.image_uuid is the actual image_uuid associated in the DB.
    return { success: true, newId: fetchedItem.item_id, uuid: newItemUuid, image_uuid: fetchedItem.image_uuid };
};


/**
 * Updates an item's details, including potentially the image.
 * Expects itemId and data like { name, description, location_id, category_id, owner_id, imageFile?, removeImage? }
 */
export const updateItem = async (settings, inputData) => { // data should NOT contain uuid
    const { item_id: itemId, ...data } = inputData;
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
        
        const existingImageId = currentItemData[itemId]?.image_id || null; // Use direct access
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
                // newImageId remains existingImageId
                // newImageUuid remains existingImageUuid (image content update doesn't change its UUID)
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

    const updateResult = await handleResponse(res, 'update', `item ID ${itemId}`);
    if (!updateResult.success) {
        // This case should ideally be covered by handleResponse throwing an error
        throw new Error(`Failed to update item ID ${itemId}, initial update failed.`);
    }

    // Fetch the updated image_uuid for the item
    // newImageUuid is known from the logic within updateItem
    return { success: true, image_uuid: newImageUuid }; // newImageUuid is determined earlier in the function
};

/**
 * Deletes an item record.
 */
export const deleteItem = async (settings, inputData) => {
    const { item_id: itemId } = inputData;
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for deletion.");

    // 1. Get the image_id associated with the item *before* deleting the item
    const itemRes = await fetch(`${baseUrl}/items/${itemId}.json?_shape=object&_select=image_id`); // Only need image_id
    if (itemRes.ok) {
        const itemData = await itemRes.json();
            const imageId = itemData[itemId]?.image_id || null; // Use direct access
        if (imageId) await _deleteImage(settings, imageId); // Delete image if it exists (handles its own errors)
    } // Ignore error if item not found, e.g., already deleted or inconsistent data.

    const deleteUrl = `${baseUrl}/items/${itemId}/-/delete`;

    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed
    });

    await handleResponse(res, 'delete', `item ID ${itemId}`);
    return { success: true };
};

// listItems: Remove options, pagination, filtering, sorting, and direct image fetching.
// It should return all item metadata.
export const listItems = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    try {
        // Fetch all items metadata. _shape=array fetches all columns by default.
        const itemsUrl = `${baseUrl}/items.json?_shape=array&_sort_desc=created_at&_ttl=0`; // Bypass cache
        const itemsRes = await fetch(itemsUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!itemsRes.ok) {
            const errorText = await itemsRes.text();
            throw new Error(`Failed to fetch items metadata: ${itemsRes.status} ${errorText}`);
        }
        const allItemsMetadata = await itemsRes.json();
            
        return allItemsMetadata || []; // Return metadata array
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error in Datasette listItems:`, error); // Keep provider prefix
        throw error;
    }
};

// New internal helper to get image by UUID
const _getImageByUuid = async (settings, imageUuid) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!imageUuid) {
        console.warn(`[${PROVIDER_NAME}]: _getImageByUuid called with no UUID.`);
        return null;
    }

    // Explicitly select required columns.
    const queryUrl = `${baseUrl}/images.json?uuid=${imageUuid}&_shape=array&_size=1&_select=image_data,image_mimetype,image_filename,uuid`;
    console.log(`[${PROVIDER_NAME}]: Fetching image with query: ${queryUrl}`); // Log the query

    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${PROVIDER_NAME}]: Failed to fetch image by UUID ${imageUuid}. Status: ${res.status}, Response: ${errorText}`);
        if (res.status === 404) {
            return null; // Explicitly return null on 404
        }
        // For other errors, throw to indicate a more significant problem
        throw new Error(`Failed to fetch image by UUID ${imageUuid}: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    if (!data) {
        console.warn(`[${PROVIDER_NAME}]: Image query for UUID ${imageUuid} returned non-array data (or null/undefined after parse):`, data);
        return null;
    }
    if (data.length === 0) {
        console.warn(`[${PROVIDER_NAME}]: Image query for UUID ${imageUuid} returned an empty array. No image found.`);
        return null;
    }

    const imageData = data[0];

    if (!imageData.image_data) {
        console.warn(`[${PROVIDER_NAME}]: Image data for UUID ${imageUuid} is missing 'image_data' field. Record:`, imageData);
        return null;
    }
    if (!imageData.image_mimetype) {
        console.warn(`[${PROVIDER_NAME}]: Image data for UUID ${imageUuid} is missing 'image_mimetype' field. Record:`, imageData);
        return null;
    }

    // If we reach here, we should have the necessary data
    try {
        const blob = base64ToBlob(imageData.image_data, imageData.image_mimetype);
        return { blob, filename: imageData.image_filename || `image_${imageUuid}` };
    } catch (e) {
        console.error(`[${PROVIDER_NAME}]: Error converting base64 to Blob for image UUID ${imageUuid}:`, e, "Image Data:", imageData);
        return null;
    }
};

// New exported method getImage
export const getImage = async (settings, inputData) => {
    const { image_uuid: imageUuid } = inputData;
    if (!imageUuid) return null;
    try {
        const imageDetails = await _getImageByUuid(settings, imageUuid);
        if (imageDetails && imageDetails.blob) {
            return new File([imageDetails.blob], imageDetails.filename, { type: imageDetails.blob.type });
        }
        return null;
    } catch (error) {
        console.error(`Error in getImage for UUID ${imageUuid}:`, error);
        // Depending on desired behavior, you might re-throw or return null
        // For robustness in UI, returning null might be preferable to crashing image display.
        return null;
    }
};


// --- Export/Import ---

export const exportData = async (settings) => {
    const zip = new JSZip();

    try {
        // 1. Fetch all data using existing list functions
        const locations = await listLocations(settings);
        const categories = await listCategories(settings);
        const owners = await listOwners(settings);
        // listItems now returns all item metadata without File objects.
        const itemsMetadata = await listItems(settings); // Changed variable name for clarity
        const allImagesMeta = await listImagesMetadata(settings);
        console.log(`[${PROVIDER_NAME}]: Starting export... Fetched all data.`);

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
                const imageFile = await getImage(settings, { image_uuid: item.image_uuid }); // Fetch the image File object
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
            sourceProvider: "datasette"
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        console.log(`[${PROVIDER_NAME}]: Export generated successfully.`);
        return blob;

    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during Datasette export:`, error);
        throw new Error(`Export failed: ${error.message}`);
    }
};

// Helper function to list only image metadata (id, uuid, filename, mimetype, created_at)
const listImagesMetadata = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const queryUrl = `${baseUrl}/images.json?_shape=array&_select=image_id,uuid,image_mimetype,image_filename,created_at&_sort=image_id&_ttl=0`; // Bypass cache
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${PROVIDER_NAME}]: Failed to fetch image metadata: ${res.status} ${errorText}`, res);
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
        console.log(`[${PROVIDER_NAME}]: Clearing existing Datasette data (Items first)...`);
        const existingItems = await listItems(settings);
        for (const item of existingItems) {
            await deleteItem(settings, { item_id: item.item_id }); // deleteItem also handles image deletion
        }
        console.log(`[${PROVIDER_NAME}]: Items cleared. Clearing Locations, Categories, Owners...`);
        const existingLocations = await listLocations(settings);
        for (const loc of existingLocations) await deleteLocation(settings, { location_id: loc.location_id });
        const existingCategories = await listCategories(settings);
        for (const cat of existingCategories) await deleteCategory(settings, { category_id: cat.category_id });
        const existingOwners = await listOwners(settings);
        for (const owner of existingOwners) await deleteOwner(settings, { owner_id: owner.owner_id });
        console.log(`[${PROVIDER_NAME}]: Existing data cleared.`);

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
                         console.warn(`[${PROVIDER_NAME}]: Blob type (${imageBlob.type}) differs from determined type (${determinedMimeType}) for file ${originalFilename}`);
                    } else if (!imageBlob.type) {
                         console.log(`[${PROVIDER_NAME}]: Determined MIME type ${determinedMimeType} for file ${originalFilename} (blob type was empty)`);
                    }

                } catch (zipError) {
                     console.error(`[${PROVIDER_NAME}]: Error processing image ${image_zip_filename} from zip:`, zipError);
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
                 console.warn(`[${PROVIDER_NAME}]: Skipping item "${item.name}" due to missing mapped ID (Location: ${location_id}=>${newItemData.location_id}, Category: ${category_id}=>${newItemData.category_id}, Owner: ${owner_id}=>${newItemData.owner_id})`);
                 continue; // Skip this item if any mapping failed
            }


            await addItem(settings, newItemData); // addItem handles image insertion
        }

        console.log(`[${PROVIDER_NAME}]: Import completed successfully.`);
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
        console.error(`[${PROVIDER_NAME}]: Error during Datasette import:`, error);
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
        console.log(`[${PROVIDER_NAME}]: Clearing existing Datasette data (Items first)...`);
        const existingItemsMetadata = await listItems(settings); // Gets all item metadata
        // Delete items first to handle associated images
        for (const item of existingItemsMetadata) { // Iterate over metadata
            await deleteItem(settings, { item_id: item.item_id }); // deleteItem also handles image deletion
        }
        console.log(`[${PROVIDER_NAME}]: Items (${existingItemsMetadata.length}) cleared. Clearing Locations, Categories, Owners...`);

        const existingLocations = await listLocations(settings);
        for (const loc of existingLocations) await deleteLocation(settings, { location_id: loc.location_id });
        console.log(`[${PROVIDER_NAME}]: Locations (${existingLocations.length}) cleared.`);

        const existingCategories = await listCategories(settings);
        for (const cat of existingCategories) await deleteCategory(settings, { category_id: cat.category_id });
        console.log(`[${PROVIDER_NAME}]: Categories (${existingCategories.length}) cleared.`);

        const existingOwners = await listOwners(settings);
        for (const owner of existingOwners) await deleteOwner(settings, { owner_id: owner.owner_id });
        console.log(`[${PROVIDER_NAME}]: Owners (${existingOwners.length}) cleared.`);

        console.log(`[${PROVIDER_NAME}]: Existing data cleared.`);
        return { success: true, summary: `All data successfully destroyed.` };

    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during Datasette data destruction:`, error);
        return { success: false, error: `Data destruction failed: ${error.message}. Data might be in an inconsistent state.` };
    }
};
