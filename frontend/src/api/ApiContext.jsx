import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { providers, getProviderById } from './providerRegistry'; // Import registry

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Define localStorage key for the selected provider type
const LS_PROVIDER_TYPE = 'apiProviderType';

export const ApiProvider = ({ children }) => {
    // State now holds providerType, a generic settings object, and isConfigured flag
    const [config, setConfig] = useState({
        providerType: 'none', // Default to 'none'
        settings: {},         // Holds provider-specific settings like { datasetteBaseUrl: '...' }
        isConfigured: false,
    });
    const [apiMethods, setApiMethods] = useState({}); // Holds bound API methods like { addItem: func }

    // --- Helper: Bind API Methods ---
    // Binds methods from the selected provider's module using the current settings
    const bindApiMethods = useCallback((currentConfig) => {
        const newApiMethods = {};
        const provider = getProviderById(currentConfig.providerType);

        if (provider && provider.module && currentConfig.isConfigured) {
            // Iterate through the methods listed in the registry for this provider
            provider.methods.forEach(methodName => {
                const methodImpl = provider.module[methodName];
                if (typeof methodImpl === 'function') {
                    // Bind the method, passing the current settings object as the first argument
                    // Subsequent arguments (like 'data' for addItem) will be passed automatically
                    newApiMethods[methodName] = (...args) => methodImpl(currentConfig.settings, ...args);
                } else {
                    console.warn(`Method '${methodName}' not found or not a function in provider module for '${currentConfig.providerType}'.`);
                }
            });
        }
        setApiMethods(newApiMethods);
    }, []); // No dependencies needed as it uses the passed currentConfig

    // --- Helper: Calculate Configuration Status ---
    // Determines if the provider is configured based on its registry definition
    const checkConfiguration = (providerType, settings) => {
        const provider = getProviderById(providerType);
        if (!provider || providerType === 'none') {
            return false;
        }
        // Use the provider's specific check function if available
        if (provider.isConfiguredCheck) {
            return provider.isConfiguredCheck(settings);
        }
        // Fallback: check if all 'required' fields in the registry have a value
        return provider.configFields?.every(field =>
            !field.required || (settings && settings[field.key])
        ) ?? false;
    };

    // --- Effect: Load Initial Configuration ---
    // Runs once on mount to load config from localStorage or environment variables
    useEffect(() => {
        // 1. Determine the initial provider type
        let initialProviderType = localStorage.getItem(LS_PROVIDER_TYPE) || import.meta.env.VITE_API_PROVIDER || 'none';
        const provider = getProviderById(initialProviderType);

        if (!provider) {
            console.warn(`Invalid provider type loaded ('${initialProviderType}'). Falling back to 'none'.`);
            initialProviderType = 'none';
        }

        // 2. Load settings for the determined provider type
        const initialSettings = {};
        const selectedProvider = getProviderById(initialProviderType); // Get definition again

        if (selectedProvider && selectedProvider.configFields) {
            selectedProvider.configFields.forEach(field => {
                // Prioritize localStorage, then environment variable, then default to empty/null
                const lsValue = localStorage.getItem(field.localStorageKey);
                const envValue = import.meta.env[field.envVar];
                initialSettings[field.key] = lsValue ?? envValue ?? ''; // Use nullish coalescing
            });
        }

        // 3. Calculate initial configuration status
        const isConfigured = checkConfiguration(initialProviderType, initialSettings);
        if (initialProviderType !== 'none' && !isConfigured) {
             console.warn(`${selectedProvider.displayName} provider is selected, but it's not fully configured based on required settings.`);
        }


        // 4. Set the initial state
        const initialConfig = {
            providerType: initialProviderType,
            settings: initialSettings,
            isConfigured: isConfigured,
        };
        setConfig(initialConfig);
        bindApiMethods(initialConfig); // Bind methods based on loaded config

    }, [bindApiMethods]); // Run only once on mount

    // --- Function: Update Configuration ---
    // Updates the config state, saves to localStorage, and re-binds API methods
    const updateConfiguration = useCallback((newSettings) => {
        // newSettings is expected to be an object like { providerType: 'datasette', datasetteBaseUrl: '...', ... }
        // coming directly from the SettingsView form state.

        const { providerType, ...providerSpecificSettings } = newSettings;
        const provider = getProviderById(providerType);

        if (!provider) {
            console.error(`Cannot update configuration: Invalid provider type '${providerType}'`);
            return; // Or handle error appropriately
        }

        // 1. Save provider type to localStorage
        localStorage.setItem(LS_PROVIDER_TYPE, providerType);

        // 2. Save provider-specific settings to localStorage
        const settingsToSave = {};
        if (provider.configFields) {
            provider.configFields.forEach(field => {
                const valueToSave = providerSpecificSettings[field.key] ?? ''; // Default to empty string if undefined/null
                localStorage.setItem(field.localStorageKey, valueToSave);
                settingsToSave[field.key] = valueToSave; // Build the settings object for state
            });
        }

         // 3. Recalculate configuration status
        const isConfigured = checkConfiguration(providerType, settingsToSave);

        // 4. Update state
        const updatedFullConfig = {
            providerType: providerType,
            settings: settingsToSave,
            isConfigured: isConfigured,
        };
        setConfig(updatedFullConfig);

        // 5. Re-bind API methods for the new configuration
        bindApiMethods(updatedFullConfig);

    }, [bindApiMethods]); // Dependency on bindApiMethods

    // --- Context Value ---
    // Expose the config object, bound API methods, and the update function
    const value = {
        config: config,        // Contains { providerType, settings, isConfigured }
        ...apiMethods,         // Spread bound methods (e.g., addItem)
        updateConfiguration,   // Function to update settings
    };

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    );
};
