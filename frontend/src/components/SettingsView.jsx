import React, { useState, useEffect, useCallback } from "react";
import { useIntl } from "react-intl"; // Import useIntl
import {
  getProviderIds,
  getProviderById,
  getProviderDisplayNames,
} from "../api/providerRegistry";
import { useApi } from "../api/ApiContext"; // Import useApi hook
import { useTranslationContext } from "../translations/TranslationContext"; // Import translation hook
import { useSettings } from "../settings/SettingsContext"; // Import useSettings hook
import "./SettingsView.css";
const SettingsView = () => {
  const { config: apiConfig, updateConfiguration: saveApiConfig } = useApi(); // Get API context
  const {
    locale: currentLocale,
    changeLocale,
    availableLocales,
    loadingMessages: languageLoading, // Get loading state for language
    loadError: languageLoadError,     // Get load error for language
  } = useTranslationContext(); // Get Translation context
  const { settings: appSettings, updateSettings: updateAppSettings } = useSettings(); // Get general app settings
  const api = useApi(); // Get full API context to access export/import methods

  // Local state for Language setting being edited
  const [localLocale, setLocalLocale] = useState(currentLocale);
  // State for Language config saving
  const [languageSaveStatus, setLanguageSaveStatus] = useState("idle"); // 'idle', 'saving', 'success', 'error'
  const [languageSaveError, setLanguageSaveError] = useState(null);

  // Local state ONLY holds the API configuration being edited
  const [localApiSettings, setLocalApiSettings] = useState({
    providerType: "none",
    settings: {},
  });
  // State for API config saving
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle', 'saving', 'success', 'error'
  const [saveError, setSaveError] = useState(null);
  const [providerDisplayNames, setProviderDisplayNames] = useState({});
  const intl = useIntl(); // Get intl object
  // Removed duplicate state declarations for saveStatus and saveError

  // Local state for Image settings being edited
  const [localImageCompressionEnabled, setLocalImageCompressionEnabled] = useState(appSettings.imageCompressionEnabled);
  // State for Image config saving
  const [imageSaveStatus, setImageSaveStatus] = useState("idle"); // 'idle', 'saving', 'success', 'error'
  const [imageSaveError, setImageSaveError] = useState(null);

  // State for Export
  const [exportStatus, setExportStatus] = useState("idle"); // 'idle', 'exporting', 'success', 'error'
  const [exportError, setExportError] = useState(null);

  // State for Import
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState("idle"); // 'idle', 'importing', 'success', 'error'
  const [importError, setImportError] = useState(null);
  const [importSummary, setImportSummary] = useState(""); // To show messages like "Import successful"

  // State for Destroy
  const [destroyStatus, setDestroyStatus] = useState("idle"); // 'idle', 'destroying', 'success', 'error'
  const [destroyError, setDestroyError] = useState(null);
  const [destroySummary, setDestroySummary] = useState("");

  useEffect(() => {
    setProviderDisplayNames(getProviderDisplayNames());
  }, []);

  // Initialize local state for API settings when apiConfig changes
  useEffect(() => {
    // Use a deep copy method (structuredClone preferred)
    const initialLocalState = {
      providerType: apiConfig.providerType || "none",
      settings: apiConfig.settings
        ? typeof structuredClone === "function"
          ? structuredClone(apiConfig.settings)
          : JSON.parse(JSON.stringify(apiConfig.settings))
        : {},
    };
    // Ensure all fields defined in the registry for the current provider exist in local state
    const provider = getProviderById(initialLocalState.providerType);
    if (provider && provider.configFields) {
      provider.configFields.forEach((field) => {
        if (!(field.key in initialLocalState.settings)) {
          initialLocalState.settings[field.key] = ""; // Initialize missing fields
        }
      });
    }
    setLocalApiSettings(initialLocalState);
    setSaveStatus("idle"); // Reset save status when config changes externally
    setSaveError(null);
  }, [apiConfig]); // Rerun only if the API config from context changes

  // Initialize local state for Language when currentLocale changes
  useEffect(() => {
    setLocalLocale(currentLocale);
    setLanguageSaveStatus("idle"); // Reset save status
    setLanguageSaveError(null);
  }, [currentLocale]);

  // Initialize local state for Image Compression when appSettings change
  useEffect(() => {
    setLocalImageCompressionEnabled(appSettings.imageCompressionEnabled);
    setImageSaveStatus("idle"); // Reset save status
    setImageSaveError(null);
  }, [appSettings.imageCompressionEnabled]);

  // Handle changes ONLY for API provider select and API settings inputs
  const handleApiChange = useCallback((e) => {
    const { name, value } = e.target;
    setSaveStatus("idle");
    setSaveError(null);

    setLocalApiSettings((prevApiSettings) => {
      let newApiSettings = { ...prevApiSettings };

      if (name === "providerType") {
        // Handle API provider change
        const newProviderType = value;
        const oldProviderId = prevApiSettings.providerType;
        const newProvider = getProviderById(newProviderType);

        newApiSettings.providerType = newProviderType;
        newApiSettings.settings = {}; // Reset settings object

        // Initialize new provider's fields
        if (newProvider && newProvider.configFields) {
          newProvider.configFields.forEach((field) => {
            // Initialize with empty string
            newApiSettings.settings[field.key] = "";
          });
        }
      } else {
        // Handle change in a provider-specific setting input
        // Assumes input 'name' matches the key in the settings object
        newApiSettings.settings = {
          ...prevApiSettings.settings,
          [name]: value,
        };
      }
      return newApiSettings;
    });
  }, []); // No dependencies needed

  // Handle changes ONLY for the Language select dropdown
  const handleLocaleChange = useCallback((e) => {
    setLocalLocale(e.target.value);
    setLanguageSaveStatus("idle"); // Reset status when changing selection
    setLanguageSaveError(null);
  }, []); // No dependencies needed

  // Handle saving ONLY the Language configuration
  const handleSaveLanguage = useCallback(async () => {
    // Prevent saving if the locale hasn't actually changed
    if (localLocale === currentLocale) {
      return;
    }
    setLanguageSaveStatus("saving");
    setLanguageSaveError(null);
    try {
      // Call the context function to actually change and save the locale
      await changeLocale(localLocale); // Assuming changeLocale might become async if needed
      setLanguageSaveStatus("success");
      // Optionally reset status after a delay
    } catch (error) {
      // This catch might not be strictly necessary if changeLocale doesn't throw
      // but good practice in case it's modified later.
      console.error("Error saving language setting:", error);
      setLanguageSaveError(error.message || "An unexpected error occurred.");
      setLanguageSaveStatus("error");
    }
  }, [localLocale, currentLocale, changeLocale]); // Dependencies: local state, current context state, context function

  // Handle saving ONLY the API configuration
  const handleSaveApiConfig = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      // Pass the local API settings state to the context update function
      await saveApiConfig(localApiSettings);
      setSaveStatus("success");
      // Optionally reset status after a delay
      // setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveError(error.message || "An unexpected error occurred.");
      setSaveStatus("error");
    }
    // Removed duplicate catch block
  }, [localApiSettings, saveApiConfig]); // Dependencies: local state being saved, context function

  // Handle changes ONLY for Image settings inputs (e.g., checkbox)
  const handleImageSettingsChange = useCallback((e) => {
    const { name, checked, type } = e.target;
    if (type === 'checkbox') {
      setLocalImageCompressionEnabled(checked);
      setImageSaveStatus("idle"); // Reset status when changing selection
      setImageSaveError(null);
    }
    // Add handling for other input types if needed later
  }, []);

  // Handle saving ONLY the Image settings
  const handleSaveImageSettings = useCallback(async () => {
    // Prevent saving if the setting hasn't actually changed
    if (localImageCompressionEnabled === appSettings.imageCompressionEnabled) {
      return;
    }
    setImageSaveStatus("saving");
    setImageSaveError(null);
    try {
      // Call the context function to update and save the setting
      await updateAppSettings({ imageCompressionEnabled: localImageCompressionEnabled }); // updateAppSettings is sync, but use await for future-proofing
      setImageSaveStatus("success");
      // Optionally reset status after a delay
    } catch (error) {
      console.error("Error saving image settings:", error);
      setImageSaveError(error.message || "An unexpected error occurred.");
      setImageSaveStatus("error");
    }
  }, [localImageCompressionEnabled, appSettings.imageCompressionEnabled, updateAppSettings]); // Dependencies: local state, current context state, context function

  // --- Export Handler ---
  const handleExport = useCallback(async () => {
    if (typeof api.exportData !== "function") {
      setExportError(
        intl.formatMessage({
          id: "settings.data.exportNotSupported",
          defaultMessage:
            "Export is not supported by the current API provider.",
        }),
      );
      setExportStatus("error");
      return;
    }
    setExportStatus("exporting");
    setExportError(null);
    try {
      const zipBlob = await api.exportData(); // Provider returns a Blob
      if (zipBlob instanceof Blob) {
        // Create a URL for the blob
        const url = URL.createObjectURL(zipBlob);
        // Create a temporary link element
        const link = document.createElement("a");
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.download = `clothing_inventory_export_${apiConfig.providerType}_${timestamp}.zip`; // Suggest filename
        document.body.appendChild(link); // Append to body
        link.click(); // Programmatically click the link to trigger download
        document.body.removeChild(link); // Remove the link
        URL.revokeObjectURL(url); // Release the object URL
        setExportStatus("success");
        setTimeout(() => setExportStatus("idle"), 3000); // Reset status
      } else {
        throw new Error(
          intl.formatMessage({
            id: "settings.data.exportInvalidResponse",
            defaultMessage: "Export function did not return a valid file.",
          }),
        );
      }
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(
        error.message ||
          intl.formatMessage({
            id: "settings.data.exportUnexpectedError",
            defaultMessage: "An unexpected error occurred during export.",
          }),
      );
      setExportStatus("error");
    }
  }, [api, apiConfig.providerType, intl]);

  // --- Import Handlers ---
  const handleFileChange = (event) => {
    setImportStatus("idle"); // Reset status when file changes
    setImportError(null);
    setImportSummary("");
    const file = event.target.files[0];
    // Check for common zip MIME types or .zip extension
    if (
      file &&
      (file.name.toLowerCase().endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed")
    ) {
      setImportFile(file);
    } else {
      setImportFile(null);
      if (file) {
        // If a file was selected but wasn't a zip
        setImportError(
          intl.formatMessage({
            id: "settings.data.importInvalidFileType",
            defaultMessage: "Please select a .zip file.",
          }),
        );
        setImportStatus("error");
      }
    }
  };

  const handleImport = useCallback(async () => {
    if (!importFile || typeof api.importData !== "function") {
      setImportError(
        intl.formatMessage({
          id: "settings.data.importNotReady",
          defaultMessage: "No file selected or import is not supported.",
        }),
      );
      setImportStatus("error");
      return;
    }

    // *** Confirmation Dialog ***
    const confirmed = window.confirm(
      intl.formatMessage({
        id: "settings.data.importConfirmReplace",
        defaultMessage:
          "WARNING: Importing will replace ALL existing data (items, locations, categories, owners). This action cannot be undone. Are you sure you want to proceed?",
      }),
    );

    if (!confirmed) {
      setImportStatus("idle"); // Reset status if cancelled
      return;
    }

    setImportStatus("importing");
    setImportError(null);
    setImportSummary("");

    try {
      const result = await api.importData(importFile);
      if (result.success) {
        setImportStatus("success");
        setImportSummary(
          result.summary ||
            intl.formatMessage({
              id: "settings.data.importSuccessDefault",
              defaultMessage:
                "Import completed successfully. Data has been replaced.",
            }),
        );
        setImportFile(null); // Clear the file input state
        // Clear the actual input element value
        const fileInput = document.getElementById("import-file-input");
        if (fileInput) fileInput.value = "";
        // Consider forcing a refresh or notifying user to refresh other views
        alert(
          intl.formatMessage({
            id: "settings.data.importSuccessRefresh",
            defaultMessage:
              "Import successful! It is recommended to refresh the application or navigate away and back to view the changes.",
          }),
        );
      } else {
        throw new Error(
          result.error ||
            intl.formatMessage({
              id: "settings.data.importFailedUnknown",
              defaultMessage: "Import failed for an unknown reason.",
            }),
        );
      }
    } catch (error) {
      console.error("Import failed:", error);
      setImportError(
        error.message ||
          intl.formatMessage({
            id: "settings.data.importUnexpectedError",
            defaultMessage: "An unexpected error occurred during import.",
          }),
      );
      setImportStatus("error");
    }
  }, [api, importFile, intl]);

  const handleDestroy = useCallback(async () => {
    if (typeof api.destroyData !== "function") {
      setDestroyError(
        intl.formatMessage({
          id: "settings.data.destroyNotSupported",
          defaultMessage:
            "Destroy is not supported by the current API provider.",
        }),
      );
      setDestroyStatus("error");
      return;
    }

    const confirmed = window.confirm(
      intl.formatMessage(
        {
          id: "settings.data.destroyConfirm",
          defaultMessage:
            "EXTREME WARNING: This will permanently delete ALL data (items, locations, categories, owners, images) from the current provider ({providerName}). This action CANNOT BE UNDONE. Are you absolutely sure you want to proceed?",
        },
        {
          providerName:
            providerDisplayNames[apiConfig.providerType] ||
            apiConfig.providerType,
        },
      ),
    );

    if (!confirmed) {
      setDestroyStatus("idle"); // Reset status if cancelled
      return;
    }

    setDestroyStatus("destroying");
    setDestroyError(null);
    setDestroySummary("");

    try {
      const result = await api.destroyData();
      if (result.success) {
        setDestroyStatus("success");
        setDestroySummary(
          result.summary ||
            intl.formatMessage({
              id: "settings.data.destroySuccessDefault",
              defaultMessage: "All data destroyed successfully.",
            }),
        );
        // Consider forcing a refresh or notifying user to refresh other views
        alert(
          intl.formatMessage({
            id: "settings.data.destroySuccessRefresh",
            defaultMessage:
              "Data destruction successful! It is recommended to refresh the application or navigate away and back to view the changes.",
          }),
        );
      } else {
        throw new Error(
          result.error ||
            intl.formatMessage({
              id: "settings.data.destroyFailedUnknown",
              defaultMessage: "Data destruction failed for an unknown reason.",
            }),
        );
      }
    } catch (error) {
      console.error("Data destruction failed:", error);
      setDestroyError(
        error.message ||
          intl.formatMessage({
            id: "settings.data.destroyUnexpectedError",
            defaultMessage:
              "An unexpected error occurred during data destruction.",
          }),
      );
      setDestroyStatus("error");
    }
  }, [api, apiConfig.providerType, providerDisplayNames, intl]);

  // Get the definition for the currently selected provider in the local state
  const selectedProviderId = localApiSettings?.providerType || "none";
  const selectedProvider = getProviderById(selectedProviderId);
  const availableProviderIds = getProviderIds(); // Get all available provider IDs

  return (
    <div className="settings-view">
      {" "}
      {/* Changed class name */}
      <h2>
        {intl.formatMessage({
          id: "settings.title",
          defaultMessage: "Settings",
        })}
      </h2>
      <form onSubmit={(e) => e.preventDefault()}>
        {/* --- Language Settings --- */}
        <fieldset className="settings-fieldset">
          <legend>
            {intl.formatMessage({
              id: "settings.language.legend",
              defaultMessage: "Language",
            })}
          </legend>
          <div className="form-group">
            {/* Display loading/error specific to language data */}
            {languageLoading && <p className="status-loading">{intl.formatMessage({ id: "common.loading", defaultMessage: "Loading..."})}</p>}
            {languageLoadError && <p className="status-error">{languageLoadError}</p>}

            <label htmlFor="locale">
              {intl.formatMessage({
                id: "settings.language.label",
                defaultMessage: "Display Language:",
              })}
            </label>
            {/* Removed setting-with-button wrapper */}
              <select
                id="locale"
                name="locale" // Informational name
                value={localLocale} // Value from local state
                onChange={handleLocaleChange} // Use dedicated handler
                disabled={languageLoading || languageSaveStatus === 'saving'} // Disable while loading/saving
              >
                {/* Use availableLocales from translation context */}
                {availableLocales.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                  </option>
                ))}
              </select>
            {/* Removed button and closing div from here */}
          </div>
          {/* Added form-actions wrapper for the button */}
          <div className="form-actions">
              <button
                type="button"
                onClick={handleSaveLanguage}
                className="button-primary" // Removed button-save-inline
                disabled={languageSaveStatus === 'saving' || languageSaveStatus === 'success' || localLocale === currentLocale || languageLoading}
              >
                {languageSaveStatus === 'saving'
                  ? intl.formatMessage({ id: "common.saving", defaultMessage: "Saving..." })
                  : intl.formatMessage({ id: "settings.language.saveButton", defaultMessage: "Save Language" })}
              </button>
          </div>
          {/* Save Status Feedback for Language Settings */}
          <div className="save-feedback" style={{ minHeight: '20px' }}>
            {languageSaveStatus === 'success' && (
              <p className="status-success">{intl.formatMessage({ id: "settings.language.saveSuccess", defaultMessage: "Language saved successfully!" })}</p>
            )}
            {languageSaveStatus === 'error' && (
              <p className="status-error">{intl.formatMessage({ id: "settings.language.saveError", defaultMessage: "Language Save Error: {error}" }, { error: languageSaveError })}</p>
            )}
          </div>
        </fieldset>

        {/* --- API Settings --- */}
        <fieldset className="settings-fieldset">
          <legend>
            {intl.formatMessage({
              id: "settings.api.legend",
              defaultMessage: "API Configuration",
            })}
          </legend>
          <div className="form-group">
            <label htmlFor="providerType">
              {intl.formatMessage({
                id: "settings.api.providerLabel",
                defaultMessage: "API Provider:",
              })}
            </label>
            <select
              id="providerType"
              name="providerType" // Name matches key in localApiSettings state
              value={selectedProviderId} // Value from local API state
              onChange={handleApiChange} // Use API change handler
            >
              {availableProviderIds.map((id) => (
                <option key={id} value={id}>
                  {providerDisplayNames[id] || id} {/* Show display name */}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamically Rendered Provider Fields */}
          {selectedProvider &&
            selectedProvider.configFields &&
            selectedProvider.configFields.map((field) => (
              <div className="form-group" key={field.key}>
                {/* Use intl.formatMessage for the label */}
                <label htmlFor={`api-setting-${field.key}`}>
                  {intl.formatMessage({ id: field.label })}:
                </label>
                <input
                  type={field.type}
                  id={`api-setting-${field.key}`} // Unique ID
                  name={field.key} // Name matches the key within localApiSettings.settings
                  value={localApiSettings.settings?.[field.key] || ""} // Access nested setting safely
                  onChange={handleApiChange} // Use API change handler
                  // Use intl.formatMessage for the placeholder
                  placeholder={
                    field.placeholder
                      ? intl.formatMessage({ id: field.placeholder })
                      : ""
                  } // Added check for placeholder existence
                  required={field.required} // Basic HTML5 validation
                />
              </div>
            ))}

          {/* Conditional Description for PostgREST */}
          {selectedProviderId === "postgrest" && (
            <p className="provider-description">
              {intl.formatMessage({
                id: "settings.api.postgrestDescription", // Need to add this translation key
                defaultMessage:
                  "Connects to a PostgREST API server, which provides a REST interface for a PostgreSQL database. Ensure PostgREST is running and accessible at the URL below.",
              })}
            </p>
          )}

          {/* Action Buttons for API Settings */}
          <div className="form-actions">
            {/* Use button-primary */}
            <button
              type="button"
              onClick={handleSaveApiConfig}
              className="button-primary"
              disabled={saveStatus === "saving" || saveStatus === "success"}
            >
              {saveStatus === "saving"
                ? intl.formatMessage({
                    id: "settings.api.saveButton.saving",
                    defaultMessage: "Saving API Config...",
                  })
                : intl.formatMessage({
                    id: "settings.api.saveButton",
                    defaultMessage: "Save API Config",
                  })}
            </button>
          </div>

          {/* Save Status Feedback for API Settings */}
          {/* Use common status classes */}
          <div className="save-feedback" style={{ minHeight: "20px" }}>
            {" "}
            {/* Remove margin-top, handled by status class */}
            {saveStatus === "success" && (
              <p className="status-success">
                {intl.formatMessage({
                  id: "settings.api.saveSuccess",
                  defaultMessage: "API configuration saved successfully!",
                })}
              </p>
            )}
            {/* Use status-error class */}
            {saveStatus === "error" && (
              <p className="status-error">
                {intl.formatMessage(
                  {
                    id: "settings.api.saveError",
                    defaultMessage: "API Save Error: {error}",
                  },
                  { error: saveError },
                )}
              </p>
            )}
          </div>
        </fieldset>

        {/* --- Image Settings --- */}
        <fieldset className="settings-fieldset">
          <legend>
            {intl.formatMessage({
              id: "settings.image.legend",
              defaultMessage: "Image Processing",
            })}
          </legend>
          <div className="form-group checkbox-group"> {/* Use checkbox-group for alignment */}
            <div className="setting-with-button"> {/* Wrapper for checkbox item and button */}
              <div className="checkbox-item"> {/* Wrap label and input */}
                <input
                  type="checkbox"
                  id="imageCompressionEnabled"
                  name="imageCompressionEnabled"
                  checked={localImageCompressionEnabled} // Use local state
                  onChange={handleImageSettingsChange} // Use new handler
                  disabled={imageSaveStatus === 'saving'} // Disable while saving
                />
                <label htmlFor="imageCompressionEnabled">
                  {intl.formatMessage({
                    id: "settings.image.compressionEnabled.label",
                    defaultMessage: "Enable image compression (reduces size before saving):",
                  })}
                </label>
              </div>
              {/* Button removed from here */}
            </div>
            {/* Added form-actions wrapper for the button */}
            <div className="form-actions">
              <button
                type="button"
                onClick={handleSaveImageSettings}
                className="button-primary" // Removed button-save-inline
                disabled={imageSaveStatus === 'saving' || imageSaveStatus === 'success' || localImageCompressionEnabled === appSettings.imageCompressionEnabled}
              >
                {imageSaveStatus === 'saving'
                  ? intl.formatMessage({ id: "common.saving", defaultMessage: "Saving..." })
                  : intl.formatMessage({ id: "settings.image.saveButton", defaultMessage: "Save Image Settings" })}
              </button>
            </div>
          </div>
          {/* Save Status Feedback for Image Settings */}
          <div className="save-feedback" style={{ minHeight: '20px' }}>
            {imageSaveStatus === 'success' && (
              <p className="status-success">{intl.formatMessage({ id: "settings.image.saveSuccess", defaultMessage: "Image settings saved successfully!" })}</p>
            )}
            {imageSaveStatus === 'error' && (
              <p className="status-error">{intl.formatMessage({ id: "settings.image.saveError", defaultMessage: "Image Settings Save Error: {error}" }, { error: imageSaveError })}</p>
            )}
          </div>
        </fieldset>

        {/* --- Data Management (MOVED INSIDE FORM) --- */}
        <fieldset className="settings-fieldset">
          <legend>
            {intl.formatMessage({
              id: "settings.data.legend",
              defaultMessage: "Data Management",
            })}
          </legend>

          {/* Export Section */}
          <div className="data-management-section">
            <h4>
              {intl.formatMessage({
                id: "settings.data.exportTitle",
                defaultMessage: "Export Data",
              })}
            </h4>
            <p>
              {intl.formatMessage(
                {
                  id: "settings.data.exportDescription",
                  defaultMessage:
                    "Export all items, locations, categories, and owners from the currently active provider ({providerName}) into a downloadable .zip file.",
                },
                {
                  providerName:
                    providerDisplayNames[apiConfig.providerType] ||
                    apiConfig.providerType,
                },
              )}
            </p>
            <div className="form-actions">
              {/* Use button-primary */}
              <button
                type="button"
                onClick={handleExport}
                className="button-primary"
                disabled={
                  exportStatus === "exporting" ||
                  !api.exportData ||
                  !apiConfig.isConfigured
                }
              >
                {exportStatus === "exporting"
                  ? intl.formatMessage({
                      id: "settings.data.exportButton.exporting",
                      defaultMessage: "Exporting...",
                    })
                  : intl.formatMessage({
                      id: "settings.data.exportButton",
                      defaultMessage: "Export All Data",
                    })}
              </button>
            </div>
            <div className="feedback-section" style={{ minHeight: "20px" }}>
              {exportStatus === "success" && (
                <p className="status-success">
                  {intl.formatMessage({
                    id: "settings.data.exportSuccess",
                    defaultMessage:
                      "Export started successfully. Check your downloads.",
                  })}
                </p>
              )}
              {exportStatus === "error" && (
                <p className="status-error">
                  {intl.formatMessage(
                    {
                      id: "settings.data.exportError",
                      defaultMessage: "Export Error: {error}",
                    },
                    { error: exportError },
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Import Section */}
          <div className="data-management-section">
            <h4>
              {intl.formatMessage({
                id: "settings.data.importTitle",
                defaultMessage: "Import Data",
              })}
            </h4>
            <p className="warning-text">
              {intl.formatMessage(
                {
                  id: "settings.data.importWarning",
                  defaultMessage:
                    "Warning: Importing data will REPLACE ALL existing data in the currently active provider ({providerName}). This action cannot be undone.",
                },
                {
                  providerName:
                    providerDisplayNames[apiConfig.providerType] ||
                    apiConfig.providerType,
                },
              )}
            </p>
            <div className="form-group">
              <label htmlFor="import-file-input">
                {intl.formatMessage({
                  id: "settings.data.importFileLabel",
                  defaultMessage: "Select .zip file to import:",
                })}
              </label>
              {/* Button-like Label - Use button-light */}
              <label
                htmlFor="import-file-input"
                className={`button-light button-file-input ${importStatus === "importing" || !api.importData || !apiConfig.isConfigured ? "disabled" : ""}`}
              >
                {intl.formatMessage({
                  id: "settings.data.importChooseFile",
                  defaultMessage: "Choose File",
                })}
              </label>
              {/* Hidden Actual File Input */}
              <input
                type="file"
                id="import-file-input"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileChange}
                disabled={
                  importStatus === "importing" ||
                  !api.importData ||
                  !apiConfig.isConfigured
                }
                className="hidden-file-input" // Add class to hide
              />
              {/* Display Selected Filename */}
              {importFile && (
                <p className="selected-file-name">
                  {intl.formatMessage({
                    id: "settings.data.importSelectedFile",
                    defaultMessage: "Selected:",
                  })}{" "}
                  {importFile.name}
                </p>
              )}
            </div>
            <div className="form-actions">
              {/* Use button-danger */}
              <button
                type="button"
                onClick={handleImport}
                className="button-danger"
                disabled={
                  !importFile ||
                  importStatus === "importing" ||
                  !api.importData ||
                  !apiConfig.isConfigured
                }
              >
                {importStatus === "importing"
                  ? intl.formatMessage({
                      id: "settings.data.importButton.importing",
                      defaultMessage: "Importing...",
                    })
                  : intl.formatMessage({
                      id: "settings.data.importButton",
                      defaultMessage: "Import Data (Replace All)",
                    })}
              </button>
            </div>
            <div className="feedback-section" style={{ minHeight: "40px" }}>
              {" "}
              {/* More space for summary */}
              {importStatus === "success" && (
                <p className="status-success">{importSummary}</p>
              )}
              {importStatus === "error" && (
                <p className="status-error">
                  {intl.formatMessage(
                    {
                      id: "settings.data.importError",
                      defaultMessage: "Import Error: {error}",
                    },
                    { error: importError },
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Destroy Section */}
          <div className="data-management-section">
            <h4>
              {intl.formatMessage({
                id: "settings.data.destroyTitle",
                defaultMessage: "Destroy Data",
              })}
            </h4>
            <p className="warning-text">
              {intl.formatMessage(
                {
                  id: "settings.data.destroyWarning",
                  defaultMessage:
                    "Warning: This action will permanently delete ALL data (items, locations, categories, owners, images) from the currently active provider ({providerName}). This action CANNOT BE UNDONE.",
                },
                {
                  providerName:
                    providerDisplayNames[apiConfig.providerType] ||
                    apiConfig.providerType,
                },
              )}
            </p>
            <div className="form-actions">
              {/* Use button-danger */}
              <button
                type="button"
                onClick={handleDestroy}
                className="button-danger"
                disabled={
                  destroyStatus === "destroying" ||
                  !api.destroyData ||
                  !apiConfig.isConfigured
                }
              >
                {destroyStatus === "destroying"
                  ? intl.formatMessage({
                      id: "settings.data.destroyButton.destroying",
                      defaultMessage: "Destroying...",
                    })
                  : intl.formatMessage({
                      id: "settings.data.destroyButton",
                      defaultMessage: "Destroy All Data",
                    })}
              </button>
            </div>
            <div className="feedback-section" style={{ minHeight: "40px" }}>
              {destroyStatus === "success" && (
                <p className="status-success">{destroySummary}</p>
              )}
              {destroyStatus === "error" && (
                <p className="status-error">
                  {intl.formatMessage(
                    {
                      id: "settings.data.destroyError",
                      defaultMessage: "Destroy Error: {error}",
                    },
                    { error: destroyError },
                  )}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
};

export default SettingsView;
