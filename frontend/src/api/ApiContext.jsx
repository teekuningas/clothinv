import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSettings } from "../settings/SettingsContext";
import { providers, getProviderById, REQUIRED_API_METHODS } from "./providerRegistry";

const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// --- Helper: Calculate Configuration Status --- (Moved before ApiProvider for clarity)
const checkConfiguration = (providerType, settings) => {
  const provider = getProviderById(providerType);
  if (!provider || providerType === "none") {
    return false;
  }
  const providerSpecificSettings = settings?.[providerType] || {};

  if (provider.isConfiguredCheck) {
    return provider.isConfiguredCheck(providerSpecificSettings);
  }
  return (
    provider.configFields?.every(
      (field) =>
        !field.required ||
        (providerSpecificSettings && providerSpecificSettings[field.key]),
    ) ?? false
  );
};

export const ApiProvider = ({ children }) => {
  const { settings } = useSettings();
  const { apiProviderType, apiSettings } = settings;

  const isConfigured = checkConfiguration(apiProviderType, apiSettings);

  const [apiMethods, setApiMethods] = useState({});

  // --- Helper: Bind API Methods ---
  const bindApiMethods = useCallback(
    (providerType, currentApiSettings, configured) => {
      const newApiMethods = {};
      const provider = getProviderById(providerType);

      if (provider && provider.module && configured) {
        REQUIRED_API_METHODS.forEach((methodName) => {
          const methodImpl = provider.module[methodName];
          if (typeof methodImpl === "function") {
            const providerSpecificSettingsForMethod =
              currentApiSettings?.[providerType] || {};
            newApiMethods[methodName] = (...args) =>
              methodImpl(providerSpecificSettingsForMethod, ...args);
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
  useEffect(() => {
    bindApiMethods(apiProviderType, apiSettings, isConfigured);
  }, [apiProviderType, apiSettings, isConfigured, bindApiMethods]);

  // --- Context Value ---
  const value = {
    apiProviderType: apiProviderType,
    apiSettings: apiSettings,
    isConfigured: isConfigured,
    ...apiMethods,
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
