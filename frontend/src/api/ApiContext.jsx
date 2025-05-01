import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as datasetteProvider from './datasetteProvider';

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Define localStorage keys
const LS_PROVIDER_TYPE = 'apiProviderType';
// Provider-specific keys
const LS_DATASETTE_BASE_URL = 'datasetteBaseUrl';
const LS_DATASETTE_API_TOKEN = 'datasetteApiToken';
// Add keys for other providers here later (e.g., LS_HOMEBOX_URL)

export const ApiProvider = ({ children }) => {
    const [config, setConfig] = useState({
        providerType: 'none',
        datasetteBaseUrl: '', // Specific to datasette
        datasetteApiToken: '', // Specific to datasette
        isConfigured: false,
    });
    const [apiMethods, setApiMethods] = useState({});

    // Function to bind API methods based on current config
    // Use useCallback to memoize it, preventing unnecessary re-renders if passed down
    const bindApiMethods = useCallback((currentConfig) => {
        let newApiMethods = {};
        if (currentConfig.isConfigured) {
            if (currentConfig.providerType === 'datasette') {
                // Bind Datasette provider methods with current config
                newApiMethods = {
                    // Pass provider-specific config values
                    addItem: (compositeData) => datasetteProvider.addItem(currentConfig.datasetteBaseUrl, currentConfig.datasetteApiToken, compositeData),
                    // Add other CRUD methods here as needed (e.g., getItems, updateItem, deleteItem)
                };
            }
            // Add else if blocks for other providers here
            // else if (currentConfig.providerType === 'homebox') { ... }
        }
        setApiMethods(newApiMethods);
    }, []);

    // Effect to load initial config from localStorage or env vars
    useEffect(() => {
        // 1. Try loading from localStorage
        let loadedProviderType = localStorage.getItem(LS_PROVIDER_TYPE);
        let loadedDatasetteBaseUrl = localStorage.getItem(LS_DATASETTE_BASE_URL);
        let loadedDatasetteApiToken = localStorage.getItem(LS_DATASETTE_API_TOKEN);
        // Load settings for other providers here later

        // 2. Fallback to environment variables if localStorage is empty
        if (!loadedProviderType) {
            loadedProviderType = import.meta.env.VITE_API_PROVIDER || 'datasette';
            // Only load ENV vars if the corresponding LS item was *also* empty
            if (!loadedDatasetteBaseUrl) { // Use correct env var name
                loadedDatasetteBaseUrl = import.meta.env.VITE_DATASETTE_URL || '';
            }
            if (!loadedDatasetteApiToken) { // Use correct env var name
                loadedDatasetteApiToken = import.meta.env.VITE_DATASETTE_TOKEN || '';
            }
            // Load ENV vars for other providers here later
        }

        // Determine initial configuration state
        let initialConfig = {
            providerType: loadedProviderType,
            datasetteBaseUrl: loadedDatasetteBaseUrl || '',
            datasetteApiToken: loadedDatasetteApiToken || '',
            // Add other provider settings here
            isConfigured: false,
        };

        let isConfigured = false;
        if (initialConfig.providerType === 'datasette') {
            isConfigured = !!initialConfig.datasetteBaseUrl; // Datasette needs URL
            if (!isConfigured) console.warn("Datasette provider selected, but Base URL is not set (checked localStorage and VITE_DATASETTE_URL).");
        } // Add checks for other providers here (e.g., homebox might need URL and token)
        else if (initialConfig.providerType !== 'none') {
             console.warn(`Unsupported API provider type loaded: ${initialConfig.providerType}`);
        }
        initialConfig.isConfigured = isConfigured;

        setConfig(initialConfig);
        bindApiMethods(initialConfig);

    }, [bindApiMethods]);

    // Function to update configuration and save to localStorage
    const updateConfiguration = useCallback((newConfig) => {
        // newConfig contains providerType and all potential provider settings
        localStorage.setItem(LS_PROVIDER_TYPE, newConfig.providerType);
        // Save specific settings based on provider (or save all for simplicity now)
        localStorage.setItem(LS_DATASETTE_BASE_URL, newConfig.datasetteBaseUrl || '');
        localStorage.setItem(LS_DATASETTE_API_TOKEN, newConfig.datasetteApiToken || '');
        // Save settings for other providers here later

        // Recalculate isConfigured based on the new settings
        let isConfigured = false;
        if (newConfig.providerType === 'datasette') {
            isConfigured = !!newConfig.datasetteBaseUrl;
        } else if (newConfig.providerType === 'none') {
            isConfigured = false;
        }
        // Add checks for other providers here

        const updatedFullConfig = { ...newConfig, isConfigured };

        setConfig(updatedFullConfig); // Update state
        bindApiMethods(updatedFullConfig); // Re-bind API methods

    }, [bindApiMethods]);

    // The value provided includes the config and the methods
    const value = { // Expose only what's needed or the full config
        config: config, // Pass the whole config object
        ...apiMethods, // Spread the API methods into the context value
        updateConfiguration, // Expose the update function
    };

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    );
};
