
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

// handleResponse updated to be more generic
const handleResponse = async (res, operation, entityDescription) => {
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to ${operation} ${entityDescription}: ${res.status} ${errorText}`);
    }
    console.log(`${entityDescription} ${operation} response status:`, res.status);
    // Datasette insert API doesn't return the created object by default,
    // but you could potentially parse the response if needed or configured.
    // For now, just return success status or basic info.
    // TODO: Consider using ?_returning=id if Datasette version supports it
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

const addImageInternal = async (settings, data) => {
    // Expects { image_data (string), image_mimetype }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Base64 encode the string data before sending
    const imageData = { row: { ...data, image_data: btoa(data.image_data) } };

    // Perform the insert
    const insertRes = await fetch(`${baseUrl}/images/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(imageData),
    });
     // Use updated handleResponse
     const insertResult = await handleResponse(insertRes, 'add', 'image');
     if (!insertResult.success) {
         throw new Error(`Image insert failed with status ${insertRes.status}`);
    }

    // After successful insert, fetch the latest image ID
    const queryUrl = `${baseUrl}/images.json?_sort_desc=image_id&_size=1`;
    const queryRes = await fetch(queryUrl, {
         method: 'GET',
         headers: { 'Accept': 'application/json' }
    });

    if (!queryRes.ok) {
        const errorText = await queryRes.text();
        console.error(`Failed to fetch latest image ID: ${queryRes.status} ${errorText}`, queryRes);
        throw new Error(`Failed to fetch latest image ID after insert: ${queryRes.status}`);
    }

    const queryData = await queryRes.json();
     if (!queryData.rows || queryData.rows.length === 0 || !queryData.rows[0].image_id) {
         console.error("Could not find image_id in query response:", queryData);
         throw new Error("Failed to retrieve image_id after insert.");
    }

    const newImageId = queryData.rows[0].image_id;
    console.log("Retrieved new image ID:", newImageId);

    // Return success status and the new ID
    return { success: true, status: insertRes.status, newId: newImageId };
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


export const addItem = async (settings, data) => {
    // Expects a composite object like:
    // {
    //   item: { name, description },
    //   location: { name, description },
    //   category: { name, description },
    //   image: { image_data, image_mimetype }
    // }
    // This provider handles adding location, category, image first, then the item.
    // It now retrieves the actual IDs after inserting related entities.
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    try {
        // 1. Add Location and get its ID using the exported function
        const locationResult = await addLocation(settings, data.location); // Use exported function
        const locationId = locationResult.newId;

        // 2. Add Category and get its ID using the exported function
        const categoryResult = await addCategory(settings, data.category); // Use exported function
        const categoryId = categoryResult.newId;

        // 3. Add Image and get its ID
        const imageResult = await addImageInternal(settings, data.image);
        const imageId = imageResult.newId;

        // 4. Add Item using the retrieved IDs and item data
        const itemRowData = {
            ...data.item,
            location_id: locationId,
            category_id: categoryId,
            image_id: imageId
        };
        const itemPayload = { row: itemRowData };

        const itemRes = await fetch(`${baseUrl}/items/-/insert`, {
            method: 'POST',
            headers: defaultHeaders(settings), // Pass settings object
            body: JSON.stringify(itemPayload),
        });

        // Use handleResponse for the final item insert result
        // Use updated handleResponse
        return handleResponse(itemRes, 'add', 'item');

    } catch (error) {
        // Log the specific error that occurred during the multi-step process
        console.error("Error during addItem multi-step process:", error);
        // Re-throw the error to be caught by the caller in App.jsx
        throw error;
    }
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

export const listItems = async (settings) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Use _shape=array for a simpler response structure (array of objects)
    const queryUrl = `${baseUrl}/items.json?_shape=array`; // Get all items
    const res = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch items: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to fetch items: ${res.status}`);
    }
    const data = await res.json();
    console.log("Fetched items:", data);
    return data; // Returns array of item objects
};


// Add functions for updateItem, deleteItem operations here later

/**
 * Adds a single item record with basic details.
 * Expects data like { name, description, location_id, category_id }
 */
export const addItemSimple = async (settings, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!data || !data.name || !data.location_id || !data.category_id) {
        throw new Error("Item name, location ID, and category ID are required.");
    }

    // Prepare the row data, ensuring description is null if empty
    const itemRowData = {
        name: data.name,
        description: data.description || null,
        location_id: data.location_id,
        category_id: data.category_id,
        image_id: null // Explicitly set image_id to null for now
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
 * Updates an item's name and description.
 * Expects itemId and data like { name, description }
 */
export const updateItem = async (settings, itemId, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!itemId) throw new Error("Item ID is required for update.");
    if (!data || !data.name) throw new Error("Item name is required for update.");

    const updateUrl = `${baseUrl}/items/${itemId}/-/update`;
    // Prepare update payload, ensuring description is null if empty
    const payload = {
        update: {
            name: data.name,
            description: data.description || null
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

    const deleteUrl = `${baseUrl}/items/${itemId}/-/delete`;

    const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: defaultHeaders(settings),
        // No body needed
    });

    return handleResponse(res, 'delete', `item ID ${itemId}`);
};
