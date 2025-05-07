import React, { useState, useEffect, useCallback } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  getProviderIds,
  getProviderById,
  getProviderDisplayNames,
} from "../api/providerRegistry";
import { useApi } from "../api/ApiContext"; // Keep useApi for export/import/destroy
import { useTranslationContext } from "../translations/TranslationContext.jsx"; // Import translation context hook
import { useSettings } from "../settings/SettingsContext"; // Import useSettings hook
import "./SettingsView.css";
const SettingsView = () => {
  // Get settings and update function from the centralized context
  const { settings: appSettings, updateSettings: updateAppSettings } =
    useSettings(); // Get general app settings
  const api = useApi(); // Get full API context to access export/import methods
  const { availableLocales } = useTranslationContext(); // Get available locales from context
  const navigate = useNavigate(); // Initialize navigate

  // Local state for Language setting being edited - Initialize from settings context
  const [localLocale, setLocalLocale] = useState(appSettings.locale);
  // State for Language config saving
  const [languageSaveStatus, setLanguageSaveStatus] = useState("idle"); // 'idle', 'saving', 'success', 'error'
  const [languageSaveError, setLanguageSaveError] = useState(null); // Keep for local save feedback

  // Local state ONLY holds the API configuration being edited
  const [localApiSettings, setLocalApiSettings] = useState({
    providerType: "none",
    settings: {},
  });
  // State for API config saving
  const [apiSaveStatus, setApiSaveStatus] = useState("idle"); // 'idle', 'saving', 'success', 'error'
  const [apiSaveError, setApiSaveError] = useState(null); // Keep for local save feedback
  const [providerDisplayNames, setProviderDisplayNames] = useState({});
  const intl = useIntl(); // Get intl object

  // Local state for Image settings being edited
  const [localImageCompressionEnabled, setLocalImageCompressionEnabled] = // Initialize from settings context
    useState(appSettings.imageCompressionEnabled);
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
    const currentProviderId = appSettings.apiProviderType || "none";
    // Get the specific settings for the current provider from the global apiSettings object
    const providerSpecificSettings =
      appSettings.apiSettings?.[currentProviderId] || {};

    const initialLocalState = {
      providerType: currentProviderId,
      // Use a deep copy of the provider-specific settings
      settings:
        typeof structuredClone === "function"
          ? structuredClone(providerSpecificSettings)
          : JSON.parse(JSON.stringify(providerSpecificSettings)),
    };
    // Ensure all fields defined in the registry for the current provider exist in local state
    const provider = getProviderById(initialLocalState.providerType);
    if (provider && provider.configFields) {
      provider.configFields.forEach((field) => {
        if (
          initialLocalState.settings &&
          !(field.key in initialLocalState.settings)
        ) {
          initialLocalState.settings[field.key] = ""; // Initialize missing fields
        }
      });
    }
    setLocalApiSettings(initialLocalState);
    setApiSaveStatus("idle"); // Reset save status when config changes externally
    setApiSaveError(null);
  }, [appSettings.apiProviderType, appSettings.apiSettings]); // Depend on settings from context

  // Initialize local state for Language when currentLocale changes
  useEffect(() => {
    setLocalLocale(appSettings.locale); // Initialize from settings context
    setLanguageSaveStatus("idle"); // Reset save status
    setLanguageSaveError(null);
  }, [appSettings.locale]); // Depend on settings from context

  // Initialize local state for Image Compression when appSettings change
  useEffect(() => {
    setLocalImageCompressionEnabled(appSettings.imageCompressionEnabled);
    setImageSaveStatus("idle"); // Reset save status
    setImageSaveError(null);
  }, [appSettings.imageCompressionEnabled]);

  // Handle changes ONLY for API provider select and API settings inputs
  const handleApiChange = useCallback((e) => {
    const { name, value } = e.target;
    setApiSaveStatus("idle"); // Reset API save status
    setApiSaveError(null);

    setLocalApiSettings((prevApiSettings) => {
      let newApiSettings = { ...prevApiSettings };

      if (name === "providerType") {
        // Handle API provider change
        const newProviderType = value;
        const oldProviderId = prevApiSettings.providerType;
        const newProvider = getProviderById(newProviderType);

        newApiSettings.providerType = newProviderType;
        // Load persisted settings for the new provider type from global appSettings
        const persistedSettingsForNewProvider =
          appSettings.apiSettings?.[newProviderType] || {};

        // Deep copy these persisted settings
        newApiSettings.settings =
          typeof structuredClone === "function"
            ? structuredClone(persistedSettingsForNewProvider)
            : JSON.parse(JSON.stringify(persistedSettingsForNewProvider));

        // Initialize new provider's fields
        if (newProvider && newProvider.configFields) {
          newProvider.configFields.forEach((field) => {
            if (!(field.key in newApiSettings.settings)) {
              newApiSettings.settings[field.key] = ""; // Initialize with empty string
            }
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
    setLanguageSaveStatus("saving");
    setLanguageSaveError(null);
    try {
      // Call the context function to actually change and save the locale
      // Use updateAppSettings from SettingsContext
      await updateAppSettings({ locale: localLocale });
      setLanguageSaveStatus("success");
      // Optionally reset status after a delay
    } catch (error) {
      console.error("Error saving language setting:", error);
      setLanguageSaveError(error.message || "An unexpected error occurred.");
      setLanguageSaveStatus("error");
    }
  }, [localLocale, updateAppSettings]);

  // Handle saving ONLY the API configuration
  const handleSaveApiConfig = useCallback(async () => {
    setApiSaveStatus("saving");
    setApiSaveError(null);
    try {
      // Call updateAppSettings with the API provider type and settings
      await updateAppSettings({
        apiProviderType: localApiSettings.providerType,
        apiSettings: {
          ...(appSettings.apiSettings || {}), // Preserve settings for other providers
          [localApiSettings.providerType]: localApiSettings.settings, // Update/add settings for the current provider
        },
      });
      setApiSaveStatus("success");
      // Optionally reset status after a delay
      // setTimeout(() => setApiSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving API settings:", error);
      setApiSaveError(error.message || "An unexpected error occurred.");
      setApiSaveStatus("error");
    }
  }, [localApiSettings, updateAppSettings, appSettings.apiSettings]);

  // Handle changes ONLY for Image settings inputs (e.g., checkbox)
  const handleImageSettingsChange = useCallback((e) => {
    const { name, checked, type } = e.target;
    if (type === "checkbox") {
      setLocalImageCompressionEnabled(checked);
      setImageSaveStatus("idle"); // Reset status when changing selection
      setImageSaveError(null);
    }
    // Add handling for other input types if needed later
  }, []);

  // Handle saving ONLY the Image settings
  const handleSaveImageSettings = useCallback(async () => {
    setImageSaveStatus("saving");
    setImageSaveError(null);
    try {
      // Call the context function to update and save the setting
      await updateAppSettings({
        imageCompressionEnabled: localImageCompressionEnabled,
      }); // updateAppSettings is sync, but use await for future-proofing
      setImageSaveStatus("success");
      // Optionally reset status after a delay
    } catch (error) {
      console.error("Error saving image settings:", error);
      setImageSaveError(error.message || "An unexpected error occurred.");
      setImageSaveStatus("error");
    }
  }, [localImageCompressionEnabled, updateAppSettings]);

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
        link.download = `clothing_inventory_export_${appSettings.apiProviderType}_${timestamp}.zip`; // Use provider from settings
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
  }, [api, appSettings.apiProviderType, intl]);

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
        // Use summary if provided by API, otherwise format using counts, fallback to default
        const refreshRecommendation = intl.formatMessage({
          id: "settings.data.refreshRecommendation",
          defaultMessage:
            "It is recommended to refresh the application or navigate to another view and back to see all changes.",
        });
        let summaryMessage;
        if (result.summary) {
          summaryMessage = result.summary;
        } else if (result.counts) {
          summaryMessage = intl.formatMessage(
            {
              id: "settings.data.importSuccessSummary", // New ID
              defaultMessage:
                "Import successful. Replaced data with {locCount} locations, {catCount} categories, {ownerCount} owners, {itemCount} items.",
            },
            {
              locCount: result.counts.locations,
              catCount: result.counts.categories,
              ownerCount: result.counts.owners,
              itemCount: result.counts.items,
            },
          );
        } else {
          summaryMessage = intl.formatMessage({
            id: "settings.data.importSuccessDefault",
            defaultMessage:
              "Import completed successfully. Data has been replaced.",
          });
        }
        setImportSummary(`${summaryMessage} ${refreshRecommendation}`);
        setImportFile(null); // Clear the file input state
        // Clear the actual input element value
        const fileInput = document.getElementById("import-file-input");
        if (fileInput) fileInput.value = "";
        // Consider forcing a refresh or notifying user to refresh other views
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
  }, [api, importFile, intl]); // Removed updateAppSettings

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
          // Use provider from settings
          providerName:
            providerDisplayNames[appSettings.apiProviderType] ||
            appSettings.apiProviderType,
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
        const refreshRecommendation = intl.formatMessage({
          id: "settings.data.refreshRecommendation", // Reuse the same ID
          defaultMessage:
            "It is recommended to refresh the application or navigate to another view and back to see all changes.",
        });
        setDestroySummary(
          `${
            result.summary ||
            intl.formatMessage({
              id: "settings.data.destroySuccessDefault",
              defaultMessage: "All data destroyed successfully.",
            })
          } ${refreshRecommendation}`,
        );
        // Consider forcing a refresh or notifying user to refresh other views
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
  }, [api, appSettings.apiProviderType, providerDisplayNames, intl]); // Removed updateAppSettings

  // Handler for the new button
  const handleGoToSharePage = () => {
    navigate("/share-configuration");
  };

  // Get the definition for the currently selected provider in the local state
  const selectedProviderId =
    localApiSettings?.providerType || appSettings.apiProviderType || "none"; // Use local state first, then context
  const selectedProvider = getProviderById(selectedProviderId);
  const availableProviderIds = getProviderIds(); // Get all available provider IDs

  return (
    <div className="settings-view">
      {/* Changed class name */}
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
            <label htmlFor="locale">
              {intl.formatMessage({
                id: "settings.language.label",
                defaultMessage: "Display Language:",
              })}
            </label>
            <select
              id="locale"
              name="locale"
              value={localLocale} // Value from local state
              onChange={handleLocaleChange} // Use dedicated handler
              disabled={languageSaveStatus === "saving"} // Disable while saving
            >
              {/* Use availableLocales from translation context */}
              {availableLocales.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={handleSaveLanguage}
              className="button-primary"
              disabled={
                languageSaveStatus === "saving" ||
                languageSaveStatus === "success"
              }
            >
              {languageSaveStatus === "saving"
                ? intl.formatMessage({
                    id: "common.saving",
                    defaultMessage: "Saving...",
                  })
                : intl.formatMessage({
                    id: "settings.language.saveButton",
                    defaultMessage: "Save Language",
                  })}
            </button>
          </div>
          {/* Save Status Feedback for Language Settings */}
          <div className="save-feedback" style={{ minHeight: "20px" }}>
            {languageSaveStatus === "success" && (
              <p className="status-success">
                {intl.formatMessage({
                  id: "settings.language.saveSuccess",
                  defaultMessage: "Language saved successfully!",
                })}
              </p>
            )}
            {languageSaveStatus === "error" && (
              <p className="status-error">
                {intl.formatMessage(
                  {
                    id: "settings.language.saveError",
                    defaultMessage: "Language Save Error: {error}",
                  },
                  { error: languageSaveError },
                )}
              </p>
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
                <label htmlFor={`api-setting-${field.key}`}>
                  {intl.formatMessage({ id: field.label })}:
                </label>
                <input
                  type={field.type}
                  id={`api-setting-${field.key}`} // Unique ID
                  name={field.key} // Name matches the key within localApiSettings.settings
                  value={localApiSettings.settings?.[field.key] || ""} // Access nested setting safely
                  onChange={handleApiChange} // Use API change handler
                  placeholder={
                    field.placeholder
                      ? intl.formatMessage({ id: field.placeholder })
                      : ""
                  } // Added check for placeholder existence
                  required={field.required} // Basic HTML5 validation
                />
              </div>
            ))}

          {/* Action Buttons for API Settings */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleSaveApiConfig}
              className="button-primary"
              disabled={
                apiSaveStatus === "saving" || apiSaveStatus === "success"
              }
            >
              {apiSaveStatus === "saving"
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
          <div className="save-feedback" style={{ minHeight: "20px" }}>
            {apiSaveStatus === "success" && (
              <p className="status-success">
                {intl.formatMessage({
                  id: "settings.api.saveSuccess",
                  defaultMessage: "API configuration saved successfully!",
                })}
              </p>
            )}
            {apiSaveStatus === "error" && (
              <p className="status-error">
                {intl.formatMessage(
                  {
                    id: "settings.api.saveError",
                    defaultMessage: "API Save Error: {error}",
                  },
                  { error: apiSaveError },
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
          {/* Use standard form-group structure */}
          <div className="form-group">
            {/* Keep checkbox-item for potential specific styling if needed */}
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="imageCompressionEnabled"
                name="imageCompressionEnabled"
                checked={localImageCompressionEnabled} // Use local state
                onChange={handleImageSettingsChange} // Use new handler
                disabled={imageSaveStatus === "saving"} // Disable while saving
              />
              <label htmlFor="imageCompressionEnabled">
                {intl.formatMessage({
                  id: "settings.image.compressionEnabled.label",
                  defaultMessage:
                    "Enable image compression (reduces size before saving):",
                })}
              </label>
            </div>
          </div>
          {/* Standard form-actions block */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleSaveImageSettings}
              className="button-primary"
              disabled={
                imageSaveStatus === "saving" || imageSaveStatus === "success"
              }
            >
              {imageSaveStatus === "saving"
                ? intl.formatMessage({
                    id: "common.saving",
                    defaultMessage: "Saving...",
                  })
                : intl.formatMessage({
                    id: "settings.image.saveButton",
                    defaultMessage: "Save Image Settings",
                  })}
            </button>
          </div>

          {/* Save Status Feedback for Image Settings */}
          <div className="save-feedback" style={{ minHeight: "20px" }}>
            {imageSaveStatus === "success" && (
              <p className="status-success">
                {intl.formatMessage({
                  id: "settings.image.saveSuccess",
                  defaultMessage: "Image settings saved successfully!",
                })}
              </p>
            )}
            {imageSaveStatus === "error" && (
              <p className="status-error">
                {intl.formatMessage(
                  {
                    id: "settings.image.saveError",
                    defaultMessage: "Image Settings Save Error: {error}",
                  },
                  { error: imageSaveError },
                )}
              </p>
            )}
          </div>
        </fieldset>

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
                  // Use provider from settings
                  providerName:
                    providerDisplayNames[appSettings.apiProviderType] ||
                    appSettings.apiProviderType,
                },
              )}
            </p>
            <div className="form-actions">
              <button
                type="button"
                onClick={handleExport}
                className="button-primary"
                disabled={
                  exportStatus === "exporting" ||
                  !api.exportData || // Check if method exists on api object
                  !api.isConfigured // Use api.isConfigured
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
                  // Use provider from settings
                  providerName:
                    providerDisplayNames[appSettings.apiProviderType] ||
                    appSettings.apiProviderType,
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
              <label
                htmlFor="import-file-input"
                className={`button-light button-file-input ${importStatus === "importing" || !api.importData || !api.isConfigured ? "disabled" : ""}`} // Use api.isConfigured
              >
                {intl.formatMessage({
                  id: "settings.data.importChooseFile",
                  defaultMessage: "Choose File",
                })}
              </label>
              <input
                type="file"
                id="import-file-input"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileChange}
                disabled={
                  importStatus === "importing" || // Check if method exists on api object
                  !api.importData ||
                  !api.isConfigured // Use api.isConfigured
                }
                className="hidden-file-input"
              />
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
              <button
                type="button"
                onClick={handleImport}
                className="button-danger"
                disabled={
                  !importFile ||
                  importStatus === "importing" ||
                  !api.importData || // Check if method exists on api object
                  !api.isConfigured // Use api.isConfigured
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
                  // Use provider from settings
                  providerName:
                    providerDisplayNames[appSettings.apiProviderType] ||
                    appSettings.apiProviderType,
                },
              )}
            </p>
            <div className="form-actions">
              <button
                type="button"
                onClick={handleDestroy}
                className="button-danger"
                disabled={
                  destroyStatus === "destroying" ||
                  !api.destroyData || // Check if method exists on api object
                  !api.isConfigured // Use api.isConfigured
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

          {/* Share Configuration Section (NEW) */}
          <div className="data-management-section">
            <h4>
              {intl.formatMessage({
                id: "settings.data.share.title",
                defaultMessage: "Share Current Configuration",
              })}
            </h4>
            <p>
              {intl.formatMessage({
                id: "settings.data.share.description",
                defaultMessage:
                  "Create a shareable link that encapsulates your current application settings. This allows others to easily adopt the same configuration, including API provider details. Useful for collaboration or setting up on different devices.",
              })}
            </p>
            <p className="warning-text">
              {intl.formatMessage({
                id: "settings.data.share.warning",
                defaultMessage:
                  "The generated link will contain all current settings, including any API tokens. Share this link only with trusted individuals, as they will gain the same access and configuration as you.",
              })}
            </p>
            <div className="form-actions">
              <button
                type="button"
                onClick={handleGoToSharePage}
                className="button-primary" // Consistent with Export button
              >
                {intl.formatMessage({
                  id: "settings.data.share.button",
                  defaultMessage: "Create Shareable Link",
                })}
              </button>
            </div>
            {/* No feedback section needed here as it navigates away */}
          </div>
        </fieldset>
      </form>
    </div>
  );
};

export default SettingsView;
