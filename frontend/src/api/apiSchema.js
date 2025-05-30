
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
 * @property {number|null} price
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

/** @typedef {{ location_id: ProviderID, name: string, description?: string | null }} UpdateLocationInputData */
export const UpdateLocationInputSchema = Object;
/** @typedef {{ success: boolean, message?: string }} UpdateLocationOutput */
export const UpdateLocationOutputSchema = Object;

/** @typedef {{ location_id: ProviderID }} DeleteLocationInputData */
export const DeleteLocationInputSchema = Object;
/** @typedef {{ success: boolean, message?: string, errorCode?: string }} DeleteLocationOutput */
export const DeleteLocationOutputSchema = Object;

// --- Category Methods ---
export const ListCategoriesInputSchema = undefined;
/** @typedef {Category[]} ListCategoriesOutput */
export const ListCategoriesOutputSchema = Array; // Array of Category

/** @typedef {{ name: string, description?: string | null, uuid?: UUID }} AddCategoryInputData */
export const AddCategoryInputSchema = Object;
/** @typedef {{ success: boolean, newId: ProviderID, uuid: UUID, message?: string }} AddCategoryOutput */
export const AddCategoryOutputSchema = Object;

/** @typedef {{ category_id: ProviderID, name: string, description?: string | null }} UpdateCategoryInputData */
export const UpdateCategoryInputSchema = Object;
/** @typedef {{ success: boolean, message?: string }} UpdateCategoryOutput */
export const UpdateCategoryOutputSchema = Object;

/** @typedef {{ category_id: ProviderID }} DeleteCategoryInputData */
export const DeleteCategoryInputSchema = Object;
/** @typedef {{ success: boolean, message?: string, errorCode?: string }} DeleteCategoryOutput */
export const DeleteCategoryOutputSchema = Object;

// --- Owner Methods ---
export const ListOwnersInputSchema = undefined;
/** @typedef {Owner[]} ListOwnersOutput */
export const ListOwnersOutputSchema = Array; // Array of Owner

/** @typedef {{ name: string, description?: string | null, uuid?: UUID }} AddOwnerInputData */
export const AddOwnerInputSchema = Object;
/** @typedef {{ success: boolean, newId: ProviderID, uuid: UUID, message?: string }} AddOwnerOutput */
export const AddOwnerOutputSchema = Object;

/** @typedef {{ owner_id: ProviderID, name: string, description?: string | null }} UpdateOwnerInputData */
export const UpdateOwnerInputSchema = Object;
/** @typedef {{ success: boolean, message?: string }} UpdateOwnerOutput */
export const UpdateOwnerOutputSchema = Object;

/** @typedef {{ owner_id: ProviderID }} DeleteOwnerInputData */
export const DeleteOwnerInputSchema = Object;
/** @typedef {{ success: boolean, message?: string, errorCode?: string }} DeleteOwnerOutput */
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
 * @property {(number|string|null)=} price
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
 * @property {(number|string|null)=} price
 * @property {(boolean)=} removeImage
 */
export const UpdateItemInputSchema = Object;
/**
 * @typedef {object} UpdateItemOutput
 * @property {boolean} success
 * @property {(UUID | null)=} image_uuid - Resulting image_uuid for the item.
 * @property {string=} message
 */
export const UpdateItemOutputSchema = Object;

/** @typedef {{ item_id: ProviderID }} DeleteItemInputData */
export const DeleteItemInputSchema = Object;
/** @typedef {{ success: boolean, message?: string }} DeleteItemOutput */
export const DeleteItemOutputSchema = Object;

// --- Image Methods ---
/** @typedef {{ image_uuid: UUID }} GetImageInputData */
export const GetImageInputSchema = Object;
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
 * @property {string=} message - General success summary or info (UI might construct more detailed messages using counts).
 * @property {string=} errorKey - Translation key for an error message.
 * @property {object=} errorValues - Values for the errorKey template.
 * @property {string=} error - Fallback error message if errorKey is not available.
 */
export const ImportDataOutputSchema = Object;

export const DestroyDataInputSchema = undefined;
/**
 * @typedef {object} DestroyDataOutput
 * @property {boolean} success
 * @property {string=} summaryKey - Translation key for a success message.
 * @property {object=} summaryValues - Values for the summaryKey template.
 * @property {string=} summary - Fallback success summary if summaryKey is not available.
 * @property {string=} errorKey - Translation key for an error message.
 * @property {object=} errorValues - Values for the errorKey template.
 * @property {string=} error - Fallback error message if errorKey is not available.
 */
export const DestroyDataOutputSchema = Object;
