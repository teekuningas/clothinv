
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
    // Expects { name, description, location_id, category_id, image_id }
    const itemData = { row: data };
    const res = await fetch(`${baseUrl}/items/-/insert`, {
        method: 'POST',
        headers: defaultHeaders(apiToken),
        body: JSON.stringify(itemData),
    });
    return handleResponse(res, 'item');
};

// Add functions for get, update, delete operations here later
