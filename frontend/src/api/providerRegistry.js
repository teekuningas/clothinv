import * as datasetteProvider from './datasetteProvider';
// Import other provider modules here when added
import * as localStorageProvider from './localStorageProvider'; // Add this import
// import * as homeboxProvider from './homeboxProvider';

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
                label: 'Datasette Base URL',    // Label for the settings form
                type: 'text',                   // Input type for the form
                placeholder: 'e.g., http://localhost:8001/data', // Placeholder text
                envVar: 'VITE_DATASETTE_URL',   // Corresponding environment variable
                localStorageKey: 'datasetteBaseUrl', // Key for storing in localStorage
                required: true,                 // Is this field mandatory for the provider to be configured?
            },
            {
                key: 'datasetteApiToken',
                label: 'Datasette API Token (Optional)',
                type: 'password',
                placeholder: 'Paste token if required',
                envVar: 'VITE_DATASETTE_TOKEN',
                localStorageKey: 'datasetteApiToken',
                required: false,
            }
        ],
        // Function to determine if the provider is considered configured based on its settings
        isConfiguredCheck: (settings) => !!settings?.datasetteBaseUrl,
        // List the API methods this provider implements (must match exports from the module)
        methods: [
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
        ]
    },

    // --- Local Storage Provider Definition ---
    'localStorage': {
        id: 'localStorage',
        displayName: 'Local Storage (Browser)',
        module: localStorageProvider, // Reference the new module
        configFields: [],
        isConfiguredCheck: () => true, // Always configured as it needs no settings
        // Ensure this list matches the methods provided by datasetteProvider
        methods: [
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
        ]
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
