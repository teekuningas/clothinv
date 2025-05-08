import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useIntl } from "react-intl";
import { useSettings } from "../settings/SettingsContext";

const ConfigureFromUrlView = () => {
  const [searchParams] = useSearchParams();
  const intl = useIntl();
  const { updateSettings } = useSettings(); // Use the generic updateSettings
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState(
    intl.formatMessage({
      id: "configure.status.processing",
      defaultMessage: "Processing configuration...",
    }),
  );
  const [isError, setIsError] = useState(false);

  // Extract the specific search parameter value. This string will be stable if the URL param doesn't change.
  const encodedSettingsPayload = searchParams.get("settingsPayload");

  useEffect(() => {
    if (!encodedSettingsPayload) {
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
      const decodedJsonString = atob(encodedSettingsPayload);
      console.log("ConfigureFromUrl: Decoded JSON string:", decodedJsonString);

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

      updateSettings(importedSettings);

      setStatusMessage(
        intl.formatMessage({
          id: "configure.status.success",
          defaultMessage: "Configuration applied. Redirecting...",
        }),
      );

      // Navigate after settings are updated and status message is set.
      navigate("/items", { replace: true });
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
        errorMessageId = "configure.error.invalidJson";
        defaultMessage =
          "Error: Could not parse configuration data (Invalid JSON format).";
      } else if (
        error.message.includes("Parsed settings object is empty or invalid.")
      ) {
        errorMessageId = "configure.error.emptyOrInvalidSettings";
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

    // No cleanup needed for timers anymore
  }, [encodedSettingsPayload, intl, updateSettings, navigate]); // Use encodedSettingsPayload in dependencies
  return (
    <div className="settings-view" style={{ textAlign: "center" }}>
      <h2>
        {intl.formatMessage({
          id: "configure.title",
          defaultMessage: "Applying Configuration",
        })}
      </h2>
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

export default ConfigureFromUrlView;
