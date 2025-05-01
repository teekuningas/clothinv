
const defaultHeaders = (apiToken) => {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }
    return headers;
};

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

export const addLocation = async (baseUrl, apiToken, data) => {
    const locationData = { row: data }; // Expects { name, description }
    const res = await fetch(`${baseUrl}/locations/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(apiToken),
        body: JSON.stringify(locationData),
    });
    return handleResponse(res, 'location');
};

export const addCategory = async (baseUrl, apiToken, data) => {
    const categoryData = { row: data }; // Expects { name, description }
    const res = await fetch(`${baseUrl}/categories/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(apiToken),
        body: JSON.stringify(categoryData),
    });
    return handleResponse(res, 'category');
};

export const addImage = async (baseUrl, apiToken, data) => {
    // Expects { image_data (string), image_mimetype }
    // Base64 encode the string data before sending
    const imageData = { row: { ...data, image_data: btoa(data.image_data) } };
    const res = await fetch(`${baseUrl}/images/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(apiToken),
        body: JSON.stringify(imageData),
    });
    return handleResponse(res, 'image');
};

export const addItem = async (baseUrl, apiToken, data) => {
    // Expects a composite object like:
    // {
    //   item: { name, description },
    //   location: { name, description },
    //   category: { name, description },
    //   image: { image_data, image_mimetype }
    // }
    // This provider will handle adding location, category, image first,
    // then the item, assuming IDs = 1 for simplicity in this example.

    // 1. Add Location (using the existing function logic internally)
    await addLocation(baseUrl, apiToken, data.location);
    const assumedLocationId = 1; // Brittle assumption for example

    // 2. Add Category
    await addCategory(baseUrl, apiToken, data.category);
    const assumedCategoryId = 1; // Brittle assumption

    // 3. Add Image
    await addImage(baseUrl, apiToken, data.image);
    const assumedImageId = 1; // Brittle assumption

    // 4. Add Item using assumed IDs and item data
    const itemRowData = { ...data.item, location_id: assumedLocationId, category_id: assumedCategoryId, image_id: assumedImageId };
    const itemPayload = { row: itemRowData };
    const res = await fetch(`${baseUrl}/items/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(apiToken),
        body: JSON.stringify(itemPayload),
    });
    return handleResponse(res, 'item');
};

// Add functions for get, update, delete operations here later
