
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

// handleResponse remains the same conceptually
const handleResponse = async (res, entityName) => {
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to add ${entityName}: ${res.status} ${errorText}`, res);
        throw new Error(`Failed to add ${entityName}: ${res.status} ${errorText}`);
    }
    console.log(`${entityName} add response status:`, res.status);
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
    const insertResult = await handleResponse(insertRes, 'category');
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
     const insertResult = await handleResponse(insertRes, 'image');
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
    const insertResult = await handleResponse(insertRes, 'location');
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
        return handleResponse(itemRes, 'item');

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
    console.warn('updateLocation is not yet implemented for datasetteProvider.');
    // Simulate success for now, or throw an error
    // throw new Error('updateLocation not implemented');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    return { success: true, message: 'Update not implemented' };
};

export const deleteLocation = async (settings, locationId) => {
    console.warn('deleteLocation is not yet implemented for datasetteProvider.');
    // Simulate success for now, or throw an error
    // throw new Error('deleteLocation not implemented');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    return { success: true, message: 'Delete not implemented' };
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
    console.warn('updateCategory is not yet implemented for datasetteProvider.');
    // Simulate success for now, or throw an error
    // throw new Error('updateCategory not implemented');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    return { success: true, message: 'Update not implemented' };
};

export const deleteCategory = async (settings, categoryId) => {
    console.warn('deleteCategory is not yet implemented for datasetteProvider.');
    // Simulate success for now, or throw an error
    // throw new Error('deleteCategory not implemented');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    return { success: true, message: 'Delete not implemented' };
};


// Add functions for getItems, updateItem, deleteItem operations here later
