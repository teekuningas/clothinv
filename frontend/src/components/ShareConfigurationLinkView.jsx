import React, { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext";

const ShareConfigurationLinkView = () => {
  const intl = useIntl();
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState(""); // "success" or "error"
  const [copyMessage, setCopyMessage] = useState("");
  const { settings } = useSettings(); // Get the whole settings object

  useEffect(() => {
    setError("");
    setGeneratedUrl("");
    setCopyStatus(""); // Reset copy status
    setCopyMessage(""); // Reset copy message

    if (!settings || Object.keys(settings).length === 0) {
      setError(
        intl.formatMessage({
          id: "shareConfig.error.noConfigToExport",
          defaultMessage: "Error: No configuration available to share.",
        }),
      );
      return;
    }

    try {
      const settingsJson = JSON.stringify(settings);
      console.log("ShareConfig: Settings JSON:", settingsJson);

      const base64String = btoa(settingsJson);

      // import.meta.env.BASE_URL is provided by Vite.
      // It correctly ends with a '/' if it's a subpath, or is just '/' for the root.
      // Construct the full base URL for the 'configure' path.
      // If BASE_URL is '/', new URL('configure', 'http://host/').href is 'http://host/configure'
      // If BASE_URL is '/app/', new URL('configure', 'http://host/app/').href is 'http://host/app/configure'
      const baseAppUrl = new URL(
        import.meta.env.BASE_URL,
        window.location.origin,
      ).href;
      const configureUrl = new URL(
        `configure?settingsPayload=${base64String}`,
        baseAppUrl,
      ).href;

      setGeneratedUrl(configureUrl);
      console.log("ShareConfig: Generated URL:", configureUrl);
    } catch (e) {
      console.error("ShareConfig: Error generating configuration link:", e);
      setError(
        intl.formatMessage({
          id: "shareConfig.error.encodingFailed",
          defaultMessage: "Error: Failed to generate configuration link.",
        }),
      );
      setGeneratedUrl("");
    }
  }, [intl, settings]);

  const handleCopyUrl = () => {
    if (!generatedUrl) return;
    setCopyStatus(""); // Clear previous message
    setCopyMessage("");

    navigator.clipboard
      .writeText(generatedUrl)
      .then(() => {
        setCopyStatus("success");
        setCopyMessage(
          intl.formatMessage({
            id: "shareConfig.alert.urlCopied",
            defaultMessage: "Configuration URL copied to clipboard!",
          }),
        );
        // Optionally clear after a few seconds
        setTimeout(() => {
          setCopyStatus("");
          setCopyMessage("");
        }, 3000);
      })
      .catch((err) => {
        setCopyStatus("error");
        setCopyMessage(
          intl.formatMessage(
            {
              id: "shareConfig.alert.copyFailed",
              defaultMessage: "Failed to copy URL: {error}",
            },
            { error: err.message }, // Use err.message for better error display
          ),
        );
      });
  };

  return (
    <div className="settings-view">
      <h2>
        {intl.formatMessage({
          id: "shareConfig.title",
          defaultMessage: "Share Configuration Link",
        })}
      </h2>

      {error && <p className="status-error">{error}</p>}

      {!error && generatedUrl && (
        <div className="settings-fieldset">
          {" "}
          <h3>
            {intl.formatMessage({
              id: "shareConfig.section.generatedUrl",
              defaultMessage: "Generated Configuration URL:",
            })}
          </h3>
          <p
            style={{
              wordBreak: "break-all",
              backgroundColor: "var(--color-bg-subtle)",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "4px",
            }}
          >
            <code>{generatedUrl}</code>
          </p>
          <button onClick={handleCopyUrl} className="button-primary">
            {intl.formatMessage({
              id: "shareConfig.button.copyUrl",
              defaultMessage: "Copy URL",
            })}
          </button>
          {/* Display copy status message */}
          {copyMessage && (
            <p
              className={
                copyStatus === "success" ? "status-success" : "status-error"
              }
              style={{ marginTop: "10px" }}
            >
              {copyMessage}
            </p>
          )}
          <p style={{ marginTop: "20px", fontStyle: "italic" }}>
            {intl.formatMessage({
              id: "shareConfig.instructions",
              defaultMessage:
                "Share the generated URL with someone. When they open it, the specified configuration will be automatically applied to their browser.",
            })}
          </p>
          {/* Use status-warning class */}
          <p className="status-warning" style={{ marginTop: "10px" }}>
            {intl.formatMessage({
              id: "shareConfig.warning.secret",
              defaultMessage:
                "Warning: This URL contains configuration details, potentially including API tokens or other settings. Share it only with trusted individuals.",
            })}
          </p>
        </div>
      )}

      {!error && !generatedUrl && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "shareConfig.status.generating",
            defaultMessage: "Generating link...",
          })}
        </p>
      )}
    </div>
  );
};

export default ShareConfigurationLinkView;
