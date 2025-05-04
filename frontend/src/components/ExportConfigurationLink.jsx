import React, { useState, useEffect } from "react";
// Removed useSearchParams import
import { useIntl } from "react-intl";
// Import localStorage keys
import { LS_API_PROVIDER_CONFIG_KEY } from "../api/ApiContext";
import { LS_LOCALE_KEY } from "../translations/i18n";

const ExportConfigurationLink = () => {
  // Removed useSearchParams hook
  const intl = useIntl();
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const configParams = new URLSearchParams();
    let foundConfig = false;

    // 1. Get Locale from localStorage
    try {
      const localeValue = localStorage.getItem(LS_LOCALE_KEY);
      if (localeValue) {
        configParams.set("userLocale", localeValue);
        foundConfig = true;
        console.log(
          "ExportConfig: Added userLocale from localStorage:",
          localeValue,
        );
      }
    } catch (e) {
      console.error("ExportConfig: Error reading locale from localStorage:", e);
      // Optionally set a non-critical error/warning here if needed
    }

    // 2. Get API Config from localStorage
    try {
      const savedApiConfig = localStorage.getItem(LS_API_PROVIDER_CONFIG_KEY);
      if (savedApiConfig) {
        const apiConfig = JSON.parse(savedApiConfig); // Parse the JSON string

        // Add providerType
        if (apiConfig.providerType) {
          configParams.set(
            "apiProviderConfig.providerType",
            apiConfig.providerType,
          );
          foundConfig = true;
          console.log(
            "ExportConfig: Added apiProviderConfig.providerType from localStorage:",
            apiConfig.providerType,
          );
        }

        // Add settings if they exist and are an object
        if (apiConfig.settings && typeof apiConfig.settings === "object") {
          for (const [key, value] of Object.entries(apiConfig.settings)) {
            // Ensure value is not null/undefined before setting
            if (value !== null && value !== undefined) {
              configParams.set(
                `apiProviderConfig.settings.${key}`,
                String(value),
              ); // Convert value to string
              foundConfig = true;
              console.log(
                `ExportConfig: Added apiProviderConfig.settings.${key} from localStorage:`,
                String(value),
              );
            }
          }
        }
      }
    } catch (e) {
      console.error(
        "ExportConfig: Error reading or parsing API config from localStorage:",
        e,
      );
      setError(
        intl.formatMessage({
          id: "exportConfig.error.localStorageReadFailed", // New ID
          defaultMessage:
            "Error: Failed to read or parse configuration from local storage.",
        }),
      );
      setGeneratedUrl("");
      return; // Stop processing if API config fails critically
    }

    // 3. Check if any config was found
    if (!foundConfig) {
      setError(
        intl.formatMessage({
          id: "exportConfig.error.noConfigInLocalStorage", // New ID
          defaultMessage:
            "Error: No configuration found in local storage to export.",
        }),
      );
      setGeneratedUrl("");
      return;
    }

    // 4. Generate the URL
    try {
      const queryString = configParams.toString();
      console.log("ExportConfig: Generated query string:", queryString);
      const base64String = btoa(queryString);
      const configureUrl = `${window.location.origin}/configure?values=${base64String}`;

      setGeneratedUrl(configureUrl);
      setError(""); // Clear previous errors
      console.log("ExportConfig: Generated URL:", configureUrl);
    } catch (e) {
      console.error("ExportConfig: Error encoding query string:", e);
      setError(
        intl.formatMessage({
          id: "exportConfig.error.encodingFailed", // Keep existing ID
          defaultMessage: "Error: Failed to generate configuration link.",
        }),
      );
      setGeneratedUrl("");
    }

    // End of useEffect body
  }, [intl]); // Dependency array changed to [intl]

  const handleCopyUrl = () => {
    if (!generatedUrl) return; // Don't copy if URL generation failed
    navigator.clipboard
      .writeText(generatedUrl)
      .then(() =>
        alert(
          intl.formatMessage({
            id: "exportConfig.alert.urlCopied",
            defaultMessage: "Configuration URL copied to clipboard!",
          }),
        ),
      )
      .catch((err) =>
        alert(
          intl.formatMessage(
            {
              id: "exportConfig.alert.copyFailed",
              defaultMessage: "Failed to copy URL: {error}",
            },
            { error: err },
          ),
        ),
      );
  };

  // Removed handleCopyEncoded function

  return (
    // Use settings-view class for consistent padding/styling
    <div className="settings-view">
      <h2>
        {intl.formatMessage({
          id: "exportConfig.title",
          defaultMessage: "Export Configuration Link",
        })}
      </h2>

      {/* Use status-error class */}
      {/* Use status-error class */}
      {error && <p className="status-error">{error}</p>}

      {!error && generatedUrl && (
        <div className="settings-fieldset">
          {" "}
          {/* Wrap content in fieldset for styling */}
          <h3>
            {intl.formatMessage({
              id: "exportConfig.section.generatedUrl",
              defaultMessage: "Generated Configuration URL:",
            })}
          </h3>
          {/* Use subtle background for code blocks */}
          <p
            style={{
              wordBreak: "break-all",
              backgroundColor: "var(--color-bg-subtle)",
              padding: "10px",
              borderRadius: "4px",
            }}
          >
            <code>{generatedUrl}</code>
          </p>
          {/* Use button classes */}
          <button onClick={handleCopyUrl} className="button-primary">
            {intl.formatMessage({
              id: "exportConfig.button.copyUrl",
              defaultMessage: "Copy URL",
            })}
          </button>
          <p style={{ marginTop: "20px", fontStyle: "italic" }}>
            {intl.formatMessage({
              id: "exportConfig.instructions",
              defaultMessage:
                "Share the generated URL with someone. When they open it, the specified configuration will be automatically applied to their browser.",
            })}
          </p>
          {/* Use status-warning class */}
          <p className="status-warning" style={{ marginTop: "10px" }}>
            {intl.formatMessage({
              id: "exportConfig.warning.secret",
              defaultMessage:
                "Warning: This URL contains configuration details, potentially including API tokens or other settings. Share it only with trusted individuals.",
            })}
          </p>
        </div>
      )}

      {/* Show loading only if no error and no URL yet */}
      {!error && !generatedUrl && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "exportConfig.status.generating",
            defaultMessage: "Generating link...",
          })}
        </p>
      )}

      {/* Removed the usage section */}
    </div>
  );
};

export default ExportConfigurationLink;
