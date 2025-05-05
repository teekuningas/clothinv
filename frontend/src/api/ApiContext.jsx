import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSettings } from "../settings/SettingsContext"; // Import useSettings
import { providers, getProviderById } from "./providerRegistry"; // Import registry

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

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
  // Get settings from the centralized SettingsContext
  const { settings } = useSettings();
  const { apiProviderType, apiSettings } = settings; // Destructure relevant settings

  // Calculate isConfigured based on settings from context
  const isConfigured = checkConfiguration(apiProviderType, apiSettings);

  const [apiMethods, setApiMethods] = useState({}); // Holds bound API methods like { addItem: func }

  // --- Helper: Bind API Methods ---
  // Binds methods from the selected provider's module using the current settings
  const bindApiMethods = useCallback(
    (providerType, currentApiSettings, configured) => {
      const newApiMethods = {};
      const provider = getProviderById(providerType);

      if (provider && provider.module && configured) {
        // Iterate through the methods listed in the registry for this provider
        provider.methods.forEach((methodName) => {
          const methodImpl = provider.module[methodName];
          if (typeof methodImpl === "function") {
            // Bind the method, passing the current settings object as the first argument
            // Subsequent arguments (like 'data' for addItem) will be passed automatically
            newApiMethods[methodName] = (...args) =>
              methodImpl(currentApiSettings, ...args); // Pass only apiSettings
          } else {
            console.warn(
              `Method '${methodName}' not found or not a function in provider module for '${providerType}'.`,
            );
          }
        });
      }
      setApiMethods(newApiMethods);
    },
    [],
  ); // No dependencies needed as it uses the passed currentConfig

  // --- Effect: Bind API Methods on Config Change ---
  // Re-bind methods whenever the config object changes.
  // Use apiProviderType, apiSettings, and isConfigured from context/calculation
  useEffect(() => {
    bindApiMethods(apiProviderType, apiSettings, isConfigured);
  }, [apiProviderType, apiSettings, isConfigured, bindApiMethods]); // Depend on relevant settings and calculated status

  // REMOVED updateConfiguration function - This is now handled by SettingsContext.updateSettings

  // --- Context Value ---
  const value = {
    // Provide relevant parts of the config and the calculated status
    apiProviderType: apiProviderType,
    apiSettings: apiSettings,
    isConfigured: isConfigured,
    ...apiMethods, // Spread bound methods (e.g., addItem)
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
