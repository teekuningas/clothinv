
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

const addLocationInternal = async (settings, data) => {
    const locationData = { row: data }; // Expects { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const res = await fetch(`${baseUrl}/locations/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Pass the whole settings object
        body: JSON.stringify(locationData),
    });
    return handleResponse(res, 'location');
};

const addCategoryInternal = async (settings, data) => {
    const categoryData = { row: data }; // Expects { name, description }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const res = await fetch(`${baseUrl}/categories/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(categoryData),
    });
    return handleResponse(res, 'category');
};

const addImageInternal = async (settings, data) => {
    // Expects { image_data (string), image_mimetype }
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    // Base64 encode the string data before sending
    const imageData = { row: { ...data, image_data: btoa(data.image_data) } };
    const res = await fetch(`${baseUrl}/images/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings),
        body: JSON.stringify(imageData),
    });
    return handleResponse(res, 'image');
};


// --- Exported API Methods (Bound by ApiContext) ---
// These are the functions listed in the providerRegistry 'methods' array.
// They receive the 'settings' object as the first argument from ApiContext.

export const addItem = async (settings, data) => {
    // Expects a composite object like:
    // {
    //   item: { name, description },
    //   location: { name, description },
    //   category: { name, description },
    //   image: { image_data, image_mimetype }
    // }
    // This provider handles adding location, category, image first, then the item.
    // It still uses the brittle assumption of ID=1 for this example.
    // It now calls the internal helper functions, passing the 'settings' object.
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");


    // 1. Add Location
    await addLocationInternal(settings, data.location);
    const assumedLocationId = 1; // Brittle assumption

    // 2. Add Category
    await addCategoryInternal(settings, data.category);
    const assumedCategoryId = 1; // Brittle assumption

    // 3. Add Image
    await addImageInternal(settings, data.image);
    const assumedImageId = 1; // Brittle assumption

    // 4. Add Item using assumed IDs and item data
    const itemRowData = { ...data.item, location_id: assumedLocationId, category_id: assumedCategoryId, image_id: assumedImageId };
    const itemPayload = { row: itemRowData };

    const res = await fetch(`${baseUrl}/items/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(settings), // Pass settings object
        body: JSON.stringify(itemPayload),
    });
    return handleResponse(res, 'item'); // Use the same response handler
};

// Add functions for get, update, delete operations here later
