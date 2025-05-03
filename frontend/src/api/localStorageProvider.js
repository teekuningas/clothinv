
// --- IndexedDB Setup ---
const DB_NAME = 'ClothingInventoryDB';
const DB_VERSION = 1; // Increment this if schema changes
const STORES = {
    items: 'items',
    images: 'images',
    locations: 'locations',
    categories: 'categories',
    owners: 'owners',
};
const ID_COUNTERS_KEY_PREFIX = 'indexeddb_id_counter_'; // Use different prefix from localStorageProvider

let dbPromise = null;

const openDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(`IndexedDB error: ${event.target.error}`);
        };

        request.onsuccess = (event) => {
            console.log("IndexedDB opened successfully");
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            console.log("IndexedDB upgrade needed");
            const db = event.target.result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.items)) {
                // Use item_id as the key path
                db.createObjectStore(STORES.items, { keyPath: 'item_id' });
                // Example: Create index for searching/sorting if needed later
                // store.createIndex('name', 'name', { unique: false });
                // store.createIndex('created_at', 'created_at');
            }
            if (!db.objectStoreNames.contains(STORES.images)) {
                // Use item_id as the key (images are 1:1 with items)
                db.createObjectStore(STORES.images);
            }
            if (!db.objectStoreNames.contains(STORES.locations)) {
                db.createObjectStore(STORES.locations, { keyPath: 'location_id' });
            }
            if (!db.objectStoreNames.contains(STORES.categories)) {
                db.createObjectStore(STORES.categories, { keyPath: 'category_id' });
            }
             if (!db.objectStoreNames.contains(STORES.owners)) {
                db.createObjectStore(STORES.owners, { keyPath: 'owner_id' });
            }
            console.log("IndexedDB upgrade complete");
        };
    });
    return dbPromise;
};

// --- Helper Functions for IndexedDB Operations ---

// Generic function to get all records from a store
const getAllFromStore = async (storeName) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => {
            console.error(`Error getting all from ${storeName}:`, event.target.error);
            reject(`Error getting all from ${storeName}: ${event.target.error}`);
        };
    });
};

// Generic function to add a record to a store
const addToStore = async (storeName, record) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(record);

        request.onsuccess = () => resolve({ success: true, id: request.result }); // request.result is the key
        request.onerror = (event) => {
            console.error(`Error adding to ${storeName}:`, event.target.error);
            reject(`Error adding to ${storeName}: ${event.target.error}`);
        };
    });
};

// Generic function to update a record in a store (using keyPath)
const updateInStore = async (storeName, record) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(record); // put() updates if key exists, adds otherwise

        request.onsuccess = () => resolve({ success: true });
        request.onerror = (event) => {
            console.error(`Error updating in ${storeName}:`, event.target.error);
            reject(`Error updating in ${storeName}: ${event.target.error}`);
        };
    });
};

// Generic function to delete a record from a store by key
const deleteFromStore = async (storeName, key) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve({ success: true });
        request.onerror = (event) => {
            // Handle "NotFoundError" gracefully if needed (trying to delete non-existent key)
            if (event.target.error.name === 'NotFoundError') {
                 console.warn(`Key ${key} not found in ${storeName} for deletion.`);
                 resolve({ success: true }); // Still consider it a success
            } else {
                console.error(`Error deleting ${key} from ${storeName}:`, event.target.error);
                reject(`Error deleting ${key} from ${storeName}: ${event.target.error}`);
            }
        };
    });
};

// Function to get a specific record by key
const getFromStore = async (storeName, key) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result); // Returns the record or undefined
        request.onerror = (event) => {
            console.error(`Error getting ${key} from ${storeName}:`, event.target.error);
            reject(`Error getting ${key} from ${storeName}: ${event.target.error}`);
        };
    });
};


// --- ID Generation (using localStorage for simplicity) ---
const _getNextId = (key) => {
    const counterKey = `${ID_COUNTERS_KEY_PREFIX}${key}`;
    let nextId = parseInt(localStorage.getItem(counterKey) || '0', 10) + 1;
    localStorage.setItem(counterKey, nextId.toString());
    console.log(`Generated next ID for ${key}: ${nextId}`);
    return nextId;
};

// --- Exported API Methods ---

// Locations
export const listLocations = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: listLocations called');
    return getAllFromStore(STORES.locations);
};

export const addLocation = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: addLocation called with data:', data);
    const newId = _getNextId('locations');
    const newLocation = { ...data, location_id: newId };
    await addToStore(STORES.locations, newLocation);
    return { success: true, newId: newId };
};

export const updateLocation = async (settings, locationId, data) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: updateLocation called for ID ${locationId} with data:`, data);
    const existing = await getFromStore(STORES.locations, locationId);
    if (!existing) return { success: false, message: 'Location not found' };
    const updatedLocation = { ...existing, ...data };
    await updateInStore(STORES.locations, updatedLocation);
    return { success: true };
};

export const deleteLocation = async (settings, locationId) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: deleteLocation called for ID ${locationId}`);
    // Check if used by items
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.location_id === locationId);
    if (isUsed) {
        return { success: false, message: 'Cannot delete location: It is currently assigned to one or more items.' };
    }
    // Check if exists before attempting delete (optional, deleteFromStore handles NotFoundError)
    const existing = await getFromStore(STORES.locations, locationId);
     if (!existing) return { success: false, message: 'Location not found' };

    await deleteFromStore(STORES.locations, locationId);
    return { success: true };
};

// Categories (similar structure to Locations)
export const listCategories = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: listCategories called');
    return getAllFromStore(STORES.categories);
};

export const addCategory = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: addCategory called with data:', data);
    const newId = _getNextId('categories');
    const newCategory = { ...data, category_id: newId };
    await addToStore(STORES.categories, newCategory);
    return { success: true, newId: newId };
};

export const updateCategory = async (settings, categoryId, data) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: updateCategory called for ID ${categoryId} with data:`, data);
    const existing = await getFromStore(STORES.categories, categoryId);
    if (!existing) return { success: false, message: 'Category not found' };
    const updatedCategory = { ...existing, ...data };
    await updateInStore(STORES.categories, updatedCategory);
    return { success: true };
};

export const deleteCategory = async (settings, categoryId) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: deleteCategory called for ID ${categoryId}`);
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.category_id === categoryId);
    if (isUsed) {
        return { success: false, message: 'Cannot delete category: It is currently assigned to one or more items.' };
    }
     const existing = await getFromStore(STORES.categories, categoryId);
     if (!existing) return { success: false, message: 'Category not found' };
    await deleteFromStore(STORES.categories, categoryId);
    return { success: true };
};

// Owners (similar structure to Locations)
export const listOwners = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: listOwners called');
    return getAllFromStore(STORES.owners);
};

export const addOwner = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: addOwner called with data:', data);
    const newId = _getNextId('owners');
    const newOwner = { ...data, owner_id: newId };
    await addToStore(STORES.owners, newOwner);
    return { success: true, newId: newId };
};

export const updateOwner = async (settings, ownerId, data) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: updateOwner called for ID ${ownerId} with data:`, data);
    const existing = await getFromStore(STORES.owners, ownerId);
    if (!existing) return { success: false, message: 'Owner not found' };
    const updatedOwner = { ...existing, ...data };
    await updateInStore(STORES.owners, updatedOwner);
    return { success: true };
};

export const deleteOwner = async (settings, ownerId) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: deleteOwner called for ID ${ownerId}`);
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.owner_id === ownerId);
    if (isUsed) {
        return { success: false, message: 'Cannot delete owner: They are currently assigned to one or more items.' };
    }
    const existing = await getFromStore(STORES.owners, ownerId);
    if (!existing) return { success: false, message: 'Owner not found' };
    await deleteFromStore(STORES.owners, ownerId);
    return { success: true };
};


// Items
export const listItems = async (settings) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: listItems called');
    const itemsMetadata = await getAllFromStore(STORES.items);
    const itemsWithFiles = [];

    for (const item of itemsMetadata) {
        // Try to get the image File object using item_id as the key
        const imageFile = await getFromStore(STORES.images, item.item_id);
        itemsWithFiles.push({
            ...item,
            imageFile: imageFile || null // Add the File object or null
        });
    }

    // Sort by creation date descending
    itemsWithFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`IndexedDBProvider: listed ${itemsWithFiles.length} items with files.`);
    return itemsWithFiles;
};

export const addItem = async (settings, data) => { // eslint-disable-line no-unused-vars
    console.log('IndexedDBProvider: addItem called with data:', data);
    const newId = _getNextId('items');

    // Prepare item metadata
    const { imageFile, ...restOfData } = data; // Separate image file
    const newItemMetadata = {
        ...restOfData,
        item_id: newId,
        created_at: new Date().toISOString(),
        updated_at: null
    };

    // Use transaction for atomicity (add metadata and image together)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.items, STORES.images], 'readwrite');
        const itemsStore = transaction.objectStore(STORES.items);
        const imagesStore = transaction.objectStore(STORES.images);

        let imageAddRequest;
        if (imageFile instanceof File) {
            // Add image using item_id as key
            imageAddRequest = imagesStore.add(imageFile, newId);
            imageAddRequest.onerror = (event) => {
                console.error("Error adding image to IndexedDB:", event.target.error);
                transaction.abort(); // Abort transaction on image add error
                reject(`Error adding image: ${event.target.error}`);
            };
        }

        const itemAddRequest = itemsStore.add(newItemMetadata);
        itemAddRequest.onerror = (event) => {
            console.error("Error adding item metadata to IndexedDB:", event.target.error);
            transaction.abort(); // Abort transaction on item add error
            reject(`Error adding item metadata: ${event.target.error}`);
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Item ${newId} added successfully.`);
            resolve({ success: true, newId: newId });
        };

        transaction.onerror = (event) => {
            // This catches errors not handled by individual requests (like abort)
            console.error("IndexedDB transaction error on add:", event.target.error);
            reject(`Transaction error on add: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("IndexedDB transaction aborted on add:", event.target.error);
            // Reject is likely already called by the specific request error handler
        };
    });
};


export const updateItem = async (settings, itemId, data) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: updateItem called for ID ${itemId} with data:`, data);

    // Get existing item metadata first
    const existingItem = await getFromStore(STORES.items, itemId);
    if (!existingItem) {
        return { success: false, message: 'Item not found' };
    }

    const { imageFile, removeImage, ...restOfData } = data;

    // Prepare updated metadata
    const updatedItemMetadata = {
        ...existingItem,
        ...restOfData,
        updated_at: new Date().toISOString()
    };

    // Use transaction for atomicity
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.items, STORES.images], 'readwrite');
        const itemsStore = transaction.objectStore(STORES.items);
        const imagesStore = transaction.objectStore(STORES.images);

        let imageRequest; // To track image operation

        if (removeImage) {
            console.log(`IndexedDBProvider: Removing image for item ${itemId}`);
            // Delete image using item_id as key
            imageRequest = imagesStore.delete(itemId);
            imageRequest.onerror = (event) => {
                 // Ignore NotFoundError, but reject others
                 if (event.target.error.name !== 'NotFoundError') {
                    console.error("Error deleting image from IndexedDB:", event.target.error);
                    transaction.abort();
                    reject(`Error deleting image: ${event.target.error}`);
                 }
            };
        } else if (imageFile instanceof File) {
            console.log(`IndexedDBProvider: Updating/adding image for item ${itemId}`);
            // Add or update image using item_id as key
            imageRequest = imagesStore.put(imageFile, itemId);
            imageRequest.onerror = (event) => {
                console.error("Error putting image to IndexedDB:", event.target.error);
                transaction.abort();
                reject(`Error putting image: ${event.target.error}`);
            };
        }

        // Update item metadata
        const itemUpdateRequest = itemsStore.put(updatedItemMetadata);
        itemUpdateRequest.onerror = (event) => {
            console.error("Error updating item metadata in IndexedDB:", event.target.error);
            transaction.abort();
            reject(`Error updating item metadata: ${event.target.error}`);
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Item ${itemId} updated successfully.`);
            resolve({ success: true });
        };
        transaction.onerror = (event) => {
            console.error("IndexedDB transaction error on update:", event.target.error);
            reject(`Transaction error on update: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("IndexedDB transaction aborted on update:", event.target.error);
        };
    });
};


export const deleteItem = async (settings, itemId) => { // eslint-disable-line no-unused-vars
    console.log(`IndexedDBProvider: deleteItem called for ID ${itemId}`);

    // Check if item exists before attempting delete (optional)
    const existingItem = await getFromStore(STORES.items, itemId);
    if (!existingItem) {
        return { success: false, message: 'Item not found' };
    }

    // Use transaction for atomicity
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.items, STORES.images], 'readwrite');
        const itemsStore = transaction.objectStore(STORES.items);
        const imagesStore = transaction.objectStore(STORES.images);

        // Delete image first (ignore NotFoundError)
        const imageDeleteRequest = imagesStore.delete(itemId);
        imageDeleteRequest.onerror = (event) => {
            if (event.target.error.name !== 'NotFoundError') {
                console.error("Error deleting image during item delete:", event.target.error);
                transaction.abort();
                reject(`Error deleting image: ${event.target.error}`);
            }
        };

        // Delete item metadata
        const itemDeleteRequest = itemsStore.delete(itemId);
         itemDeleteRequest.onerror = (event) => {
             // Should not happen if we checked existence, but handle anyway
             if (event.target.error.name !== 'NotFoundError') {
                console.error("Error deleting item metadata:", event.target.error);
                transaction.abort();
                reject(`Error deleting item metadata: ${event.target.error}`);
             }
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Item ${itemId} deleted successfully.`);
            resolve({ success: true });
        };
        transaction.onerror = (event) => {
            console.error("IndexedDB transaction error on delete:", event.target.error);
            reject(`Transaction error on delete: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("IndexedDB transaction aborted on delete:", event.target.error);
        };
    });
};
