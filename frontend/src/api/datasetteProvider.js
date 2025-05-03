
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

// Assume createCSV is available (copy/import from localStorageProvider or use a library)
const createCSV = (headers, data) => {
    const headerRow = headers.join(',');
    const dataRows = data.map(row =>
        headers.map(header => {
            let value = row[header];
            if (value === null || typeof value === 'undefined') return '';
            value = String(value);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }
            return value;
        }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
};

// Assume parseCSV is available (copy/import from localStorageProvider or use PapaParse)
// Basic CSV parser (consider using a library like PapaParse for robustness)
const parseCSV = (csvString) => {
    const lines = csvString.trim().split('\n');
    if (lines.length < 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        // Very basic split, doesn't handle quoted commas correctly
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            let value = values[index] ? values[index].trim() : '';
            // Basic unquoting
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            // Attempt to convert numbers (adjust as needed)
            if (header.endsWith('_id') && value !== '') {
                row[header] = parseInt(value, 10);
            } else if (header.endsWith('_at') && value === '') {
                row[header] = null; // Handle empty timestamps as null
            } else {
                row[header] = value;
            }
        });
        data.push(row);
    }
    return data;
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
 * Internal: Inserts image data and filename, returns the new ID.
 */
const _insertImage = async (settings, base64Data, mimeType, filename) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const imageData = {
        row: {
            image_data: base64Data, // Store base64 string directly
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

    return queryData[0].image_id;
};

/**
 * Internal: Updates image data and filename for an existing image ID.
 */
const _updateImage = async (settings, imageId, base64Data, mimeType, filename) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");

    const updateUrl = `${baseUrl}/images/${imageId}/-/update`;
    const payload = {
        update: {
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
 */
export const addItem = async (settings, data) => {
    const baseUrl = settings?.datasetteBaseUrl;
    if (!baseUrl) throw new Error("Datasette Base URL is not configured.");
    if (!data || !data.name || !data.location_id || !data.category_id || !data.owner_id) {
        throw new Error("Item name, location ID, category ID, and owner ID are required.");
    }

    let imageId = null;
    if (data.imageFile instanceof File) { // Ensure it's a File object
        try {
            const base64Data = await readFileAsBase64(data.imageFile);
            // Pass filename to _insertImage
            imageId = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name);
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
                // Update existing image record, pass filename
                await _updateImage(settings, existingImageId, base64Data, data.imageFile.type, data.imageFile.name);
                newImageId = existingImageId; // ID remains the same
            } else {
                // Insert new image record, pass filename
                newImageId = await _insertImage(settings, base64Data, data.imageFile.type, data.imageFile.name);
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

        // Helper function to convert base64 to Blob
        const base64ToBlob = (base64, mimeType) => {
            try {
                const byteCharacters = atob(base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                return new Blob([byteArray], { type: mimeType });
            } catch (e) {
                console.error("Error converting base64 to Blob:", e);
                return null;
            }
        };

        // 2. Fetch all images (including filename)
        const imagesUrl = `${baseUrl}/images.json?_shape=array`;
        const imagesRes = await fetch(imagesUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        let imageMap = {};
        if (imagesRes.ok) {
            const imagesData = await imagesRes.json();
            // 3. Create a map of image_id -> { blob, filename }
            imageMap = imagesData.reduce((map, img) => {
                if (img.image_id && img.image_data && img.image_mimetype) {
                    const blob = base64ToBlob(img.image_data, img.image_mimetype);
                    if (blob) {
                        map[img.image_id] = {
                            blob: blob,
                            filename: img.image_filename || `image_${img.image_id}` // Use stored filename or generate one
                        };
                    }
                }
                return map;
            }, {});
        } else {
            console.warn(`Failed to fetch images: ${imagesRes.status}. Items will be listed without images.`);
        }


        // 4. Merge image File object into items
        const itemsWithFiles = itemsData.map(item => {
            let imageFile = null;
            if (item.image_id && imageMap[item.image_id]) {
                const { blob, filename } = imageMap[item.image_id];
                // Create a File object from the Blob
                imageFile = new File([blob], filename, { type: blob.type });
            }
            // Remove old image properties and add imageFile
            const { image_data, image_mimetype, ...restOfItem } = item; // eslint-disable-line no-unused-vars
            return {
                ...restOfItem,
                imageFile: imageFile // Add the File object (or null)
            };
        });

        console.log(`Fetched ${itemsWithFiles.length} items and converted images to File objects.`);
        return itemsWithFiles; // Returns array of item objects including imageFile property

    } catch (error) {
        // Log the error and re-throw or return empty array based on desired handling
        console.error("Error in listItems:", error);
        throw error; // Re-throw the error to be caught by the component
        // Or return []; // To show an empty list in case of error
    }
};

// --- Export/Import ---

export const exportData = async (settings) => {
    console.log('DatasetteProvider: exportData called');
    const zip = new JSZip();

    try {
        // 1. Fetch all data using existing list functions
        const locations = await listLocations(settings);
        const categories = await listCategories(settings);
        const owners = await listOwners(settings);
        const items = await listItems(settings); // This includes imageFile objects

        // 2. Create CSVs
        const locationHeaders = ['location_id', 'name', 'description'];
        zip.file('locations.csv', createCSV(locationHeaders, locations));

        const categoryHeaders = ['category_id', 'name', 'description'];
        zip.file('categories.csv', createCSV(categoryHeaders, categories));

        const ownerHeaders = ['owner_id', 'name', 'description'];
        zip.file('owners.csv', createCSV(ownerHeaders, owners));

        const itemHeaders = ['item_id', 'name', 'description', 'location_id', 'category_id', 'owner_id', 'image_zip_filename', 'image_original_filename', 'created_at', 'updated_at'];
        const itemsForCsv = [];
        const imagesFolder = zip.folder('images');

        for (const item of items) {
            const itemCsvRow = { ...item };
            itemCsvRow.image_zip_filename = '';
            itemCsvRow.image_original_filename = '';

            if (item.imageFile instanceof File) {
                const fileExtension = item.imageFile.name.split('.').pop() || 'bin';
                const zipFilename = `${item.item_id}.${fileExtension}`;
                itemCsvRow.image_zip_filename = zipFilename;
                itemCsvRow.image_original_filename = item.imageFile.name;
                imagesFolder.file(zipFilename, item.imageFile);
            }
            // Remove the File object before adding to CSV data
            delete itemCsvRow.imageFile;
            itemsForCsv.push(itemCsvRow);
        }
        zip.file('items.csv', createCSV(itemHeaders, itemsForCsv));

        // 3. Create Manifest
        const manifest = {
            exportFormatVersion: "1.0",
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

export const importData = async (settings, zipFile) => {
    console.log('DatasetteProvider: importData called');
    const zip = new JSZip();
    try {
        const loadedZip = await zip.loadAsync(zipFile);

        // Validate essential files
        if (!loadedZip.file('manifest.json') || !loadedZip.file('items.csv') || !loadedZip.file('locations.csv') || !loadedZip.file('categories.csv') || !loadedZip.file('owners.csv')) {
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

        const locations = parseCSV(await loadedZip.file('locations.csv').async('string'));
        for (const loc of locations) {
            const { location_id: exportedId, ...locData } = loc;
            const result = await addLocation(settings, locData);
            if (result.success) locationMap[exportedId] = result.newId;
            else throw new Error(`Failed to import location: ${loc.name}`);
        }

        const categories = parseCSV(await loadedZip.file('categories.csv').async('string'));
        for (const cat of categories) {
            const { category_id: exportedId, ...catData } = cat;
            const result = await addCategory(settings, catData);
            if (result.success) categoryMap[exportedId] = result.newId;
            else throw new Error(`Failed to import category: ${cat.name}`);
        }

        const owners = parseCSV(await loadedZip.file('owners.csv').async('string'));
        for (const owner of owners) {
            const { owner_id: exportedId, ...ownerData } = owner;
            const result = await addOwner(settings, ownerData);
            if (result.success) ownerMap[exportedId] = result.newId;
            else throw new Error(`Failed to import owner: ${owner.name}`);
        }

        const items = parseCSV(await loadedZip.file('items.csv').async('string'));
        for (const item of items) {
            const { item_id, image_zip_filename, image_original_filename, location_id, category_id, owner_id, ...itemMetadata } = item;

            let imageFile = null;
            if (image_zip_filename && loadedZip.file(`images/${image_zip_filename}`)) {
                const imageBlob = await loadedZip.file(`images/${image_zip_filename}`).async('blob');
                imageFile = new File([imageBlob], image_original_filename || image_zip_filename, { type: imageBlob.type });
            }

            const newItemData = {
                ...itemMetadata,
                location_id: locationMap[location_id], // Map to new ID
                category_id: categoryMap[category_id], // Map to new ID
                owner_id: ownerMap[owner_id],       // Map to new ID
                imageFile: imageFile
            };

            // Ensure mapped IDs are valid before adding
            if (!newItemData.location_id || !newItemData.category_id || !newItemData.owner_id) {
                 console.warn(`Skipping item "${item.name}" due to missing mapped ID (Location: ${location_id}=>${newItemData.location_id}, Category: ${category_id}=>${newItemData.category_id}, Owner: ${owner_id}=>${newItemData.owner_id})`);
                 continue; // Skip this item if any mapping failed
            }


            await addItem(settings, newItemData); // addItem handles image insertion
        }

        console.log('DatasetteProvider: Import completed successfully.');
        return { success: true, summary: `Import successful. Replaced data with ${locations.length} locations, ${categories.length} categories, ${owners.length} owners, ${items.length} items.` };

    } catch (error) {
        console.error("Error during Datasette import:", error);
        // Datasette rollback is complex, data might be partially imported/deleted.
        return { success: false, error: `Import failed: ${error.message}. Data might be in an inconsistent state.` };
    }
};
import JSZip from 'jszip';
