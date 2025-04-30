import React, { createContext, useContext, useState, useEffect } from 'react';
// We will create this file next
import * as datasetteProvider from './datasetteProvider';

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

export const ApiProvider = ({ children }) => {
    const [config, setConfig] = useState({
        providerType: 'none',
        baseUrl: '',
        apiToken: '',
        isConfigured: false,
    });
    const [apiMethods, setApiMethods] = useState({});

    useEffect(() => {
        // Read configuration from environment variables
        const providerType = import.meta.env.VITE_API_PROVIDER || 'datasette'; // Default to datasette
        let baseUrl = '';
        let apiToken = '';
        let isConfigured = false;
        let currentApiMethods = {};

        if (providerType === 'datasette') {
            baseUrl = import.meta.env.VITE_DATASATTE_URL || '';
            apiToken = import.meta.env.VITE_DATASATTE_TOKEN || ''; // Default to empty string
            isConfigured = !!baseUrl; // Consider configured if URL is set

            if (isConfigured) {
                // Bind Datasette provider methods with current config
                currentApiMethods = {
                    addLocation: (data) => datasetteProvider.addLocation(baseUrl, apiToken, data),
                    addCategory: (data) => datasetteProvider.addCategory(baseUrl, apiToken, data),
                    addImage: (data) => datasetteProvider.addImage(baseUrl, apiToken, data),
                    addItem: (data) => datasetteProvider.addItem(baseUrl, apiToken, data),
                    // Add other CRUD methods here as needed (get, update, delete)
                };
            } else {
                console.warn("Datasette provider selected, but VITE_DATASATTE_URL is not set.");
            }

        } else {
            console.warn(`Unsupported API provider type: ${providerType}`);
            // Handle other providers or show error/warning
        }

        setConfig({ providerType, baseUrl, apiToken, isConfigured });
        setApiMethods(currentApiMethods);

    }, []); // Run only once on mount

    // The value provided includes the config and the methods
    const value = {
        ...config,
        ...apiMethods, // Spread the API methods into the context value
    };

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    );
};
