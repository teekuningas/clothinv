import React, { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext";

const ExportConfigurationLink = () => {
  const intl = useIntl();
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [error, setError] = useState("");
  const { settings } = useSettings(); // Get the whole settings object

  useEffect(() => {
    setError(""); // Clear previous errors
    setGeneratedUrl(""); // Clear previous URL

    if (!settings || Object.keys(settings).length === 0) {
      setError(
        intl.formatMessage({
          id: "exportConfig.error.noConfigToExport", // New ID
          defaultMessage: "Error: No configuration available to export.",
        }),
      );
      return;
    }

    try {
      // 1. JSON.stringify the entire settings object
      const settingsJson = JSON.stringify(settings);
      console.log("ExportConfig: Settings JSON:", settingsJson);

      // 2. Base64 encode the JSON string
      const base64String = btoa(settingsJson);

      // 3. Construct the URL
      // Use a more generic parameter name like 'config' or 'appSettingsPayload'
      const configureUrl = `${window.location.origin}/configure?settingsPayload=${base64String}`;

      setGeneratedUrl(configureUrl);
      console.log("ExportConfig: Generated URL:", configureUrl);
    } catch (e) {
      console.error("ExportConfig: Error generating configuration link:", e);
      setError(
        intl.formatMessage({
          id: "exportConfig.error.encodingFailed", // Keep existing ID
          defaultMessage: "Error: Failed to generate configuration link.",
        }),
      );
      setGeneratedUrl("");
    }
  }, [intl, settings]);

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
    </div>
  );
};

export default ExportConfigurationLink;
