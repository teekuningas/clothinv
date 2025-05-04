import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define the localStorage key for general app settings
export const LS_APP_SETTINGS_KEY = 'appSettings';

// Define default settings
const defaultSettings = {
  imageCompressionEnabled: true, // Default to enabled
  // theme: 'light',
};

// Create the context
const SettingsContext = createContext(null);

// Custom hook to use the context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Create the provider component
export const SettingsProvider = ({ children }) => {
  // Initialize state from localStorage or defaults
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(LS_APP_SETTINGS_KEY);
    let initialSettings = { ...defaultSettings }; // Start with defaults

    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge saved settings with defaults, ensuring defaults are present if missing in saved data
        initialSettings = { ...initialSettings, ...parsedSettings };
      } catch (e) {
        console.error('Failed to parse saved app settings, using defaults.', e);
        // Keep default settings if parsing fails
      }
    }
    return initialSettings;
  });

  // Function to update one or more settings
  const updateSettings = useCallback((newSettings) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      // Persist updated settings to localStorage
      try {
        localStorage.setItem(LS_APP_SETTINGS_KEY, JSON.stringify(updatedSettings));
      } catch (error) {
        console.error('Failed to save app settings to localStorage:', error);
        // Optionally notify the user
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
