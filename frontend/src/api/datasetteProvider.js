
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

// Helper to read file as Base64 (used within provider functions)
const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Get only the base64 part
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
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

// Note: addLocationInternal was removed and replaced by the exported addLocation below.

// Rename and export this function
export const addCategory = async (settings, data) => { // Rename to addCategory and export
    const categoryData = { row: data }; // Expects { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Perform the insert
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

    // Return success status and the new ID
    return { success: true, status: insertRes.status, newId: newCategoryId };
};

// --- Exported API Methods (Bound by ApiContext) ---
// These are the functions listed in the providerRegistry 'methods' array.
// They receive the 'settings' object as the first argument from ApiContext.

export const addLocation = async (settings, data) => {
    const locationData = { row: data }; // Expects { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Perform the insert
    const insertRes = await fetch(`${baseUrl}/locations/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Pass the whole settings object
        body: JSON.stringify(locationData),
    });
    // Use handleResponse for initial check, but we need the ID later
    // Use updated handleResponse
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

    // Return success status and the new ID
    return { success: true, status: insertRes.status, newId: newLocationId };
};

export const listLocations = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/locations.json?_shape=array`;
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
    // The response is already the array of location objects thanks to _shape=array
    console.log("Fetched locations:", data);
    return data; // Returns array like [{location_id: 1, name: 'Closet', ...}, ...]
};

export const updateLocation = async (settings, locationId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!locationId) throw new Error("Location ID is required for update.");

    const updateUrl = `${baseUrl}/locations/${locationId}/-/update`;
    const payload = { update: data }; // Datasette expects update data under the 'update' key

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
    const queryUrl = `${baseUrl}/categories.json?_shape=array`;
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
    // The response is already the array of category objects thanks to _shape=array
    console.log("Fetched categories:", data);
    return data; // Returns array like [{category_id: 1, name: 'Tops', ...}, ...]
};

export const updateCategory = async (settings, categoryId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!categoryId) throw new Error("Category ID is required for update.");

    const updateUrl = `${baseUrl}/categories/${categoryId}/-/update`;
    const payload = { update: data }; // Datasette expects update data under the 'update' key

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
    const queryUrl = `${baseUrl}/owners.json?_shape=array`;
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
    // The response is already the array of owner objects thanks to _shape=array
    console.log("Fetched owners:", data);
    return data; // Returns array like [{owner_id: 1, name: 'Alice', ...}, ...]
};

export const addOwner = async (settings, data) => { // Rename to addOwner and export
    const ownerData = { row: data }; // Expects { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Perform the insert
    const insertRes = await fetch(`${baseUrl}/owners/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(ownerData),
    });
    // Use updated handleResponse
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

    // Return success status and the new ID
    return { success: true, status: insertRes.status, newId: newOwnerId };
};

export const updateOwner = async (settings, ownerId, data) => {
    // Expects data like { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!ownerId) throw new Error("Owner ID is required for update.");

    const updateUrl = `${baseUrl}/owners/${ownerId}/-/update`;
    const payload = { update: data }; // Datasette expects update data under the 'update' key

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
 * Internal: Inserts image data and returns the new ID.
 */
const _insertImage = async (settings, base64Data, mimeType) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const imageData = {
        row: {
            image_data: base64Data, // Store base64 string directly
            image_mimetype: mimeType,
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

    return queryData[0].image_id;
};

/**
 * Internal: Updates image data for an existing image ID.
 */
const _updateImage = async (settings, imageId, base64Data, mimeType) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const updateUrl = `${baseUrl}/images/${imageId}/-/update`;
    const payload = {
        update: {
            image_data: base64Data,
            image_mimetype: mimeType,
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
 */
export const addItem = async (settings, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required.");
    }

    let imageId = null;
    if (data.imageFile) {
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            imageId = await _insertImage(settings, base64Data, data.imageFile.type);
        } catch (error) {
            console.error("Failed to process or insert image:", error);
            throw new Error(`Failed to handle image upload: ${error.message}`);
        }
    }

    // Prepare the row data, ensuring description is null if empty
    const itemRowData = {
        name: data.name,
        description: data.description || null,
        location_id: data.location_id,
        category_id: data.category_id,
        owner_id: data.owner_id, // Add owner_id
        image_id: imageId // Use the inserted image ID or null
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
export const updateItem = async (settings, itemId, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for update.");
    // Add checks for location_id and category_id if they are mandatory for update
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required for update.");
    }

    // Fetch current item data to get existing image_id
    const currentItemRes = await fetch(`${baseUrl}/items/${itemId}.json?_shape=object`, { headers: { 'Accept': 'application/json' } });
    if (!currentItemRes.ok) throw new Error(`Failed to fetch current item data for update: ${currentItemRes.status}`);
    const currentItemData = await currentItemRes.json();
    const existingImageId = currentItemData[itemId]?.image_id; // Datasette object shape

    let newImageId = existingImageId; // Assume image doesn't change initially

    if (data.removeImage && existingImageId) {
        await _deleteImage(settings, existingImageId);
        newImageId = null;
    } else if (data.imageFile) {
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            if (existingImageId) {
                // Update existing image record
                await _updateImage(settings, existingImageId, base64Data, data.imageFile.type);
                newImageId = existingImageId; // ID remains the same
            } else {
                // Insert new image record
                newImageId = await _insertImage(settings, base64Data, data.imageFile.type);
            }
        } catch (error) {
            console.error("Failed to process or update/insert image:", error);
            throw new Error(`Failed to handle image update: ${error.message}`);
        }
    }

    const updateUrl = `${baseUrl}/items/${itemId}/-/update`;
    const payload = {
        update: {
            name: data.name,
            description: data.description || null,
            location_id: data.location_id, category_id: data.category_id, owner_id: data.owner_id,
            image_id: newImageId, // Set the potentially updated image ID
            updated_at: new Date().toISOString() // Add the current timestamp
        }
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
    const itemRes = await fetch(`${baseUrl}/items/${itemId}.json?_shape=object`);
    if (itemRes.ok) {
        const itemData = await itemRes.json();
        const imageId = itemData[itemId]?.image_id;
        if (imageId) await _deleteImage(settings, imageId); // Delete image if it exists
    } // Ignore error if item not found

    const deleteUrl = `${baseUrl}/items/${itemId}/-/delete`;

    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed
    });

    return handleResponse(res, 'delete', `item ID ${itemId}`);
};

export const listItems = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    try {
        // 1. Fetch all items (basic data + image_id)
        const itemsUrl = `${baseUrl}/items.json?_shape=array&_sort_desc=created_at`;
        const itemsRes = await fetch(itemsUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!itemsRes.ok) {
            const errorText = await itemsRes.text();
            console.error(`Failed to fetch items: ${itemsRes.status} ${errorText}`, itemsRes);
            throw new Error(`Failed to fetch items: ${itemsRes.status}`);
        }
        const itemsData = await itemsRes.json();

        // If no items, return early
        if (!itemsData || itemsData.length === 0) {
            console.log("Fetched 0 items.");
            return [];
        }

        // 2. Fetch all images (only needed if there are items)
        const imagesUrl = `${baseUrl}/images.json?_shape=array`;
        const imagesRes = await fetch(imagesUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!imagesRes.ok) {
            // Log warning but proceed, images might be missing
            console.warn(`Failed to fetch images: ${imagesRes.status}. Items will be listed without images.`);
            // Return items without image data attached
             return itemsData;
        }
        const imagesData = await imagesRes.json();

        // 3. Create a map of image_id -> { image_data, image_mimetype }
        const imageMap = imagesData.reduce((map, img) => {
            if (img.image_id) {
                map[img.image_id] = {
                    image_data: img.image_data,
                    image_mimetype: img.image_mimetype
                };
            }
            return map;
        }, {});

        // 4. Merge image data into items
        const itemsWithImages = itemsData.map(item => {
            if (item.image_id && imageMap[item.image_id]) {
                return {
                    ...item,
                    image_data: imageMap[item.image_id].image_data,
                    image_mimetype: imageMap[item.image_id].image_mimetype
                };
            }
            // Return item as is if no image_id or image not found in map
            return item;
        });

        console.log(`Fetched ${itemsWithImages.length} items and merged image data.`);
        return itemsWithImages; // Returns array of item objects including image data/mimetype

    } catch (error) {
        // Log the error and re-throw or return empty array based on desired handling
        console.error("Error in listItems:", error);
        throw error; // Re-throw the error to be caught by the component
        // Or return []; // To show an empty list in case of error
    }
};
