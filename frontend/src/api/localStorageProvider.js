
// --- Helper Functions ---

// Helper to read file as Base64
const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return resolve(null); // Resolve with null if no file provided
        }
        const reader = new FileReader();
        // Return object with data and mimetype
        reader.onload = () => resolve({
            base64Data: reader.result.split(',')[1], // Get only the base64 part
            mimeType: file.type
        });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};


const _getData = (key) => {
    // Placeholder: Logic to get data array from localStorage
    console.log(`localStorageProvider: _getData called for key: ${key}`);
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error(`Error reading localStorage key "${key}":`, e);
        return [];
    }
};

const _setData = (key, data) => {
    // Placeholder: Logic to save data array to localStorage
    console.log(`localStorageProvider: _setData called for key: ${key}`);
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error writing localStorage key "${key}":`, e);
        // Handle potential storage limits or errors
    }
};

const _getNextId = (key) => {
    // Placeholder: Logic to get the next available ID
    console.log(`localStorageProvider: _getNextId called for key: ${key}_id_counter`);
    const counterKey = `${key}_id_counter`;
    let nextId = parseInt(localStorage.getItem(counterKey) || '0', 10) + 1;
    localStorage.setItem(counterKey, nextId.toString());
    return nextId;
};

// --- Exported API Methods (Matching Datasette Provider Interface) ---
// Note: All functions accept 'settings' as the first argument, even if unused,
// because ApiContext binds them this way.

export const listLocations = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: listLocations called');
    return Promise.resolve(_getData('locations'));
};

export const addLocation = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: addLocation called with data:', data);
    const newId = _getNextId('locations');
    // Add timestamps if desired, though not strictly required by current UI for these
    const newLocation = { ...data, location_id: newId /*, created_at: new Date().toISOString() */ };
    const locations = _getData('locations');
    _setData('locations', [...locations, newLocation]);
    return Promise.resolve({ success: true, newId: newId });
};

export const updateLocation = async (settings, locationId, data) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: updateLocation called for ID ${locationId} with data:`, data);
    const locations = _getData('locations');
    let found = false;
    const updatedLocations = locations.map(loc => {
        if (loc.location_id === locationId) {
            found = true;
            // Add updated_at timestamp if desired
            return { ...loc, ...data /*, updated_at: new Date().toISOString() */ };
        }
        return loc;
    });
    if (!found) {
         return Promise.resolve({ success: false, message: 'Location not found' });
    }
    _setData('locations', updatedLocations);
    return Promise.resolve({ success: true });
};

export const deleteLocation = async (settings, locationId) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: deleteLocation called for ID ${locationId}`);
    const items = _getData('items');
    // Check if any item uses this location
    const isUsed = items.some(item => item.location_id === locationId);
    if (isUsed) {
        console.warn(`Attempted to delete location ID ${locationId} which is in use.`);
        // Provide a user-friendly message
        return Promise.resolve({ success: false, message: 'Cannot delete location: It is currently assigned to one or more items.' });
    }

    const locations = _getData('locations');
    const updatedLocations = locations.filter(loc => loc.location_id !== locationId);
    // Check if anything was actually deleted
    if (locations.length === updatedLocations.length) {
         return Promise.resolve({ success: false, message: 'Location not found' });
    }
    _setData('locations', updatedLocations);
    return Promise.resolve({ success: true });
};

export const listCategories = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: listCategories called');
    return Promise.resolve(_getData('categories'));
};

export const addCategory = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: addCategory called with data:', data);
    const newId = _getNextId('categories');
    const newCategory = { ...data, category_id: newId /*, created_at: new Date().toISOString() */ };
    const categories = _getData('categories');
    _setData('categories', [...categories, newCategory]);
    return Promise.resolve({ success: true, newId: newId });
};

export const updateCategory = async (settings, categoryId, data) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: updateCategory called for ID ${categoryId} with data:`, data);
    const categories = _getData('categories');
    let found = false;
    const updatedCategories = categories.map(cat => {
        if (cat.category_id === categoryId) {
            found = true;
            return { ...cat, ...data /*, updated_at: new Date().toISOString() */ };
        }
        return cat;
    });
     if (!found) {
         return Promise.resolve({ success: false, message: 'Category not found' });
    }
    _setData('categories', updatedCategories);
    return Promise.resolve({ success: true });
};

export const deleteCategory = async (settings, categoryId) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: deleteCategory called for ID ${categoryId}`);
    const items = _getData('items');
    // Check if any item uses this category
    const isUsed = items.some(item => item.category_id === categoryId);
    if (isUsed) {
        console.warn(`Attempted to delete category ID ${categoryId} which is in use.`);
        return Promise.resolve({ success: false, message: 'Cannot delete category: It is currently assigned to one or more items.' });
    }

    const categories = _getData('categories');
    const updatedCategories = categories.filter(cat => cat.category_id !== categoryId);
     if (categories.length === updatedCategories.length) {
         return Promise.resolve({ success: false, message: 'Category not found' });
    }
    _setData('categories', updatedCategories);
    return Promise.resolve({ success: true });
};

export const listOwners = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: listOwners called');
    return Promise.resolve(_getData('owners'));
};

export const addOwner = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: addOwner called with data:', data);
    const newId = _getNextId('owners');
    const newOwner = { ...data, owner_id: newId /*, created_at: new Date().toISOString() */ };
    const owners = _getData('owners');
    _setData('owners', [...owners, newOwner]);
    return Promise.resolve({ success: true, newId: newId });
};

export const updateOwner = async (settings, ownerId, data) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: updateOwner called for ID ${ownerId} with data:`, data);
    const owners = _getData('owners');
    let found = false;
    const updatedOwners = owners.map(owner => {
        if (owner.owner_id === ownerId) {
            found = true;
            return { ...owner, ...data /*, updated_at: new Date().toISOString() */ };
        }
        return owner;
    });
     if (!found) {
         return Promise.resolve({ success: false, message: 'Owner not found' });
    }
    _setData('owners', updatedOwners);
    return Promise.resolve({ success: true });
};

export const deleteOwner = async (settings, ownerId) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: deleteOwner called for ID ${ownerId}`);
    const items = _getData('items');
    // Check if any item uses this owner
    const isUsed = items.some(item => item.owner_id === ownerId);
    if (isUsed) {
        console.warn(`Attempted to delete owner ID ${ownerId} which is in use.`);
        return Promise.resolve({ success: false, message: 'Cannot delete owner: They are currently assigned to one or more items.' });
    }

    const owners = _getData('owners');
    const updatedOwners = owners.filter(owner => owner.owner_id !== ownerId);
     if (owners.length === updatedOwners.length) {
         return Promise.resolve({ success: false, message: 'Owner not found' });
    }
    _setData('owners', updatedOwners);
    return Promise.resolve({ success: true });
};

export const listItems = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: listItems called');
    // Because images are embedded, just return the items array
    const items = _getData('items');
    // Optional: Sort by creation date descending, like datasetteProvider
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve(items);
};

export const addItem = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('localStorageProvider: addItem called with data:', data);
    const newId = _getNextId('items');
    let image_data = null;
    let image_mimetype = null;

    // Process image file if it exists
    if (data.imageFile) {
        try {
            const imageResult = await readFileAsBase64(data.imageFile);
            if (imageResult) {
                image_data = imageResult.base64Data;
                image_mimetype = imageResult.mimeType;
            }
        } catch (error) {
            console.error("Failed to read image file:", error);
            // Decide how to handle: fail the add, or add without image?
            // Let's fail for now to be safe.
            return Promise.resolve({ success: false, message: `Failed to process image: ${error.message}` });
        }
    }

    // Create the new item object, excluding the temporary 'imageFile' property
    const { imageFile, ...restOfData } = data;
    const newItem = {
        ...restOfData, // name, description, location_id, category_id, owner_id
        item_id: newId,
        image_data: image_data, // Embed base64 data
        image_mimetype: image_mimetype, // Embed mime type
        created_at: new Date().toISOString(),
        updated_at: null // Explicitly set updated_at to null on creation
    };

    const items = _getData('items');
    _setData('items', [...items, newItem]);
    return Promise.resolve({ success: true, newId: newId });
};

export const updateItem = async (settings, itemId, data) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: updateItem called for ID ${itemId} with data:`, data);
    const items = _getData('items');
    const itemIndex = items.findIndex(item => item.item_id === itemId);

    if (itemIndex === -1) {
        return Promise.resolve({ success: false, message: 'Item not found' });
    }

    const currentItem = items[itemIndex];
    let new_image_data = currentItem.image_data;
    let new_image_mimetype = currentItem.image_mimetype;

    // Handle image removal first
    if (data.removeImage) {
        new_image_data = null;
        new_image_mimetype = null;
    }
    // Handle new image upload (overrides removal if both flags/files are present)
    if (data.imageFile) {
         try {
            const imageResult = await readFileAsBase64(data.imageFile);
             if (imageResult) {
                new_image_data = imageResult.base64Data;
                new_image_mimetype = imageResult.mimeType;
             } else {
                 // If readFileAsBase64 returns null (e.g., empty file), clear image
                 new_image_data = null;
                 new_image_mimetype = null;
             }
        } catch (error) {
            console.error("Failed to read image file during update:", error);
            return Promise.resolve({ success: false, message: `Failed to process image update: ${error.message}` });
        }
    }

    // Create the updated item object
    // Exclude temporary flags/files ('imageFile', 'removeImage') from being saved
    const { imageFile, removeImage, ...restOfData } = data;
    const updatedItem = {
        ...currentItem,
        ...restOfData, // Update with new name, description, location_id, etc.
        image_data: new_image_data,
        image_mimetype: new_image_mimetype,
        updated_at: new Date().toISOString() // Set update timestamp
    };

    // Update the array immutably
    const updatedItems = [
        ...items.slice(0, itemIndex),
        updatedItem,
        ...items.slice(itemIndex + 1)
    ];

    _setData('items', updatedItems);
    return Promise.resolve({ success: true });
};

export const deleteItem = async (settings, itemId) => { // eslint-disable-line no-unused-vars
    console.log(`localStorageProvider: deleteItem called for ID ${itemId}`);
    const items = _getData('items');
    const updatedItems = items.filter(item => item.item_id !== itemId);
    // No need for separate image deletion logic as it's embedded
     if (items.length === updatedItems.length) {
         return Promise.resolve({ success: false, message: 'Item not found' });
    }
    _setData('items', updatedItems);
    return Promise.resolve({ success: true });
};
