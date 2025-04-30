import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// We will create this file next
import * as datasetteProvider from './datasetteProvider';

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Define localStorage keys
const LS_PROVIDER_TYPE = 'apiProviderType';
const LS_BASE_URL = 'apiBaseUrl';
const LS_API_TOKEN = 'apiToken';


export const ApiProvider = ({ children }) => {
    const [config, setConfig] = useState({
        providerType: 'none',
        baseUrl: '',
        apiToken: '',
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
                    // Only expose the composite addItem function
                    addItem: (compositeData) => datasetteProvider.addItem(currentConfig.baseUrl, currentConfig.apiToken, compositeData),
                    // Add other CRUD methods here as needed (e.g., getItems, updateItem, deleteItem)
                };
            }
            // Add else if blocks for other providers here
            // else if (currentConfig.providerType === 'homebox') { ... }
        }
        setApiMethods(newApiMethods);
    }, []); // No dependencies, as it relies on the passed currentConfig argument

    // Effect to load initial config from localStorage or env vars
    useEffect(() => {
        // 1. Try loading from localStorage
        let loadedProviderType = localStorage.getItem(LS_PROVIDER_TYPE);
        let loadedBaseUrl = localStorage.getItem(LS_BASE_URL);
        let loadedApiToken = localStorage.getItem(LS_API_TOKEN);

        // 2. Fallback to environment variables if localStorage is empty
        if (!loadedProviderType) {
            loadedProviderType = import.meta.env.VITE_API_PROVIDER || 'datasette'; // Default to datasette
            loadedBaseUrl = import.meta.env.VITE_DATASATTE_URL || ''; // Only relevant if provider is datasette initially
            loadedApiToken = import.meta.env.VITE_DATASATTE_TOKEN || ''; // Only relevant if provider is datasette initially
        }

        // Determine initial configuration state
        let initialConfig = {
            providerType: loadedProviderType,
            baseUrl: loadedBaseUrl || '', // Ensure not null
            apiToken: loadedApiToken || '', // Ensure not null
            isConfigured: false,
        };

        let isConfigured = false;
        if (initialConfig.providerType === 'datasette') {
            isConfigured = !!initialConfig.baseUrl; // Datasette needs URL
            if (!isConfigured) console.warn("Datasette provider selected, but Base URL is not set (checked localStorage and VITE_DATASATTE_URL).");
        }
        // Add checks for other providers here
        // else if (initialConfig.providerType === 'homebox') { isConfigured = !!initialConfig.baseUrl && !!initialConfig.apiToken }
        else if (initialConfig.providerType !== 'none') {
             console.warn(`Unsupported API provider type loaded: ${initialConfig.providerType}`);
        }
        initialConfig.isConfigured = isConfigured;

        setConfig(initialConfig);
        bindApiMethods(initialConfig); // Bind methods based on initial config

    }, [bindApiMethods]); // Run only once on mount

    // Function to update configuration and save to localStorage
    const updateConfiguration = useCallback((newConfig) => {
        localStorage.setItem(LS_PROVIDER_TYPE, newConfig.providerType);
        localStorage.setItem(LS_BASE_URL, newConfig.baseUrl);
        localStorage.setItem(LS_API_TOKEN, newConfig.apiToken);

        // Recalculate isConfigured based on the new settings
        let isConfigured = false;
        if (newConfig.providerType === 'datasette') {
            isConfigured = !!newConfig.baseUrl;
        }
        // Add checks for other providers here

        const updatedFullConfig = { ...newConfig, isConfigured };

        setConfig(updatedFullConfig); // Update state
        bindApiMethods(updatedFullConfig); // Re-bind API methods

    }, [bindApiMethods]); // Dependency on bindApiMethods

    // The value provided includes the config and the methods
    const value = {
        ...config,
        ...apiMethods, // Spread the API methods into the context value
        updateConfiguration, // Expose the update function
    };

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    );
};
