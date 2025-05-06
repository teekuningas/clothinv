import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext";
// getLocaleCodes might not be needed if we trust the imported settings structure
// or if locale validation happens within SettingsContext or TranslationContext upon update.
// For now, let's assume the imported locale will be validated by TranslationContext.

// The updateNestedObject helper function can be removed from this file if not used elsewhere.

const ConfigureFromUrl = () => {
  const [searchParams] = useSearchParams();
  const intl = useIntl();
  const { updateSettings } = useSettings(); // Use the generic updateSettings
  const [statusMessage, setStatusMessage] = useState(
    intl.formatMessage({
      id: "configure.status.processing",
      defaultMessage: "Processing configuration...",
    }),
  );
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Use the new parameter name from ExportConfigurationLink
    const encodedSettingsPayload = searchParams.get("settingsPayload");

    if (!encodedSettingsPayload) {
      // Fallback to old 'values' param for a brief period of backward compatibility if desired,
      // or remove this fallback if starting fresh. For this refactor, let's assume new param.
      // const oldEncodedValues = searchParams.get("values");
      // if (!oldEncodedValues) { ... }
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
      // 1. Decode the base64 string
      const decodedJsonString = atob(encodedSettingsPayload);
      console.log("ConfigureFromUrl: Decoded JSON string:", decodedJsonString);

      // 2. Parse the JSON string into an object
      const importedSettings = JSON.parse(decodedJsonString);
      console.log(
        "ConfigureFromUrl: Imported settings object:",
        importedSettings,
      );

      if (
        !importedSettings ||
        typeof importedSettings !== "object" ||
        Object.keys(importedSettings).length === 0
      ) {
        throw new Error("Parsed settings object is empty or invalid.");
      }

      // 3. Update settings using the entire imported object.
      // The deepMerge in SettingsContext will handle combining it with existing settings.
      updateSettings(importedSettings);

      setStatusMessage(
        intl.formatMessage({
          id: "configure.status.success",
          defaultMessage: "Configuration applied. Redirecting...",
        }),
      );
      // Use replace: true so the /configure URL isn't in the browser history
      setTimeout(() => {
        window.location.replace("/items"); // Or settings page, or home
      }, 50);
    } catch (error) {
      console.error("Error processing configuration from URL:", error);
      let errorMessageId = "configure.error.generic";
      let defaultMessage = "Error processing configuration: {error}";

      if (
        error.message.includes("atob") ||
        error.message.toLowerCase().includes("base64")
      ) {
        errorMessageId = "configure.error.invalidBase64";
        defaultMessage =
          "Error: Could not decode configuration data (Invalid Base64).";
      } else if (
        error instanceof SyntaxError ||
        error.message.toLowerCase().includes("json")
      ) {
        errorMessageId = "configure.error.invalidJson"; // New ID
        defaultMessage =
          "Error: Could not parse configuration data (Invalid JSON format).";
      } else if (
        error.message.includes("Parsed settings object is empty or invalid.")
      ) {
        errorMessageId = "configure.error.emptyOrInvalidSettings"; // New ID
        defaultMessage =
          "Error: Imported configuration data is empty or invalid.";
      }

      setStatusMessage(
        intl.formatMessage(
          { id: errorMessageId, defaultMessage: defaultMessage },
          { error: error.message },
        ),
      );
      setIsError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
