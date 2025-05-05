import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom"; // Removed useNavigate
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext"; // Import useSettings
import { getLocaleCodes } from "../translations/i18n"; // Keep for locale validation

// Removed LS key imports

// Helper function to update nested properties in an object based on a path string
// Example: updateNestedObject(obj, 'settings.datasetteBaseUrl', 'http://new.url')
const updateNestedObject = (obj, path, value) => {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // Create nested object if it doesn't exist or isn't an object
    if (
      current[key] === undefined ||
      typeof current[key] !== "object" ||
      current[key] === null
    ) {
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
  const intl = useIntl();
  const { updateSettings } = useSettings(); // Get update function from context
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
      const validLocales = getLocaleCodes();

      let changesApplied = 0;
      const settingsToUpdate = {}; // Object to collect all settings changes

      for (const [key, value] of configParams.entries()) {
        console.log(`Processing param: ${key} = ${value}`);
        if (key === "locale") {
          if (validLocales.includes(value)) {
            settingsToUpdate.locale = value;
            changesApplied++;
            console.log(`Applying setting: locale = ${value}`);
          } else {
            console.warn(`Ignoring invalid locale value: ${value}`);
          }
        } else if (key === "apiProviderType") {
          // Basic validation could be added here if needed (e.g., check against getProviderIds)
          settingsToUpdate.apiProviderType = value;
          changesApplied++;
          console.log(`Applying setting: apiProviderType = ${value}`);
        } else if (key === "imageCompressionEnabled") {
          // Convert string "true"/"false" to boolean
          settingsToUpdate.imageCompressionEnabled = value === "true";
          changesApplied++;
          console.log(
            `Applying setting: imageCompressionEnabled = ${settingsToUpdate.imageCompressionEnabled}`,
          );
        } else if (key.startsWith("apiSettings.")) {
          const settingKey = key.substring("apiSettings.".length);
          if (settingKey) {
            // Initialize apiSettings if it doesn't exist yet
            if (!settingsToUpdate.apiSettings) {
              settingsToUpdate.apiSettings = {};
            }
            settingsToUpdate.apiSettings[settingKey] = value;
            changesApplied++;
            console.log(
              `Applying setting: apiSettings.${settingKey} = ${value}`,
            );
          } else {
            console.warn(`Ignoring invalid apiSettings key: ${key}`);
          }
        }
      }

      // --- Process Deprecated Locale Parameter (for backward compatibility) ---
      const deprecatedLocaleValue = configParams.get("userLocale");
      if (deprecatedLocaleValue) {
        console.warn(
          "Ignoring deprecated URL parameter 'userLocale'. Use 'locale' instead.",
        );
        // If 'locale' wasn't already set by the new key, apply the old one
        if (
          !settingsToUpdate.locale &&
          validLocales.includes(deprecatedLocaleValue)
        ) {
          settingsToUpdate.locale = deprecatedLocaleValue;
          changesApplied++;
          console.log(
            `Applying deprecated setting: locale = ${deprecatedLocaleValue}`,
          );
        }
      }

      // --- Final Status and Redirect ---
      if (changesApplied > 0) {
        updateSettings(settingsToUpdate); // Apply all collected settings at once
        setStatusMessage(
          intl.formatMessage({
            id: "configure.status.success",
            defaultMessage: "Configuration applied. Redirecting...",
          }),
        );
        // Use replace: true so the /configure URL isn't in the browser history
        // Redirect slightly delayed to allow state update and potential message visibility
        setTimeout(() => {
          // Use window.location.replace for a full page reload without adding to history
          window.location.replace("/items");
        }, 50); // Keep a small delay for message visibility
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
      if (error instanceof SyntaxError) {
        // This might now indicate invalid query string format if JSON parsing is removed elsewhere
        errorMessageId = "configure.error.invalidDataFormat";
        defaultMessage =
          "Error: Could not parse configuration data (Invalid format).";
      } else if (error.message.includes("atob")) {
        errorMessageId = "configure.error.invalidBase64";
        defaultMessage =
          "Error: Could not decode configuration data (Invalid Base64).";
      }
      setStatusMessage(
        intl.formatMessage(
          { id: errorMessageId, defaultMessage: defaultMessage },
          { error: error.message },
        ),
      );
      setIsError(true);
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, intl, updateSettings]); // Add updateSettings to dependencies
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
