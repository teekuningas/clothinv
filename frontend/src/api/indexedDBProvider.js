import JSZip from 'jszip';
import { FORMAT_VERSION } from './exportFormat';
import { v4 as uuidv4 } from 'uuid';
import {
    createCSV,
    parseCSV,
    getMimeTypeFromFilename,
} from './providerUtils';

const PROVIDER_NAME = "IndexedDB Provider";
const DB_NAME = 'ClothinvDB';
const DB_VERSION = 3;
const STORES = {
    items: 'items',
    images: 'images', // Note: Stores File objects, keyed by item_id (integer)
    locations: 'locations', // Stores location metadata, keyed by location_id
    categories: 'categories', // Stores category metadata, keyed by category_id
    owners: 'owners', // Stores owner metadata, keyed by owner_id
    counters: 'counters', // Stores next available ID for each entity type
    schema_version: 'schema_version' // Stores schema version
};

let dbPromise = null;

const openDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // always open (or create) with the browser’s default version number
    const request = indexedDB.open(DB_NAME);

    return new Promise((resolve, reject) => {
      request.onerror = (event) => {
        console.error(`[${PROVIDER_NAME}]: IndexedDB error:`, event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        console.log(`[${PROVIDER_NAME}]: IndexedDB opened.`);
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        // Create all object stores if missing
        if (!db.objectStoreNames.contains(STORES.items)) {
            db.createObjectStore(STORES.items, { keyPath: 'item_id' });
        }
        if (!db.objectStoreNames.contains(STORES.images)) {
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
        // Counters store (seed default nextId = 1 for each entity)
        if (!db.objectStoreNames.contains(STORES.counters)) {
            const counterStore = db.createObjectStore(STORES.counters, { keyPath: 'entity' });
            ['items','locations','categories','owners']
              .forEach(entity => counterStore.put({ entity, nextId: 1 }));
        }
        if (!db.objectStoreNames.contains(STORES.schema_version)) {
            const versionStore = db.createObjectStore(STORES.schema_version, { keyPath: 'key' });
            versionStore.put({ key: 'db_version', value: DB_VERSION });
        }

        console.log(`[${PROVIDER_NAME}]: IndexedDB creation complete.`);
      };
    });
  })();

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
            console.error(`[${PROVIDER_NAME}]: Error getting all from ${storeName}:`, event.target.error); // Add prefix
            reject(`Error getting all from ${storeName}: ${event.target.error}`);
        };
    });
};

export const destroyData = async (settings) => {
    console.log(`[${PROVIDER_NAME}]: destroyData called`); // Keep, significant
    try {
        console.log(`[${PROVIDER_NAME}]: Clearing all IndexedDB object stores...`); // Keep
        await clearStore(STORES.items);
        await clearStore(STORES.images);
        await clearStore(STORES.locations);
        await clearStore(STORES.categories);
        await clearStore(STORES.owners);
        // Don't clear counters store here, reset it below
        console.log(`[${PROVIDER_NAME}]: Main data stores cleared.`); // Keep
        console.log(`[${PROVIDER_NAME}]: Resetting ID counters in IndexedDB...`); // Keep
        const db = await openDB();
        const transaction = db.transaction(STORES.counters, 'readwrite');
        const counterStore = transaction.objectStore(STORES.counters);
        const entities = ['items', 'locations', 'categories', 'owners'];
        const promises = entities.map(entity => {
            return new Promise((resolve, reject) => {
                const request = counterStore.put({ entity: entity, nextId: 1 });
                request.onsuccess = resolve;
                request.onerror = (e) => {
                    console.error(`[${PROVIDER_NAME}]: Error resetting counter for ${entity}:`, e.target.error); // Add prefix
                    reject(`Error resetting counter for ${entity}`);
                };
            });
        });

        await Promise.all(promises); // Wait for all counters to be reset
        console.log(`[${PROVIDER_NAME}]: ID counters reset in IndexedDB.`); // Keep
        console.log(`[${PROVIDER_NAME}]: Data destruction completed successfully.`); // Keep
        return { success: true, summaryKey: "api.destroy.successSummary" };

    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during IndexedDB data destruction:`, error); // Add prefix
        return { success: false, errorKey: "api.destroy.errorDetail", errorValues: { detail: error.message } };
    }
};

// --- Export/Import ---

export const exportData = async (settings) => {
    console.log(`[${PROVIDER_NAME}]: exportData called`); // Keep
    const zip = new JSZip();

    try {
        // 1. Fetch all data
        console.log(`[${PROVIDER_NAME}]: Starting export... Fetched all data.`);
        const locations = await getAllFromStore(STORES.locations);
        const categories = await getAllFromStore(STORES.categories);
        const owners = await getAllFromStore(STORES.owners);
        // listItems now returns all item metadata without File objects.
        const itemsMetadata = await listItems(settings); // Fetches all item metadata

        // 2. Create CSVs
        const locationHeaders = ['location_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('locations.csv', createCSV(locationHeaders, locations));

        const categoryHeaders = ['category_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('categories.csv', createCSV(categoryHeaders, categories));

        const ownerHeaders = ['owner_id', 'uuid', 'name', 'description', 'created_at', 'updated_at'];
        zip.file('owners.csv', createCSV(ownerHeaders, owners));

        // Prepare images CSV and collect image data
        const imageHeaders = ['image_id', 'uuid', 'image_mimetype', 'image_filename', 'created_at']; // Using item_id as image_id for simplicity here
        const imagesForCsv = [];

        const itemHeaders = ['item_id', 'uuid', 'name', 'description', 'location_id', 'category_id', 'price', 'owner_id', 'image_id', 'image_uuid', 'image_zip_filename', 'image_original_filename', 'created_at', 'updated_at'];
        const itemsForCsv = [];
        const imagesFolder = zip.folder('images');

        for (const item of itemsMetadata) { // Iterate over metadata
            const itemCsvRow = { ...item };
            itemCsvRow.image_zip_filename = '';
            itemCsvRow.image_original_filename = '';
            // image_uuid is already in item metadata

            if (item.image_uuid) { // Check if there's an associated image UUID
                // Fetch the image File object using the new getImage method
                const imageFile = await getImage(settings, { image_uuid: item.image_uuid });
                if (imageFile instanceof File) {
                    const fileExtension = imageFile.name.split('.').pop() || 'bin';
                    const zipFilename = `${item.item_id}.${fileExtension}`; // Use item_id for zip filename
                    itemCsvRow.image_zip_filename = zipFilename;
                    itemCsvRow.image_original_filename = imageFile.name;
                    // itemCsvRow.image_id = item.item_id; // Already part of item

                    imagesFolder.file(zipFilename, imageFile);

                    imagesForCsv.push({
                        image_id: item.item_id, // Use item_id as the key/ID for the image in this context
                        uuid: item.image_uuid,
                        image_mimetype: imageFile.type,
                        image_filename: imageFile.name,
                        created_at: item.created_at // Or a more specific image creation time if available
                    });
                }
            }
            itemsForCsv.push(itemCsvRow);
        }
        zip.file('items.csv', createCSV(itemHeaders, itemsForCsv));
        zip.file('images.csv', createCSV(imageHeaders, imagesForCsv));

        // 3. Create Manifest
        const manifest = {
            exportFormatVersion: FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            sourceProvider: "indexedDB"
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 4. Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        console.log(`[${PROVIDER_NAME}]: Export generated successfully.`); // Keep
        return blob;

    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during IndexedDB export:`, error); // Add prefix
        throw new Error(`Export failed: ${error.message}`);
    }
};

/*
// --- importData v1 for IndexedDB provider ---
*/
async function importDataV1(settings, loadedZip) {
    console.log(`[${PROVIDER_NAME}]: importData called`); // Keep
    try {
        // Validate essential files
        if (!loadedZip.file('manifest.json') || !loadedZip.file('items.csv') || !loadedZip.file('locations.csv') || !loadedZip.file('categories.csv') || !loadedZip.file('owners.csv') || !loadedZip.file('images.csv')) {
            throw new Error("Import file is missing required CSV or manifest files.");
        }

        // Clear existing data (implement this carefully!)
        console.log(`[${PROVIDER_NAME}]: Clearing existing IndexedDB data...`); // Keep
        await clearStore(STORES.items);
        await clearStore(STORES.images);
        await clearStore(STORES.locations);
        await clearStore(STORES.categories);
        await clearStore(STORES.owners);
        // Don't reset counters here, do it after parsing below
        console.log(`[${PROVIDER_NAME}]: Existing data cleared.`); // Keep

        // --- Parse Data ---
        const locations = parseCSV(await loadedZip.file('locations.csv').async('string'));
        const categories = parseCSV(await loadedZip.file('categories.csv').async('string'));
        const owners = parseCSV(await loadedZip.file('owners.csv').async('string'));
        const imagesMetadata = parseCSV(await loadedZip.file('images.csv').async('string')); // Parse images metadata
        const items = parseCSV(await loadedZip.file('items.csv').async('string'));

        // --- Reset Counters Based on Max Imported IDs ---
        console.log(`[${PROVIDER_NAME}]: Resetting ID counters based on imported data...`); // Keep
        const maxLocId = Math.max(0, ...locations.map(l => parseInt(l.location_id, 10) || 0));
        const maxCatId = Math.max(0, ...categories.map(c => parseInt(c.category_id, 10) || 0));
        const maxOwnerId = Math.max(0, ...owners.map(o => parseInt(o.owner_id, 10) || 0));
        const maxItemId = Math.max(0, ...items.map(i => parseInt(i.item_id, 10) || 0));
        // No counter needed for images as their ID is derived from item_id

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
                    console.error(`[${PROVIDER_NAME}]: Error setting counter for ${counter.entity}:`, e.target.error); // Add prefix
                    reject(`Failed to set counter for ${counter.entity}`);
                };
            });
        });
        await Promise.all(counterPromises);
        console.log(`[${PROVIDER_NAME}]: ID counters reset based on imported data.`); // Keep

        // --- Import Data (using imported IDs) ---
        console.log(`[${PROVIDER_NAME}]: Importing locations...`); // Keep (and for categories, owners, items)
        for (const loc of locations) {
            // Ensure IDs are numbers
            loc.location_id = parseInt(loc.location_id, 10);
            // Preserve timestamps or set defaults
            loc.created_at = loc.created_at || new Date().toISOString();
            loc.updated_at = loc.updated_at || null;
            // Use UUID from CSV, ensure it exists
            loc.uuid = loc.uuid || uuidv4(); // Generate if missing (shouldn't happen with new exports)
            // Use putInStore which handles add/update based on key
            await updateInStore(STORES.locations, loc);
        }
        console.log(`[${PROVIDER_NAME}]: Locations imported.`); // Keep (and for categories, owners)

        console.log(`[${PROVIDER_NAME}]: Importing categories...`); // Keep (and for categories, owners, items)
        for (const cat of categories) {
            cat.category_id = parseInt(cat.category_id, 10);
            cat.created_at = cat.created_at || new Date().toISOString();
            cat.updated_at = cat.updated_at || null;
            cat.uuid = cat.uuid || uuidv4();
            await updateInStore(STORES.categories, cat);
        }
        console.log(`[${PROVIDER_NAME}]: Categories imported.`); // Keep (and for categories, owners)

        console.log(`[${PROVIDER_NAME}]: Importing owners...`); // Keep (and for categories, owners, items)
        for (const owner of owners) {
            owner.owner_id = parseInt(owner.owner_id, 10);
            owner.created_at = owner.created_at || new Date().toISOString();
            owner.updated_at = owner.updated_at || null;
            owner.uuid = owner.uuid || uuidv4();
            await updateInStore(STORES.owners, owner);
        }
        console.log(`[${PROVIDER_NAME}]: Owners imported.`); // Keep (and for categories, owners)

        console.log(`[${PROVIDER_NAME}]: Importing items and images...`); // Keep
        for (const item of items) {
            const { image_zip_filename, image_original_filename, ...itemMetadata } = item;
            const itemId = parseInt(itemMetadata.item_id, 10); // Ensure item_id is number
            itemMetadata.item_id = itemId;
            itemMetadata.uuid = itemMetadata.uuid || uuidv4(); // Use imported UUID or generate

            let imageFile = null;
            let imageUuid = itemMetadata.image_uuid || null; // Get image UUID from item row

            if (image_zip_filename && loadedZip.file(`images/${image_zip_filename}`)) {
                const imageBlob = await loadedZip.file(`images/${image_zip_filename}`).async('blob');
                const originalFilenameToUse = image_original_filename || image_zip_filename;

                let mimeType = '';
                // 1. Try image_mimetype from images.csv (parsed into imagesMetadata)
                //    images.csv uses 'image_id' which corresponds to 'itemId' (item.item_id) here.
                const imgMetaForItem = imagesMetadata.find(img => parseInt(img.image_id, 10) === itemId);
                if (imgMetaForItem && imgMetaForItem.image_mimetype) {
                    mimeType = imgMetaForItem.image_mimetype;
                }

                // 2. If not found or empty, try imageBlob.type (browser-inferred from blob content)
                if (!mimeType && imageBlob.type) {
                    mimeType = imageBlob.type;
                }

                // 3. If still no MIME type, try to guess from filename
                if (!mimeType) {
                    mimeType = getMimeTypeFromFilename(originalFilenameToUse);
                }

                // 4. As a last resort, default to 'application/octet-stream' if still empty
                if (!mimeType) {
                    mimeType = 'application/octet-stream';
                }

                imageFile = new File([imageBlob], originalFilenameToUse, { type: mimeType });

                // If image_uuid was missing in items.csv, try finding it in images.csv (fallback)
                if (!imageUuid) {
                    // Use imgMetaForItem if already found, otherwise generate UUID
                    imageUuid = (imgMetaForItem && imgMetaForItem.uuid) ? imgMetaForItem.uuid : uuidv4();
                }
            }
            // Preserve timestamps or set defaults
            itemMetadata.created_at = itemMetadata.created_at || new Date().toISOString();
            itemMetadata.updated_at = itemMetadata.updated_at || null;
            itemMetadata.image_uuid = imageUuid; // Store the image's UUID in the item metadata

            // Add price support: parse price as number or null
            if (itemMetadata.price !== '' && itemMetadata.price != null) {
                itemMetadata.price = parseFloat(itemMetadata.price);
            } else {
                itemMetadata.price = null;
            }

            // Use a transaction to add item and image together
            const dbItem = await openDB();
            const itemTx = dbItem.transaction([STORES.items, STORES.images], 'readwrite');
            const itemsStore = itemTx.objectStore(STORES.items);
            const imagesStore = itemTx.objectStore(STORES.images);

            const itemReq = itemsStore.put(itemMetadata); // Use put for add/update
            itemReq.onerror = (e) => console.error(`[${PROVIDER_NAME}]: Error importing item ${itemId}:`, e.target.error); // Add prefix

            if (imageFile) {
                const imageReq = imagesStore.put(imageFile, itemMetadata.item_id); // Use put for add/update, key is item_id
                imageReq.onerror = (e) => console.error(`[${PROVIDER_NAME}]: Error importing image for item ${itemId}:`, e.target.error); // Add prefix
            }

            // Wait for transaction to complete for this item
            await new Promise((resolve, reject) => {
                itemTx.oncomplete = resolve;
                itemTx.onerror = (e) => {
                    console.error(`[${PROVIDER_NAME}]: Transaction error importing item ${itemMetadata.item_id}:`, e.target.error); // Add prefix
                    reject(`Transaction error importing item ${itemMetadata.item_id}: ${e.target.error}`); 
                };
                 itemTx.onabort = (e) => {
                    console.error(`[${PROVIDER_NAME}]: Transaction aborted importing item ${itemMetadata.item_id}:`, e.target.error); // Add prefix
                    reject(`Transaction aborted importing item ${itemMetadata.item_id}: ${e.target.error}`); 
                };
            });
        }
        console.log(`[${PROVIDER_NAME}]: Items and images imported.`); // Keep
        console.log(`[${PROVIDER_NAME}]: Import completed successfully.`); // Keep
        return {
            success: true,
            counts: {
                locations: locations.length,
                categories: categories.length,
                owners: owners.length,
                items: items.length
            }
        };
        // Note: Image count isn't explicitly tracked in summary, but they are imported.
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error during IndexedDB import:`, error); // Add prefix
        // Attempt to clean up partially imported data? Difficult in IndexedDB.
        return { success: false, errorKey: "api.import.errorDetail", errorValues: { detail: error.message } };
    }
}

// --- importData dispatcher for versioning ---
export const importData = async (settings, zipFile) => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    let version = FORMAT_VERSION;
    const mf = loadedZip.file("manifest.json");
    if (mf) {
        try {
            const m = JSON.parse(await mf.async("string"));
            version = m.exportFormatVersion || version;
        } catch (_) {}
    }

    switch (version) {
      case "1.0":
      case "2.0":
      case FORMAT_VERSION:
        return importDataV1(settings, loadedZip);
      default:
        return {
          success: false,
          error: `Unsupported export format version: ${version}`,
        };
    }
};

// Helper to get all images keyed by item_id
const getAllImagesWithKeys = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.images, 'readonly');
        const store = transaction.objectStore(STORES.images);
        const imageMap = {};
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                imageMap[cursor.key] = cursor.value; // key is item_id, value is File
                cursor.continue();
            } else {
                resolve(imageMap); // All images fetched
            }
        };
        cursorRequest.onerror = event => {
            console.error(`[${PROVIDER_NAME}]: Error fetching images with keys:`, event.target.error); // Add prefix
            reject("Error fetching images with keys");
        };
    });
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
            console.error(`[${PROVIDER_NAME}]: Error clearing store ${storeName}:`, event.target.error); // Add prefix
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
        request.onerror = (event) => { // Handle ConstraintError if UUID is not unique (shouldn't happen with v4)
            console.error(`[${PROVIDER_NAME}]: Error adding to ${storeName}:`, event.target.error); // Add prefix
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
        request.onerror = (event) => { // Handle ConstraintError if UUID is not unique
            console.error(`[${PROVIDER_NAME}]: Error updating in ${storeName}:`, event.target.error); // Add prefix
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
                 console.warn(`[${PROVIDER_NAME}]: Key ${key} not found in ${storeName} for deletion.`); // Add prefix
                 resolve({ success: true }); 
            } else {
                console.error(`[${PROVIDER_NAME}]: Error deleting ${key} from ${storeName}:`, event.target.error); // Add prefix
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
            console.error(`[${PROVIDER_NAME}]: Error getting ${key} from ${storeName}:`, event.target.error); // Add prefix
            reject(`Error getting ${key} from ${storeName}: ${event.target.error}`);
        };
    });
};

export const getDbVersion = async () => {
    try {
        const rec = await getFromStore(STORES.schema_version, 'db_version');
        return rec?.value ?? 1;
    } catch {
        // With missing version, default to 1
        return 1;
    }
};

// --- Exported API Methods ---

// Locations
export const listLocations = async (settings) => {
    return getAllFromStore(STORES.locations);
};

export const addLocation = async (settings, data) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.locations, STORES.counters], 'readwrite');
        const locationStore = transaction.objectStore(STORES.locations);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'locations';
        let newId;
        const newUuid = uuidv4(); // Generate UUID

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Error getting counter for ${entity}:`, event.target.error); // Add prefix
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 }; // Default if not found
            newId = counter.nextId;
            counter.nextId++; // Increment

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error updating counter for ${entity}:`, event.target.error); // Add prefix
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newLocation = {
                ...data,
                uuid: newUuid, // Add UUID
                location_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addLocationRequest = locationStore.add(newLocation);
            addLocationRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error adding location:`, event.target.error); // Add prefix
                transaction.abort();
                reject(`Error adding location: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            resolve({ success: true, newId: newId, uuid: newUuid }); // Return UUID
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction error adding location:`, event.target.error); // Add prefix
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction aborted adding location:`, event.target.error); // Add prefix
            // Reject is likely already called by specific request error handler
        };
    });
};

export const updateLocation = async (settings, inputData) => {
    const { location_id: locationId, ...data } = inputData;
    const existing = await getFromStore(STORES.locations, locationId);
    if (!existing) return { success: false, message: 'Location not found' };
    const { uuid, ...updateData } = data; // Exclude uuid from update data
    const updatedLocation = {
        ...existing,
        ...updateData, // Apply other updates
        updated_at: new Date().toISOString() // Set updated_at on update
    };
    await updateInStore(STORES.locations, updatedLocation);
    return { success: true };
};

export const deleteLocation = async (settings, inputData) => {
    const { location_id: locationId } = inputData;
    // Check if used by items
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.location_id === locationId);
    if (isUsed) {
        return { success: false, errorCode: 'ENTITY_IN_USE' };
    }
    // Check if exists before attempting delete (optional, deleteFromStore handles NotFoundError)
    const existing = await getFromStore(STORES.locations, locationId);
     if (!existing) return { success: false, message: 'Location not found' };

    await deleteFromStore(STORES.locations, locationId);
    return { success: true };
};

// Categories (similar structure to Locations)
export const listCategories = async (settings) => {
    return getAllFromStore(STORES.categories);
};

export const addCategory = async (settings, data) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.categories, STORES.counters], 'readwrite');
        const categoryStore = transaction.objectStore(STORES.categories);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'categories';
        let newId;
        const newUuid = uuidv4(); // Generate UUID

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++;

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newCategory = {
                ...data,
                uuid: newUuid, // Add UUID
                category_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addCategoryRequest = categoryStore.add(newCategory);
            addCategoryRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error adding category:`, event.target.error);
                transaction.abort();
                reject(`Error adding category: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            resolve({ success: true, newId: newId, uuid: newUuid });
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction error adding category:`, event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction aborted adding category:`, event.target.error);
        };
    });
};

export const updateCategory = async (settings, inputData) => {
    const { category_id: categoryId, ...data } = inputData;
    const existing = await getFromStore(STORES.categories, categoryId);
    if (!existing) return { success: false, message: 'Category not found' };
    const { uuid, ...updateData } = data; // Exclude uuid from update data
    const updatedCategory = {
        ...existing,
        ...updateData, // Apply other updates
        updated_at: new Date().toISOString()
    };
    await updateInStore(STORES.categories, updatedCategory);
    return { success: true };
};

export const deleteCategory = async (settings, inputData) => {
    const { category_id: categoryId } = inputData;
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.category_id === categoryId);
    if (isUsed) {
        return { success: false, errorCode: 'ENTITY_IN_USE' };
    }
     const existing = await getFromStore(STORES.categories, categoryId);
     if (!existing) return { success: false, message: 'Category not found' };
    await deleteFromStore(STORES.categories, categoryId);
    return { success: true };
};

// Owners (similar structure to Locations)
export const listOwners = async (settings) => {
    return getAllFromStore(STORES.owners);
};

export const addOwner = async (settings, data) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.owners, STORES.counters], 'readwrite');
        const ownerStore = transaction.objectStore(STORES.owners);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'owners';
        let newId;
        const newUuid = uuidv4(); // Generate UUID

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++;

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            const newOwner = {
                ...data,
                uuid: newUuid, // Add UUID
                owner_id: newId,
                created_at: new Date().toISOString(),
                updated_at: null
            };
            const addOwnerRequest = ownerStore.add(newOwner);
            addOwnerRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error adding owner:`, event.target.error);
                transaction.abort();
                reject(`Error adding owner: ${event.target.error}`);
            };
        };

        transaction.oncomplete = () => {
            resolve({ success: true, newId: newId, uuid: newUuid }); // Return UUID
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction error adding owner:`, event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction aborted adding owner:`, event.target.error);
        };
    });
};

export const updateOwner = async (settings, inputData) => {
    const { owner_id: ownerId, ...data } = inputData;
    const existing = await getFromStore(STORES.owners, ownerId);
    if (!existing) return { success: false, message: 'Owner not found' };
    const { uuid, ...updateData } = data; // Exclude uuid from update data
    const updatedOwner = {
        ...existing,
        ...updateData, // Apply other updates
        updated_at: new Date().toISOString()
    };
    await updateInStore(STORES.owners, updatedOwner);
    return { success: true };
};

export const deleteOwner = async (settings, inputData) => {
    const { owner_id: ownerId } = inputData;
    const items = await getAllFromStore(STORES.items);
    const isUsed = items.some(item => item.owner_id === ownerId);
    if (isUsed) {
        return { success: false, errorCode: 'ENTITY_IN_USE' };
    }
    const existing = await getFromStore(STORES.owners, ownerId);
    if (!existing) return { success: false, message: 'Owner not found' };
    await deleteFromStore(STORES.owners, ownerId);
    return { success: true };
};


// Items
// listItems: Remove options, pagination, filtering, sorting, and direct image fetching.
export const listItems = async (settings) => { // Remove options parameter
    try {
        // Fetch all items metadata
        const allItemsMetadata = await getAllFromStore(STORES.items);
        return allItemsMetadata; // Return raw metadata array
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error in IndexedDB listItems:`, error); // Add prefix
        throw error;
    }
};

// New exported method getImage
export const getImage = async (settings, inputData) => {
    const { image_uuid: imageUuid } = inputData;
    if (!imageUuid) {
        console.warn(`[${PROVIDER_NAME}]: getImage called with no imageUuid.`); // Add prefix
        return null;
    }
    try {
        // To get the image, we first need to find which item it belongs to,
        // as images are keyed by item_id in the STORES.images.
        const allItems = await getAllFromStore(STORES.items);
        const itemWithImage = allItems.find(item => item.image_uuid === imageUuid);

        if (itemWithImage && itemWithImage.item_id) {
            const imageFile = await getFromStore(STORES.images, itemWithImage.item_id);
            if (imageFile instanceof File) {
                return imageFile;
            } else {
                console.warn(`[${PROVIDER_NAME}]: Image data found for item_id ${itemWithImage.item_id} (uuid: ${imageUuid}) was not a File object.`); // Add prefix
                return null;
            }
        } else {
            return null;
        }
    } catch (error) {
        console.error(`[${PROVIDER_NAME}]: Error in IndexedDB getImage for UUID ${imageUuid}:`, error); // Add prefix
        return null;
    }
};

export const addItem = async (settings, data) => {
    const { imageFile, price, ...restOfData } = data; // Separate image file and price from metadata
    const db = await openDB();

    return new Promise((resolve, reject) => {
        // Transaction covers items, images, and the counter
        const transaction = db.transaction([STORES.items, STORES.images, STORES.counters], 'readwrite');
        const itemsStore = transaction.objectStore(STORES.items);
        const imagesStore = transaction.objectStore(STORES.images);
        const counterStore = transaction.objectStore(STORES.counters);
        const entity = 'items';
        let newId;
        const newItemUuid = uuidv4(); // UUID for the item itself
        let newImageUuid = null; // UUID for the image, generated only if image exists

        const counterRequest = counterStore.get(entity);

        counterRequest.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Error getting counter for ${entity}:`, event.target.error);
            transaction.abort();
            reject(`Error getting counter: ${event.target.error}`);
        };

        counterRequest.onsuccess = (event) => {
            const counter = event.target.result || { entity: entity, nextId: 1 };
            newId = counter.nextId;
            counter.nextId++; // Increment

            const updateCounterRequest = counterStore.put(counter);
            updateCounterRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error updating counter for ${entity}:`, event.target.error);
                transaction.abort();
                reject(`Error updating counter: ${event.target.error}`);
            };

            // Generate image UUID if imageFile is present
            if (imageFile instanceof File) {
                newImageUuid = uuidv4();
            }

            // Prepare item metadata with the new ID
            const newItemMetadata = {
                ...restOfData,
                price: price == null ? null : parseFloat(price),
                item_id: newId,
                uuid: newItemUuid, // Add item UUID
                image_uuid: newImageUuid, // Add image UUID (or null)
                created_at: new Date().toISOString(), // Add timestamp
                updated_at: null
            };

            // Add item metadata
            const itemAddRequest = itemsStore.add(newItemMetadata);
            itemAddRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error adding item metadata:`, event.target.error);
                transaction.abort();
                reject(`Error adding item metadata: ${event.target.error}`);
            };

            // Add image if present
            if (imageFile instanceof File) {
                const imageAddRequest = imagesStore.add(imageFile, newId); // Key is newId
                imageAddRequest.onerror = (event) => {
                    console.error(`[${PROVIDER_NAME}]: Error adding image:`, event.target.error);
                    transaction.abort();
                    reject(`Error adding image: ${event.target.error}`);
                };
            }
        };

        transaction.oncomplete = () => {
            resolve({ success: true, newId: newId, uuid: newItemUuid, image_uuid: newImageUuid }); // Return IDs
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction error adding item:`, event.target.error);
            reject(`Transaction error: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: Transaction aborted adding item:`, event.target.error);
        };
    });
};


export const updateItem = async (settings, inputData) => {
    const { item_id: itemId, price, removeImage, imageFile, uuid, image_uuid, ...restOfData } = inputData;

    // Get existing item metadata first
    const existingItem = await getFromStore(STORES.items, itemId);
    if (!existingItem) {
        return { success: false, message: 'Item not found' };
    }

    let newImageUuid = existingItem.image_uuid; // Keep existing image UUID by default

    // Prepare updated metadata
    const updatedItemMetadata = {
        ...existingItem,
        ...restOfData,
        price: price == null ? null : parseFloat(price),
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
            // Delete image using item_id as key
            newImageUuid = null; // Clear image UUID in metadata
            imageRequest = imagesStore.delete(itemId);
            imageRequest.onerror = (event) => {
                 // Ignore NotFoundError, but reject others
                 if (event.target.error.name !== 'NotFoundError') {
                    console.error(`[${PROVIDER_NAME}]: Error deleting image from IndexedDB:`, event.target.error);
                    transaction.abort();
                    reject(`Error deleting image: ${event.target.error}`);
                 }
            };
        } else if (imageFile instanceof File) {
            // Add or update image using item_id as key
            newImageUuid = uuidv4(); // Always generate a new UUID for a new/replaced image file
            imageRequest = imagesStore.put(imageFile, itemId);
            imageRequest.onerror = (event) => {
                console.error(`[${PROVIDER_NAME}]: Error putting image to IndexedDB:`, event.target.error);
                transaction.abort();
                reject(`Error putting image: ${event.target.error}`);
            };
        }

        // Update image_uuid in the item metadata being saved
        updatedItemMetadata.image_uuid = newImageUuid;

        // Update item metadata
        const itemUpdateRequest = itemsStore.put(updatedItemMetadata);
        itemUpdateRequest.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: Error updating item metadata in IndexedDB:`, event.target.error);
            transaction.abort();
            reject(`Error updating item metadata: ${event.target.error}`);
        };

        transaction.oncomplete = () => {
            resolve({ success: true, image_uuid: updatedItemMetadata.image_uuid }); // Pass back image_uuid
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: IndexedDB transaction error on update:`, event.target.error);
            reject(`Transaction error on update: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: IndexedDB transaction aborted on update:`, event.target.error);
        };
    });
};


export const deleteItem = async (settings, inputData) => {
    const { item_id: itemId } = inputData;

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
                console.error(`[${PROVIDER_NAME}]: Error deleting image during item delete:`, event.target.error);
                transaction.abort();
                reject(`Error deleting image: ${event.target.error}`);
            }
        };

        // Delete item metadata
        const itemDeleteRequest = itemsStore.delete(itemId);
         itemDeleteRequest.onerror = (event) => {
             // Should not happen if we checked existence, but handle anyway
             if (event.target.error.name !== 'NotFoundError') {
                console.error(`[${PROVIDER_NAME}]: Error deleting item metadata:`, event.target.error);
                transaction.abort();
                reject(`Error deleting item metadata: ${event.target.error}`);
             }
        };

        transaction.oncomplete = () => {
            resolve({ success: true });
        };
        transaction.onerror = (event) => {
            console.error(`[${PROVIDER_NAME}]: IndexedDB transaction error on delete:`, event.target.error);
            reject(`Transaction error on delete: ${event.target.error}`);
        };
         transaction.onabort = (event) => {
            console.error(`[${PROVIDER_NAME}]: IndexedDB transaction aborted on delete:`, event.target.error);
        };
    });
};
