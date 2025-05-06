import React, {
  createContext,
  useContext,
  useState,
  // useEffect, // No longer strictly needed for settings persistence alone
  useCallback,
} from "react";
import { defaultLocale } from "../translations/i18n";

// Define the localStorage key for general app settings
export const LS_APP_SETTINGS_KEY = "appSettings";

// Define default settings
const defaultSettings = {
  locale: defaultLocale,
  apiProviderType: "indexedDB", // Default provider
  apiSettings: {}, // Will be populated per provider, e.g., { datasette: {...}, postgrest: {...} }
  imageCompressionEnabled: true,
  // theme: 'light', // Example of another potential setting
};

// Helper function to determine if a value is an object (and not an array or null)
const isObject = (item) => {
  return item && typeof item === "object" && !Array.isArray(item);
};

/**
 * Performs a deep merge of source object into target object.
 * Modifies and returns the target object.
 * For simplicity, this version prioritizes source values for non-object properties
 * and recursively merges object properties. Arrays from source will replace arrays in target.
 */
const deepMerge = (target, source) => {
  const output = { ...target }; // Create a new object to avoid mutating the original target directly in some cases

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        // If the key exists in target and is also an object, recurse
        if (key in target && isObject(target[key])) {
          output[key] = deepMerge(target[key], source[key]);
        } else {
          // Otherwise, assign the source object (or a deep copy of it if preferred)
          // For this context, a direct assignment of the source's nested object is fine
          // as we are building up a new settings state.
          output[key] = deepMerge({}, source[key]); // Ensure nested objects are also new
        }
      } else {
        // For non-object properties (or arrays), source overwrites target
        output[key] = source[key];
      }
    });
  } else if (isObject(source)) {
    // If target is not an object but source is, return a deep copy of source
    return deepMerge({}, source);
  }
  // if source is not an object, the initial spread of target or target itself is returned
  // or if target is not an object, source value (if not object) would have been assigned or ignored.
  return output;
};

const SettingsContext = createContext(null);

// Custom hook to use the context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

// Create the provider component
export const SettingsProvider = ({ children }) => {
  // Initialize state from localStorage or defaults
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(LS_APP_SETTINGS_KEY);
    let initialSettings = { ...defaultSettings }; // Start with a copy of defaults

    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        // Deep merge saved settings into defaults to ensure all keys from defaultSettings
        // are present and to properly merge nested structures like apiSettings.
        initialSettings = deepMerge(defaultSettings, parsedSettings);
      } catch (e) {
        console.error("Failed to parse saved app settings, using defaults.", e);
        // initialSettings remains a copy of defaultSettings
      }
    }
    return initialSettings;
  });

  const updateSettings = useCallback((newSettingsPartial) => {
    setSettings((prevSettings) => {
      // Perform a deep merge of the new partial settings into the previous settings
      const updatedSettings = deepMerge(prevSettings, newSettingsPartial);

      try {
        localStorage.setItem(
          LS_APP_SETTINGS_KEY,
          JSON.stringify(updatedSettings),
        );
        console.log(
          "SettingsContext: Settings updated and saved:",
          updatedSettings,
        );
      } catch (error) {
        console.error("Failed to save app settings to localStorage:", error);
      }
      return updatedSettings;
    });
  }, []);

  // The context value includes the current settings and the update function
  const value = {
    settings,
    updateSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
