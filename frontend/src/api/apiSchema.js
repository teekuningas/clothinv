
// --- Common Type Definitions ---
/** @typedef {number} ProviderID - Provider-specific numeric ID. */
/** @typedef {string} UUID - A v4 UUID string. */
/** @typedef {string | null} Timestamp - ISO 8601 date-time string or null. */
/** @typedef {File} FileObject - Browser's File object. */
/** @typedef {Blob} BlobObject - Browser's Blob object. */

// --- Entity Schemas (Common structure for list outputs and individual representation) ---

/**
 * @typedef {object} Location
 * @property {ProviderID} location_id
 * @property {UUID} uuid
 * @property {string} name
 * @property {string | null} description
 * @property {Timestamp} created_at
 * @property {Timestamp} updated_at
 */

/**
 * @typedef {object} Category
 * @property {ProviderID} category_id
 * @property {UUID} uuid
 * @property {string} name
 * @property {string | null} description
 * @property {Timestamp} created_at
 * @property {Timestamp} updated_at
 */

/**
 * @typedef {object} Owner
 * @property {ProviderID} owner_id
 * @property {UUID} uuid
 * @property {string} name
 * @property {string | null} description
 * @property {Timestamp} created_at
 * @property {Timestamp} updated_at
 */

/**
 * @typedef {object} ItemMetadata
 * @property {ProviderID} item_id
 * @property {UUID} uuid
 * @property {string} name
 * @property {string | null} description
 * @property {ProviderID} location_id
 * @property {ProviderID} category_id
 * @property {ProviderID} owner_id
 * @property {ProviderID | null} image_id - Provider-specific ID for the image record.
 * @property {UUID | null} image_uuid - UUID for the image content.
 * @property {Timestamp} created_at
 * @property {Timestamp} updated_at
 */

// --- API Method Schemas ---

// --- Location Methods ---
export const ListLocationsInputSchema = undefined; // No app-specific input beyond settings
/** @typedef {Location[]} ListLocationsOutput */
export const ListLocationsOutputSchema = Array; // Array of Location

/** @typedef {{ name: string, description?: string | null, uuid?: UUID }} AddLocationInputData */
export const AddLocationInputSchema = Object;
/** @typedef {{ success: boolean, newId: ProviderID, uuid: UUID, message?: string }} AddLocationOutput */
export const AddLocationOutputSchema = Object;

/** @typedef {{ name: string, description?: string | null }} UpdateLocationInputData */
export const UpdateLocationInputSchema = Object; // locationId is a separate param
/** @typedef {{ success: boolean, message?: string }} UpdateLocationOutput */
export const UpdateLocationOutputSchema = Object;

export const DeleteLocationInputSchema = undefined; // locationId is a separate param
/** @typedef {{ success: boolean, message?: string }} DeleteLocationOutput */
export const DeleteLocationOutputSchema = Object;

// --- Category Methods ---
export const ListCategoriesInputSchema = undefined;
/** @typedef {Category[]} ListCategoriesOutput */
export const ListCategoriesOutputSchema = Array; // Array of Category

/** @typedef {{ name: string, description?: string | null, uuid?: UUID }} AddCategoryInputData */
export const AddCategoryInputSchema = Object;
/** @typedef {{ success: boolean, newId: ProviderID, uuid: UUID, message?: string }} AddCategoryOutput */
export const AddCategoryOutputSchema = Object;

/** @typedef {{ name: string, description?: string | null }} UpdateCategoryInputData */
export const UpdateCategoryInputSchema = Object; // categoryId is a separate param
/** @typedef {{ success: boolean, message?: string }} UpdateCategoryOutput */
export const UpdateCategoryOutputSchema = Object;

export const DeleteCategoryInputSchema = undefined; // categoryId is a separate param
/** @typedef {{ success: boolean, message?: string }} DeleteCategoryOutput */
export const DeleteCategoryOutputSchema = Object;

// --- Owner Methods ---
export const ListOwnersInputSchema = undefined;
/** @typedef {Owner[]} ListOwnersOutput */
export const ListOwnersOutputSchema = Array; // Array of Owner

/** @typedef {{ name: string, description?: string | null, uuid?: UUID }} AddOwnerInputData */
export const AddOwnerInputSchema = Object;
/** @typedef {{ success: boolean, newId: ProviderID, uuid: UUID, message?: string }} AddOwnerOutput */
export const AddOwnerOutputSchema = Object;

/** @typedef {{ name: string, description?: string | null }} UpdateOwnerInputData */
export const UpdateOwnerInputSchema = Object; // ownerId is a separate param
/** @typedef {{ success: boolean, message?: string }} UpdateOwnerOutput */
export const UpdateOwnerOutputSchema = Object;

export const DeleteOwnerInputSchema = undefined; // ownerId is a separate param
/** @typedef {{ success: boolean, message?: string }} DeleteOwnerOutput */
export const DeleteOwnerOutputSchema = Object;

// --- Item Methods ---
export const ListItemsInputSchema = undefined;
/** @typedef {ItemMetadata[]} ListItemsOutput */
export const ListItemsOutputSchema = Array; // Array of ItemMetadata

/**
 * @typedef {object} AddItemInputData
 * @property {string} name
 * @property {(string | null)=} description
 * @property {ProviderID} location_id
 * @property {ProviderID} category_id
 * @property {ProviderID} owner_id
 * @property {(FileObject | null)=} imageFile
 * @property {UUID=} uuid - Optional item UUID (for import).
 * @property {UUID=} image_uuid - Optional image UUID (for import, if imageFile is also provided).
 */
export const AddItemInputSchema = Object;
/**
 * @typedef {object} AddItemOutput
 * @property {boolean} success
 * @property {ProviderID=} newId - ID of the created item.
 * @property {UUID=} uuid - UUID of the created item.
 * @property {(UUID | null)=} image_uuid - UUID of the processed image, if any.
 * @property {string=} message
 */
export const AddItemOutputSchema = Object;

/**
 * @typedef {object} UpdateItemInputData
 * @property {string} name
 * @property {(string | null)=} description
 * @property {ProviderID} location_id
 * @property {ProviderID} category_id
 * @property {ProviderID} owner_id
 * @property {(FileObject | null)=} imageFile
 * @property {(boolean)=} removeImage
 */
export const UpdateItemInputSchema = Object; // itemId is a separate param
/**
 * @typedef {object} UpdateItemOutput
 * @property {boolean} success
 * @property {(UUID | null)=} image_uuid - Resulting image_uuid for the item.
 * @property {string=} message
 */
export const UpdateItemOutputSchema = Object;

export const DeleteItemInputSchema = undefined; // itemId is a separate param
/** @typedef {{ success: boolean, message?: string }} DeleteItemOutput */
export const DeleteItemOutputSchema = Object;

// --- Image Methods ---
export const GetImageInputSchema = undefined; // imageUuid is a separate param
/** @typedef {FileObject | null} GetImageOutput */
export const GetImageOutputSchema = FileObject; // Or null

// --- Data Management Methods ---
export const ExportDataInputSchema = undefined;
/** @typedef {BlobObject} ExportDataOutput */ // Providers should throw on error.
export const ExportDataOutputSchema = BlobObject;

/** @typedef {FileObject} ImportDataInputData - The .zip File to import. */
export const ImportDataInputSchema = FileObject; // zipFile is the param
/**
 * @typedef {object} ImportDataOutput
 * @property {boolean} success
 * @property {{ locations?: number, categories?: number, owners?: number, items?: number }=} counts
 * @property {string=} message - Success summary or general info.
 * @property {string=} error - Error details if success is false.
 */
export const ImportDataOutputSchema = Object;

export const DestroyDataInputSchema = undefined;
/**
 * @typedef {object} DestroyDataOutput
 * @property {boolean} success
 * @property {string=} summary - Summary message on success.
 * @property {string=} error - Error details if success is false.
 */
export const DestroyDataOutputSchema = Object;
