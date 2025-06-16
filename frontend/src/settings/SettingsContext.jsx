import React, { createContext, useContext, useState, useCallback } from "react";
import { defaultLocale } from "../translations/i18n";

export const LS_APP_SETTINGS_KEY = "clothinvAppSettings";

const defaultSettings = {
  locale: defaultLocale,
  apiProviderType: "indexedDB",
  apiSettings: {}, // Will be populated per provider, e.g., { datasette: {...}, postgrest: {...} }
  imageCompressionEnabled: true,
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
        if (key in target && isObject(target[key])) {
          output[key] = deepMerge(target[key], source[key]);
        } else {
          output[key] = deepMerge({}, source[key]); // Ensure nested objects are also new
        }
      } else {
        output[key] = source[key];
      }
    });
  } else if (isObject(source)) {
    return deepMerge({}, source);
  }
  return output;
};

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(LS_APP_SETTINGS_KEY);
    let initialSettings = { ...defaultSettings };

    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        initialSettings = deepMerge(defaultSettings, parsedSettings);
      } catch (e) {
        console.error("Failed to parse saved app settings, using defaults.", e);
      }
    }
    return initialSettings;
  });

  const updateSettings = useCallback((newSettingsPartial) => {
    setSettings((prevSettings) => {
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
