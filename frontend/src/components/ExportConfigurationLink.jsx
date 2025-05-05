import React, { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext"; // Import useSettings

// Removed LS key imports

const ExportConfigurationLink = () => {
  // Removed useSearchParams hook
  const intl = useIntl();
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [error, setError] = useState("");
  const { settings } = useSettings(); // Get settings from context

  useEffect(() => {
    // Get settings directly from context instead of localStorage
    const configParams = new URLSearchParams();
    let foundConfig = false;

    // 1. Add Locale from settings context
    try {
      if (settings.locale) {
        configParams.set("locale", settings.locale); // Use 'locale' key
        foundConfig = true;
        console.log("ExportConfig: Added locale from settings:", settings.locale);
      }
    } catch (e) {
      console.error("ExportConfig: Error processing locale from settings:", e);
    }

    // 2. Add API Config from settings context
    try {
      // Add providerType
      if (settings.apiProviderType) {
        configParams.set("apiProviderType", settings.apiProviderType);
        foundConfig = true;
        console.log("ExportConfig: Added apiProviderType from settings:", settings.apiProviderType);
      }
      // Add apiSettings
      if (settings.apiSettings && typeof settings.apiSettings === "object") {
        for (const [key, value] of Object.entries(settings.apiSettings)) {
          if (value !== null && value !== undefined) {
            configParams.set(`apiSettings.${key}`, String(value)); // Prefix with apiSettings.
            foundConfig = true;
            console.log(`ExportConfig: Added apiSettings.${key} from settings:`, String(value));
          }
        }
      }
    } catch (e) {
      console.error(
        "ExportConfig: Error processing API config from settings:",
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

    // 3. Add Image Compression setting
    try {
      // Add imageCompressionEnabled (convert boolean to string)
      if (settings.imageCompressionEnabled !== undefined) {
        configParams.set("imageCompressionEnabled", String(settings.imageCompressionEnabled));
        foundConfig = true;
        console.log("ExportConfig: Added imageCompressionEnabled from settings:", settings.imageCompressionEnabled);
      }
    } catch (e) {
      console.error("ExportConfig: Error processing imageCompressionEnabled from settings:", e);
    }
    // 4. Check if any config was found
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
  }, [intl, settings]); // Add settings to dependencies

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
