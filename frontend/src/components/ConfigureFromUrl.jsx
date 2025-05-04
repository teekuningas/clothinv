import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useIntl } from "react-intl";
// Import keys from their source files
import { LS_API_PROVIDER_CONFIG_KEY } from "../api/ApiContext";
import { LS_LOCALE_KEY, getLocaleCodes } from "../translations/i18n";
// Removed getProviderById import

// Define keys directly if not exported from context/i18n
// const LS_API_PROVIDER_CONFIG_KEY = 'apiProviderConfig';
// const LS_LOCALE_KEY = 'userLocale';

// Helper function to update nested properties in an object based on a path string
// Example: updateNestedObject(obj, 'settings.datasetteBaseUrl', 'http://new.url')
const updateNestedObject = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // Create nested object if it doesn't exist or isn't an object
    if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }

  // Set the value at the final key
  current[keys[keys.length - 1]] = value;
  // No need to return obj, modification happens in place.
};


const ConfigureFromUrl = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const [statusMessage, setStatusMessage] = useState(
    intl.formatMessage({
      id: "configure.status.processing",
      defaultMessage: "Processing configuration...",
    }),
  );
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const encodedValues = searchParams.get("values");

    if (!encodedValues) {
      setStatusMessage(
        intl.formatMessage({
          id: "configure.error.missingParam",
          defaultMessage: "Error: Configuration data missing in URL.",
        }),
      );
      setIsError(true);
      return;
    }

    try {
      // Decode the base64 string to get the original query string
      const decodedQueryString = atob(encodedValues);
      // Parse the query string into parameters
      const configParams = new URLSearchParams(decodedQueryString);

      let changesApplied = 0;
      let apiConfigModified = false;
      let currentApiConfig = null;

      // --- Process API Provider Config Parameters ---
      try {
        const savedApiConfig = localStorage.getItem(LS_API_PROVIDER_CONFIG_KEY);
        currentApiConfig = savedApiConfig ? JSON.parse(savedApiConfig) : { providerType: 'none', settings: {} };
        // Ensure settings is an object if it's missing or null
        if (!currentApiConfig.settings) {
            currentApiConfig.settings = {};
        }
      } catch (e) {
        console.error("Failed to parse existing API config from localStorage:", e);
        // Start with a default structure if parsing fails
        currentApiConfig = { providerType: 'none', settings: {} };
        // Optionally set an error state or message here
      }

      for (const [key, value] of configParams.entries()) {
        if (key.startsWith("apiProviderConfig.")) {
          const path = key.substring("apiProviderConfig.".length); // e.g., "providerType" or "settings.datasetteBaseUrl"
          if (path) { // Ensure path is not empty
            updateNestedObject(currentApiConfig, path, value);
            apiConfigModified = true;
            changesApplied++;
            console.log(`Applied API config change: ${path} = ${value}`);
          } else {
             console.warn(`Ignoring invalid API config key: ${key}`);
          }
        }
      }

      // Save the modified API config back to localStorage if changes were made
      if (apiConfigModified) {
        try {
          localStorage.setItem(LS_API_PROVIDER_CONFIG_KEY, JSON.stringify(currentApiConfig));
          console.log("Saved updated API configuration to localStorage:", currentApiConfig);
        } catch (e) {
          console.error("Failed to save updated API config to localStorage:", e);
          // Handle this error - maybe set isError state?
          setStatusMessage(intl.formatMessage({ id: "configure.error.saveApiFailed", defaultMessage: "Error saving API configuration." }));
          setIsError(true);
          return; // Stop processing if saving failed
        }
      }

      // --- Process Locale Parameter ---
      const localeValue = configParams.get("userLocale");
      if (localeValue) {
        const validLocales = getLocaleCodes();
        if (validLocales.includes(localeValue)) {
          localStorage.setItem(LS_LOCALE_KEY, localeValue);
          console.log("Applied Locale configuration from URL:", localeValue);
          changesApplied++;
        } else {
          console.warn("Invalid Locale configuration in URL data:", localeValue);
          // Optionally set a non-blocking warning message part here
        }
      }

      // --- Final Status and Redirect ---
      if (changesApplied > 0) {
        setStatusMessage(
          intl.formatMessage({
            id: "configure.status.success",
            defaultMessage: "Configuration applied. Redirecting...",
          }),
        );
        // Use replace: true so the /configure URL isn't in the browser history
        // Redirect slightly delayed to allow state update and potential message visibility
        setTimeout(() => navigate("/items", { replace: true }), 50);
      } else {
        setStatusMessage(
          intl.formatMessage({
            id: "configure.error.noValidParams", // Changed ID
            defaultMessage:
              "Error: No valid configuration parameters found in the provided data.",
          }),
        );
        setIsError(true);
      }
    } catch (error) {
      console.error("Error processing configuration from URL:", error);
      let errorMessageId = "configure.error.generic";
      let defaultMessage = "Error processing configuration: {error}";
      // Keep specific error checks
      if (error instanceof SyntaxError) { // This might now indicate invalid query string format if JSON parsing is removed elsewhere
        errorMessageId = "configure.error.invalidDataFormat";
        defaultMessage = "Error: Could not parse configuration data (Invalid format).";
      } else if (error.message.includes("atob")) {
        errorMessageId = "configure.error.invalidBase64";
        defaultMessage = "Error: Could not decode configuration data (Invalid Base64).";
      }
      setStatusMessage(
        intl.formatMessage(
          { id: errorMessageId, defaultMessage: defaultMessage },
          { error: error.message },
        ),
      );
      setIsError(true);
    }
  }, [searchParams, navigate, intl]); // Dependencies
  return (
    // Use settings-view class for consistent padding/styling
    <div className="settings-view" style={{ textAlign: "center" }}>
      <h2>
        {intl.formatMessage({
          id: "configure.title",
          defaultMessage: "Applying Configuration",
        })}
      </h2>
      {/* Use status classes */}
      <p className={isError ? "status-error" : "status-loading"}>
        {statusMessage}
      </p>
      {!isError && (
        <p>
          {intl.formatMessage({
            id: "configure.status.wait",
            defaultMessage: "Please wait...",
          })}
        </p>
      )}
      {/* Use text-link color (implicitly via 'a' tag) */}
      {isError && (
        <p>
          <a href="/">
            {intl.formatMessage({
              id: "configure.link.home",
              defaultMessage: "Go to Home Page",
            })}
          </a>
        </p>
      )}
    </div>
  );
};

export default ConfigureFromUrl;
