import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { providers, getProviderById } from "./providerRegistry"; // Import registry

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Define localStorage key for API provider configuration
export const LS_API_PROVIDER_CONFIG_KEY = "apiProviderConfig";

// --- Helper: Calculate Configuration Status --- (Moved before ApiProvider for clarity)
// Determines if the provider is configured based on its registry definition
const checkConfiguration = (providerType, settings) => {
  const provider = getProviderById(providerType);
  if (!provider || providerType === "none") {
    return false;
  }
  // Use the provider's specific check function if available
  if (provider.isConfiguredCheck) {
    return provider.isConfiguredCheck(settings);
  }
  // Fallback: check if all 'required' fields in the registry have a value
  return (
    provider.configFields?.every(
      (field) => !field.required || (settings && settings[field.key]),
    ) ?? false
  );
};

export const ApiProvider = ({ children }) => {
  // State now holds providerType, a generic settings object, and isConfigured flag
  // Initialize state from localStorage or defaults using a function for useState
  const [config, setConfig] = useState(() => {
    const savedConfig = localStorage.getItem(LS_API_PROVIDER_CONFIG_KEY);
    let initialConfig;

    if (savedConfig) {
      try {
        initialConfig = JSON.parse(savedConfig);
        // Basic validation and defaults for older formats
        initialConfig.providerType = initialConfig.providerType || "none";
        // Ensure settings is an object, even if null/undefined was saved
        initialConfig.settings = initialConfig.settings || {};
        // Ensure provider exists
        if (!getProviderById(initialConfig.providerType)) {
          console.warn(
            `Saved provider type "${initialConfig.providerType}" is invalid. Resetting to 'none'.`,
          );
          initialConfig.providerType = "none";
          initialConfig.settings = {};
        }
        // Remove isConfigured if it exists from older format
        delete initialConfig.isConfigured;
      } catch (e) {
        console.error("Failed to parse saved API config, using defaults.", e);
        initialConfig = null; // Reset if parsing failed
      }
    }

    // If no saved config or parsing failed, use hardcoded default
    if (!initialConfig) {
      const hardcodedDefaultProviderType = "indexedDB";

      // Initialize config structure
      initialConfig = {
        providerType: hardcodedDefaultProviderType,
        settings: {},
      };
    }

    // Always calculate isConfigured based on loaded/default provider and settings
    initialConfig.isConfigured = checkConfiguration(
      initialConfig.providerType,
      initialConfig.settings,
    );

    return initialConfig;
  });
  const [apiMethods, setApiMethods] = useState({}); // Holds bound API methods like { addItem: func }

  // --- Helper: Bind API Methods ---
  // Binds methods from the selected provider's module using the current settings
  const bindApiMethods = useCallback((currentConfig) => {
    const newApiMethods = {};
    const provider = getProviderById(currentConfig.providerType);

    if (provider && provider.module && currentConfig.isConfigured) {
      // Iterate through the methods listed in the registry for this provider
      provider.methods.forEach((methodName) => {
        const methodImpl = provider.module[methodName];
        if (typeof methodImpl === "function") {
          // Bind the method, passing the current settings object as the first argument
          // Subsequent arguments (like 'data' for addItem) will be passed automatically
          newApiMethods[methodName] = (...args) =>
            methodImpl(currentConfig.settings, ...args);
        } else {
          console.warn(
            `Method '${methodName}' not found or not a function in provider module for '${currentConfig.providerType}'.`,
          );
        }
      });
    }
    setApiMethods(newApiMethods);
  }, []); // No dependencies needed as it uses the passed currentConfig

  // --- Effect: Bind API Methods on Config Change ---
  // Re-bind methods whenever the config object changes.
  useEffect(() => {
    bindApiMethods(config);
  }, [config, bindApiMethods]); // Re-run if config or bindApiMethods changes

  // --- Function: Update Configuration ---
  // Updates the config state, saves to localStorage (single key), and triggers re-binding via useEffect.
  const updateConfiguration = useCallback((newConfigData) => {
    // newConfigData is expected to be an object like:
    // { providerType: 'datasette', settings: { datasetteBaseUrl: '...', datasetteApiToken: '...' } }
    // coming from the SettingsView save handler.

    const { providerType, settings } = newConfigData;
    const provider = getProviderById(providerType);

    if (!provider) {
      console.error(
        `Cannot update configuration: Invalid provider type '${providerType}'`,
      );
      return; // Or handle error appropriately
    }

    // 1. Extract only the relevant settings for the selected provider based on registry
    const relevantSettings = {};
    const currentSettings = settings || {}; // Use provided settings or empty object
    if (provider.configFields) {
      provider.configFields.forEach((field) => {
        // Store the value from newConfigData.settings or default to empty string
        relevantSettings[field.key] = currentSettings[field.key] ?? "";
      });
    }

    // 2. Recalculate configuration status
    const isConfigured = checkConfiguration(providerType, relevantSettings);

    // 3. Construct the final config object for state and storage
    const updatedFullConfig = {
      providerType: providerType,
      settings: relevantSettings, // Store only relevant settings
      isConfigured: isConfigured,
    };

    // 4. Update state - this will trigger the useEffect to re-bind methods
    setConfig(updatedFullConfig);

    // 5. Prepare the object to save (without isConfigured)
    const configToSave = {
      providerType: updatedFullConfig.providerType,
      settings: updatedFullConfig.settings,
    };
    // 6. Persist only providerType and settings to localStorage
    try {
      localStorage.setItem(
        LS_API_PROVIDER_CONFIG_KEY,
        JSON.stringify(configToSave),
      );
    } catch (error) {
      console.error("Failed to save API config to localStorage:", error);
      // Optionally notify the user
    }
  }, []); // No dependencies needed here, relies on closure values

  // --- Context Value ---
  // Expose the config object, bound API methods, and the update function
  const value = {
    config: config, // Contains { providerType, settings, isConfigured }
    ...apiMethods, // Spread bound methods (e.g., addItem)
    updateConfiguration, // Function to update settings
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
