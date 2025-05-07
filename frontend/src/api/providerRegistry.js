import * as datasetteProvider from './datasetteProvider';
import * as indexedDBProvider from './indexedDBProvider';
import * as postgrestProvider from './postgrestProvider';
// import * as homeboxProvider from './homeboxProvider';

/**
 * Canonical list of API methods that all providers must implement.
 */
export const REQUIRED_API_METHODS = [
    'listLocations',
    'addLocation',
    'updateLocation',
    'deleteLocation',
    'listCategories',
    'addCategory',
    'updateCategory',
    'deleteCategory',
    'listItems',
    'addItem',
    'updateItem',
    'deleteItem',
    'listOwners',
    'addOwner',
    'updateOwner',
    'deleteOwner',
    'exportData',
    'importData',
    'destroyData',
];

/**
 * Defines the configuration and capabilities of each supported API provider.
 */
export const providers = {
    // --- Datasette Provider Definition ---
    'datasette': {
        id: 'datasette',
        displayName: 'Datasette',
        module: datasetteProvider, // Reference to the provider's implementation
        // Define the configuration fields required by this provider
        configFields: [
            {
                key: 'datasetteBaseUrl',        // Key used in the settings state object
                label: 'settings.api.fields.datasetteBaseUrl.label',    // Label for the settings form
                type: 'text',                   // Input type for the form
                placeholder: 'settings.api.fields.datasetteBaseUrl.placeholder', // Placeholder text
                localStorageKey: 'datasetteBaseUrl', // Key for storing in localStorage
                required: true,                 // Is this field mandatory for the provider to be configured?
            },
            {
                key: 'datasetteApiToken',
                label: 'settings.api.fields.datasetteApiToken.label',
                type: 'password',
                placeholder: 'settings.api.fields.datasetteApiToken.placeholder',
                localStorageKey: 'datasetteApiToken',
                required: false,
            }
        ],
        // Function to determine if the provider is considered configured based on its settings
        isConfiguredCheck: (settings) => !!settings?.datasetteBaseUrl,
    },

    // --- IndexedDB Provider Definition ---
    'indexedDB': {
        id: 'indexedDB',
        displayName: 'IndexedDB (Browser)',
        module: indexedDBProvider,
        configFields: [],
        isConfiguredCheck: () => true, // Always configured as it needs no settings
    },

    // --- PostgREST Provider Definition ---
    'postgrest': {
        id: 'postgrest',
        displayName: 'PostgREST API', // Clarify it's the API layer
        module: postgrestProvider,
        configFields: [
            {
                key: 'postgrestApiUrl',
                label: 'settings.api.fields.postgrestApiUrl.label', // Need to add this translation key
                type: 'text',
                placeholder: 'settings.api.fields.postgrestApiUrl.placeholder', // Need to add this translation key
                localStorageKey: 'postgrestApiUrl', // Matches key
                required: true,
            },
            {
                key: 'postgrestApiToken', // For JWT auth if PostgREST is configured for it
                label: 'settings.api.fields.postgrestApiToken.label', // Need to add this translation key
                type: 'password',
                placeholder: 'settings.api.fields.postgrestApiToken.placeholder', // Need to add this translation key
                localStorageKey: 'postgrestApiToken', // Matches key
                required: true, // Token is now mandatory for authenticated access
            }
        ],
        isConfiguredCheck: (settings) => !!settings?.postgrestApiUrl && !!settings?.postgrestApiToken, // Check both URL and Token
    },
};

/**
 * Gets a list of available provider IDs (e.g., ['datasette', 'none']).
 * @returns {string[]} Array of provider IDs.
 */
export const getProviderIds = () => Object.keys(providers);

/**
 * Gets the full definition object for a specific provider by its ID.
 * @param {string} id - The ID of the provider (e.g., 'datasette').
 * @returns {object | undefined} The provider definition object or undefined if not found.
 */
export const getProviderById = (id) => providers[id];

/**
 * Gets the display names for all providers.
 * @returns {object} An object mapping provider IDs to display names.
 */
export const getProviderDisplayNames = () => {
    return Object.entries(providers).reduce((acc, [id, provider]) => {
        acc[id] = provider.displayName;
        return acc;
    }, {});
};

/**
 * Verifies that all registered providers with a module implement the required API methods.
 * Logs an error for any missing methods.
 */
function verifyProviderMethods() {
    Object.values(providers).forEach(provider => {
        if (provider.module && provider.id !== 'none') { // Check only if module is defined and not the 'none' provider
            REQUIRED_API_METHODS.forEach(methodName => {
                if (typeof provider.module[methodName] !== 'function') {
                    console.error(
                        `API Provider Verification Error: Provider '${provider.displayName}' (ID: '${provider.id}') ` +
                        `is missing the required method '${methodName}'. ` +
                        `This may lead to runtime errors if this provider is selected.`
                    );
                    // Optionally, to make this a hard stop:
                    // throw new Error(`Provider '${provider.displayName}' (ID: '${provider.id}') missing required method '${methodName}'.`);
                }
            });
        }
    });
}

// Perform the verification when this module is loaded.
verifyProviderMethods();
