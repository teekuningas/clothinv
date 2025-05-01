import * as datasetteProvider from './datasetteProvider';
// Import other provider modules here when added
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
            'addItem',
            'listLocations',
            'addLocation',
            'updateLocation',
            'deleteLocation',
            'listCategories', // Add this
            'addCategory',    // Add this
            'updateCategory', // Add this (for future use)
            'deleteCategory'  // Add this (for future use)
            /*, 'getItems', 'updateItem', 'deleteItem' */
        ]
    },

    // --- Homebox Provider Definition (Example Placeholder) ---
    /*
    'homebox': {
        id: 'homebox',
        displayName: 'Homebox',
        module: homeboxProvider, // Assumes homeboxProvider.js exists and is imported
        configFields: [
            {
                key: 'homeboxUrl',
                label: 'Homebox Instance URL',
                type: 'text',
                placeholder: 'e.g., https://my-homebox.com',
                envVar: 'VITE_HOMEBOX_URL',
                localStorageKey: 'homeboxUrl',
                required: true,
            },
            {
                key: 'homeboxApiKey',
                label: 'Homebox API Key',
                type: 'password',
                placeholder: 'Paste your Homebox API key',
                envVar: 'VITE_HOMEBOX_API_KEY',
                localStorageKey: 'homeboxApiKey',
                required: true,
            }
        ],
        isConfiguredCheck: (settings) => !!settings?.homeboxUrl && !!settings?.homeboxApiKey,
        methods: ['addItem', 'getItems', 'updateItem', 'deleteItem'] // Example methods
    },
    */

    // --- None Provider Definition ---
    'none': {
        id: 'none',
        displayName: 'None',
        module: null,
        configFields: [],
        isConfiguredCheck: () => false,
        methods: []
    }
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
