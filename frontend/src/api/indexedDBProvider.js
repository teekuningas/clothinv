import JSZip from 'jszip';
import {
    createCSV,
    parseCSV,
    // No image helpers needed directly here as we store File objects
} from './providerUtils'; // Import shared utilities
// --- IndexedDB Setup ---
const DB_NAME = 'ClothingInventoryDB';
const DB_VERSION = 2; // Increment this if schema changes
const STORES = {
    items: 'items',
    images: 'images', // Note: Stores File objects, keyed by item_id
    locations: 'locations', // Stores location metadata, keyed by location_id
    categories: 'categories', // Stores category metadata, keyed by category_id
    owners: 'owners', // Stores owner metadata, keyed by owner_id
    counters: 'counters', // Stores next available ID for each entity type
};

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
            console.log(`IndexedDB upgrade needed from version ${event.oldVersion} to ${event.newVersion}`);
            const db = event.target.result;
            const transaction = event.target.transaction; // Get transaction for initialization

            // Version 1: Create initial stores
            if (event.oldVersion < 1) {
                console.log("Creating initial object stores (items, images, locations, categories, owners)...");
                if (!db.objectStoreNames.contains(STORES.items)) {
                    db.createObjectStore(STORES.items, { keyPath: 'item_id' });
                }
                if (!db.objectStoreNames.contains(STORES.images)) {
                    db.createObjectStore(STORES.images); // Keyed externally by item_id
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
            }

            // Version 2: Create counters store and initialize
            if (event.oldVersion < 2) {
                console.log("Creating and initializing counters store...");
                if (!db.objectStoreNames.contains(STORES.counters)) {
                    const counterStore = db.createObjectStore(STORES.counters, { keyPath: 'entity' });
                    // Initialize counters within the upgrade transaction
                    // Use the transaction associated with the upgrade event
                    console.log("Initializing default counters...");
                    const entities = ['items', 'locations', 'categories', 'owners'];
                    entities.forEach(entity => {
                        // Use transaction.objectStore to ensure it happens within the upgrade
                        const store = transaction.objectStore(STORES.counters);
                        store.put({ entity: entity, nextId: 1 }).onerror = (e) => {
                             console.error(`Error initializing counter for ${entity}:`, e.target.error);
                        };
                    });
                     console.log("Counters initialized.");
                }
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

export const destroyData = async (settings) => {
    console.log('IndexedDBProvider: destroyData called');
    try {
        console.log("Clearing all IndexedDB object stores...");
        await clearStore(STORES.items);
        await clearStore(STORES.images);
        await clearStore(STORES.locations);
        await clearStore(STORES.categories);
        await clearStore(STORES.owners);
        // Don't clear counters store here, reset it below
        console.log("Main data stores cleared.");

        console.log("Resetting ID counters in IndexedDB...");
        const db = await openDB();
        const transaction = db.transaction(STORES.counters, 'readwrite');
        const counterStore = transaction.objectStore(STORES.counters);
        const entities = ['items', 'locations', 'categories', 'owners'];
        const promises = entities.map(entity => {
            return new Promise((resolve, reject) => {
                const request = counterStore.put({ entity: entity, nextId: 1 });
                request.onsuccess = resolve;
                request.onerror = (e) => {
                    console.error(`Error resetting counter for ${entity}:`, e.target.error);
                    reject(`Error resetting counter for ${entity}`);
                };
            });
        });

        await Promise.all(promises); // Wait for all counters to be reset
        console.log("ID counters reset in IndexedDB.");

        console.log('IndexedDBProvider: Data destruction completed successfully.');
        return { success: true, summary: `All data successfully destroyed.` };

    } catch (error) {
        console.error("Error during IndexedDB data destruction:", error);
        return { success: false, error: `Data destruction failed: ${error.message}` };
    }
};

// --- Export/Import ---

export const exportData = async (settings) => {
    console.log('IndexedDBProvider: exportData called');
    const zip = new JSZip();

    try {
        // 1. Fetch all data
        const locations = await getAllFromStore(STORES.locations);
        const categories = await getAllFromStore(STORES.categories);
        const owners = await getAllFromStore(STORES.owners);
        const itemsMetadata = await getAllFromStore(STORES.items);

        // 2. Create CSVs
        const locationHeaders = ['location_id', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('locations.csv', createCSV(locationHeaders, locations));

        const categoryHeaders = ['category_id', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('categories.csv', createCSV(categoryHeaders, categories));

        const ownerHeaders = ['owner_id', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('owners.csv', createCSV(ownerHeaders, owners));

        const itemHeaders = ['item_id', 'name', 'description', 'location_id', 'category_id', 'owner_id', 'image_zip_filename', 'image_original_filename', 'created_at', 'updated_at'];
        const itemsForCsv = [];
        const imagesFolder = zip.folder('images');

        for (const item of itemsMetadata) {
            const itemCsvRow = { ...item };
            itemCsvRow.image_zip_filename = ''; // Default to empty
            itemCsvRow.image_original_filename = ''; // Default to empty

            const imageFile = await getFromStore(STORES.images, item.item_id);
            if (imageFile instanceof File) {
                const fileExtension = imageFile.name.split('.').pop() || 'bin';
                const zipFilename = `${item.item_id}.${fileExtension}`;
                itemCsvRow.image_zip_filename = zipFilename;
                itemCsvRow.image_original_filename = imageFile.name;
                // Add image file to zip
                imagesFolder.file(zipFilename, imageFile); // JSZip can handle File objects directly
            }
            itemsForCsv.push(itemCsvRow);
        }
        zip.file('items.csv', createCSV(itemHeaders, itemsForCsv));

        // 3. Create Manifest
        const manifest = {
            exportFormatVersion: "1.0",
            exportedAt: new Date().toISOString(),
            sourceProvider: "indexedDB" // <-- Change this value
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        console.log('IndexedDBProvider: Export generated successfully.');
        return blob;

    } catch (error) {
        console.error("Error during IndexedDB export:", error);
        throw new Error(`Export failed: ${error.message}`);
    }
};

export const importData = async (settings, zipFile) => {
    console.log('IndexedDBProvider: importData called');
    const zip = new JSZip();
    try {
        const loadedZip = await zip.loadAsync(zipFile);

        // Validate essential files
        if (!loadedZip.file('manifest.json') || !loadedZip.file('items.csv') || !loadedZip.file('locations.csv') || !loadedZip.file('categories.csv') || !loadedZip.file('owners.csv')) {
            throw new Error("Import file is missing required CSV or manifest files.");
        }

        // Clear existing data (implement this carefully!)
        console.log("Clearing existing IndexedDB data...");
        await clearStore(STORES.items);
        await clearStore(STORES.images);
        await clearStore(STORES.locations);
        await clearStore(STORES.categories);
        await clearStore(STORES.owners);
        // Don't reset counters here, do it after parsing below
        console.log("Existing data cleared.");

        // --- Parse Data ---
        const locations = parseCSV(await loadedZip.file('locations.csv').async('string'));
        const categories = parseCSV(await loadedZip.file('categories.csv').async('string'));
        const owners = parseCSV(await loadedZip.file('owners.csv').async('string'));
        const items = parseCSV(await loadedZip.file('items.csv').async('string'));

        // --- Reset Counters Based on Max Imported IDs ---
        console.log("Resetting ID counters based on imported data...");
        const maxLocId = Math.max(0, ...locations.map(l => parseInt(l.location_id, 10) || 0));
        const maxCatId = Math.max(0, ...categories.map(c => parseInt(c.category_id, 10) || 0));
        const maxOwnerId = Math.max(0, ...owners.map(o => parseInt(o.owner_id, 10) || 0));
        const maxItemId = Math.max(0, ...items.map(i => parseInt(i.item_id, 10) || 0));

        const dbCounters = await openDB();
        const counterTx = dbCounters.transaction(STORES.counters, 'readwrite');
        const counterStore = counterTx.objectStore(STORES.counters);
        const counterPromises = [
            { entity: 'locations', nextId: maxLocId + 1 },
            { entity: 'categories', nextId: maxCatId + 1 },
            { entity: 'owners', nextId: maxOwnerId + 1 },
            { entity: 'items', nextId: maxItemId + 1 },
        ].map(counter => {
            return new Promise((resolve, reject) => {
                const req = counterStore.put(counter);
                req.onsuccess = resolve;
                req.onerror = (e) => {
                    console.error(`Error setting counter for ${counter.entity}:`, e.target.error);
                    reject(`Failed to set counter for ${counter.entity}`);
                };
            });
        });
        await Promise.all(counterPromises);
        console.log("ID counters reset based on imported data.");

        // --- Import Data (using imported IDs) ---
        console.log("Importing locations...");
        for (const loc of locations) {
            // Ensure timestamps are preserved or set defaults if missing in older exports
            loc.created_at = loc.created_at || new Date().toISOString();
            loc.updated_at = loc.updated_at || null;
            // Ensure IDs are numbers
            loc.location_id = parseInt(loc.location_id, 10);
            // Preserve timestamps or set defaults
            loc.created_at = loc.created_at || new Date().toISOString();
            loc.updated_at = loc.updated_at || null;
            // Use putInStore which handles add/update based on key
            await updateInStore(STORES.locations, loc);
        }
        console.log("Locations imported.");

        console.log("Importing categories...");
        for (const cat of categories) {
            cat.category_id = parseInt(cat.category_id, 10);
            cat.created_at = cat.created_at || new Date().toISOString();
            cat.updated_at = cat.updated_at || null;
            await updateInStore(STORES.categories, cat);
        }
        console.log("Categories imported.");

        console.log("Importing owners...");
        for (const owner of owners) {
            owner.owner_id = parseInt(owner.owner_id, 10);
            owner.created_at = owner.created_at || new Date().toISOString();
            owner.updated_at = owner.updated_at || null;
            await updateInStore(STORES.owners, owner);
        }
        console.log("Owners imported.");

        console.log("Importing items and images...");
        for (const item of items) {
            const { image_zip_filename, image_original_filename, ...itemMetadata } = item;
            itemMetadata.item_id = parseInt(itemMetadata.item_id, 10); // Ensure item_id is number
            let imageFile = null;
            if (image_zip_filename && loadedZip.file(`images/${image_zip_filename}`)) {
                const imageBlob = await loadedZip.file(`images/${image_zip_filename}`).async('blob');
                imageFile = new File([imageBlob], image_original_filename || image_zip_filename, { type: imageBlob.type });
            }
            // Preserve timestamps or set defaults
            itemMetadata.created_at = itemMetadata.created_at || new Date().toISOString();
            itemMetadata.updated_at = itemMetadata.updated_at || null;

            // Use a transaction to add item and image together
            const dbItem = await openDB();
            const itemTx = dbItem.transaction([STORES.items, STORES.images], 'readwrite');
            const itemsStore = itemTx.objectStore(STORES.items);
            const imagesStore = itemTx.objectStore(STORES.images);

            const itemReq = itemsStore.put(itemMetadata); // Use put for add/update
            itemReq.onerror = (e) => console.error(`Error importing item ${itemMetadata.item_id}:`, e.target.error);

            if (imageFile) {
                const imageReq = imagesStore.put(imageFile, itemMetadata.item_id); // Use put for add/update, key is item_id
                imageReq.onerror = (e) => console.error(`Error importing image for item ${itemMetadata.item_id}:`, e.target.error);
            }

            // Wait for transaction to complete for this item
            await new Promise((resolve, reject) => {
                itemTx.oncomplete = resolve;
                itemTx.onerror = (e) => {
                    console.error(`Transaction error importing item ${itemMetadata.item_id}:`, e.target.error);
                    reject(e.target.error); // Reject if transaction fails
                };
                 itemTx.onabort = (e) => {
                    console.error(`Transaction aborted importing item ${itemMetadata.item_id}:`, e.target.error);
                    reject(e.target.error); // Reject if transaction aborts
                };
            });
        }
        console.log("Items and images imported.");

        console.log('IndexedDBProvider: Import completed successfully.');
        return { success: true, summary: `Import successful. Replaced data with ${locations.length} locations, ${categories.length} categories, ${owners.length} owners, ${items.length} items.` };

    } catch (error) {
        console.error("Error during IndexedDB import:", error);
        // Attempt to clean up partially imported data? Difficult in IndexedDB.
        return { success: false, error: `Import failed: ${error.message}` };
    }
};

// Helper function to clear an object store
const clearStore = async (storeName) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve({ success: true });
        request.onerror = (event) => {
            console.error(`Error clearing store ${storeName}:`, event.target.error);
            reject(`Error clearing store ${storeName}: ${event.target.error}`);
        };
    });
};

// Generic function to add a record to a store
const addToStore = async (storeName, record, key = undefined) => { // Add optional key parameter
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        // Pass key if provided, otherwise let IndexedDB handle it (in-line keys/generator)
        const request = key !== undefined ? store.add(record, key) : store.add(record);

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

// --- Exported API Methods ---

// Locations
export const listLocations = async (settings) => {
    console.log('IndexedDBProvider: listLocations called');
    return getAllFromStore(STORES.locations);
};

export const addLocation = async (settings, data) => {
    console.log('IndexedDBProvider: addLocation called with data:', data);
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.locations, STORES.counters], 'readwrite');
        const locationStore = transaction.objectStore(STORES.locations);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'locations';
        let newId;

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 }; // Default if not found
            newId = counter.nextId;
            counter.nextId++; // Increment

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newLocation = {
                ...data,
                location_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addLocationRequest = locationStore.add(newLocation);
            addLocationRequest.onerror = (event) => {
                console.error("Error adding location:", event.target.error);
                transaction.abort();
                reject(`Error adding location: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Location ${newId} added successfully.`);
            resolve({ success: true, newId: newId });
        };
        transaction.onerror = (event) => {
            console.error("Transaction error adding location:", event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("Transaction aborted adding location:", event.target.error);
            // Reject is likely already called by specific request error handler
        };
    });
};

export const updateLocation = async (settings, locationId, data) => {
    console.log(`IndexedDBProvider: updateLocation called for ID ${locationId} with data:`, data);
    const existing = await getFromStore(STORES.locations, locationId);
    if (!existing) return { success: false, message: 'Location not found' };
    const updatedLocation = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString() // Set updated_at on update
    };
    await updateInStore(STORES.locations, updatedLocation);
    return { success: true };
};

export const deleteLocation = async (settings, locationId) => {
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
export const listCategories = async (settings) => {
    console.log('IndexedDBProvider: listCategories called');
    return getAllFromStore(STORES.categories);
};

export const addCategory = async (settings, data) => {
    console.log('IndexedDBProvider: addCategory called with data:', data);
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.categories, STORES.counters], 'readwrite');
        const categoryStore = transaction.objectStore(STORES.categories);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'categories';
        let newId;

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++;

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newCategory = {
                ...data,
                category_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addCategoryRequest = categoryStore.add(newCategory);
            addCategoryRequest.onerror = (event) => {
                console.error("Error adding category:", event.target.error);
                transaction.abort();
                reject(`Error adding category: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Category ${newId} added successfully.`);
            resolve({ success: true, newId: newId });
        };
        transaction.onerror = (event) => {
            console.error("Transaction error adding category:", event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("Transaction aborted adding category:", event.target.error);
        };
    });
};

export const updateCategory = async (settings, categoryId, data) => {
    console.log(`IndexedDBProvider: updateCategory called for ID ${categoryId} with data:`, data);
    const existing = await getFromStore(STORES.categories, categoryId);
    if (!existing) return { success: false, message: 'Category not found' };
    const updatedCategory = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString()
    };
    await updateInStore(STORES.categories, updatedCategory);
    return { success: true };
};

export const deleteCategory = async (settings, categoryId) => {
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
export const listOwners = async (settings) => {
    console.log('IndexedDBProvider: listOwners called');
    return getAllFromStore(STORES.owners);
};

export const addOwner = async (settings, data) => {
    console.log('IndexedDBProvider: addOwner called with data:', data);
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.owners, STORES.counters], 'readwrite');
        const ownerStore = transaction.objectStore(STORES.owners);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'owners';
        let newId;

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++;

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newOwner = {
                ...data,
                owner_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addOwnerRequest = ownerStore.add(newOwner);
            addOwnerRequest.onerror = (event) => {
                console.error("Error adding owner:", event.target.error);
                transaction.abort();
                reject(`Error adding owner: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Owner ${newId} added successfully.`);
            resolve({ success: true, newId: newId });
        };
        transaction.onerror = (event) => {
            console.error("Transaction error adding owner:", event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("Transaction aborted adding owner:", event.target.error);
        };
    });
};

export const updateOwner = async (settings, ownerId, data) => {
    console.log(`IndexedDBProvider: updateOwner called for ID ${ownerId} with data:`, data);
    const existing = await getFromStore(STORES.owners, ownerId);
    if (!existing) return { success: false, message: 'Owner not found' };
    const updatedOwner = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString()
    };
    await updateInStore(STORES.owners, updatedOwner);
    return { success: true };
};

export const deleteOwner = async (settings, ownerId) => {
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
export const listItems = async (settings) => {
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

export const addItem = async (settings, data) => {
    console.log('IndexedDBProvider: addItem called with data:', data);
    const { imageFile, ...restOfData } = data; // Separate image file
    const db = await openDB();

    return new Promise((resolve, reject) => {
        // Transaction covers items, images, and the counter
        const transaction = db.transaction([STORES.items, STORES.images, STORES.counters], 'readwrite');
        const itemsStore = transaction.objectStore(STORES.items);
        const imagesStore = transaction.objectStore(STORES.images);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'items';
        let newId;

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++; // Increment

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            // Prepare item metadata with the new ID
            const newItemMetadata = {
                ...restOfData,
                item_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };

            // Add item metadata
            const itemAddRequest = itemsStore.add(newItemMetadata);
            itemAddRequest.onerror = (event) => {
                console.error("Error adding item metadata:", event.target.error);
                transaction.abort();
                reject(`Error adding item metadata: ${event.target.error}`);
            };

            // Add image if present
            if (imageFile instanceof File) {
                const imageAddRequest = imagesStore.add(imageFile, newId); // Key is newId
                imageAddRequest.onerror = (event) => {
                    console.error("Error adding image:", event.target.error);
                    transaction.abort();
                    reject(`Error adding image: ${event.target.error}`);
                };
            }
        }; // End counterRequest.onsuccess

        transaction.oncomplete = () => {
            console.log(`IndexedDBProvider: Item ${newId} added successfully.`);
            resolve({ success: true, newId: newId });
        };
        transaction.onerror = (event) => {
            console.error("Transaction error adding item:", event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error("Transaction aborted adding item:", event.target.error);
        };
    });
};


export const updateItem = async (settings, itemId, data) => {
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


export const deleteItem = async (settings, itemId) => {
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
