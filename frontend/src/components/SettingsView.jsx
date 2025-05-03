import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl'; // Import useIntl
import JSZip from 'jszip'; // Import JSZip for potential use (though logic is in provider)
import { getProviderIds, getProviderById, getProviderDisplayNames } from '../api/providerRegistry';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import { useTranslationContext } from '../translations/TranslationContext'; // Import translation hook
import './SettingsView.css';
// SettingsView now gets its state and save functions from context
const SettingsView = () => {
    const { config: apiConfig, updateConfiguration: saveApiConfig } = useApi(); // Get API context
    const { locale: currentLocale, changeLocale, availableLocales } = useTranslationContext(); // Get Translation context
    const api = useApi(); // Get full API context to access export/import methods

    // Local state ONLY holds the API configuration being edited
    const [localApiSettings, setLocalApiSettings] = useState({ providerType: 'none', settings: {} });
    // State for API config saving
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
    const [saveError, setSaveError] = useState(null);
    const [providerDisplayNames, setProviderDisplayNames] = useState({});
    const intl = useIntl(); // Get intl object
    // Removed duplicate state declarations for saveStatus and saveError

    // Initialize provider display names once
    // State for Export
    const [exportStatus, setExportStatus] = useState('idle'); // 'idle', 'exporting', 'success', 'error'
    const [exportError, setExportError] = useState(null);

    // State for Import
    const [importFile, setImportFile] = useState(null);
    const [importStatus, setImportStatus] = useState('idle'); // 'idle', 'importing', 'success', 'error'
    const [importError, setImportError] = useState(null);
    const [importSummary, setImportSummary] = useState(''); // To show messages like "Import successful"
    useEffect(() => {
        setProviderDisplayNames(getProviderDisplayNames());
    }, []);

    // Initialize local state for API settings when apiConfig changes
    useEffect(() => {
        // Use a deep copy method (structuredClone preferred)
        const initialLocalState = {
            providerType: apiConfig.providerType || 'none',
            settings: apiConfig.settings ? (typeof structuredClone === 'function' ? structuredClone(apiConfig.settings) : JSON.parse(JSON.stringify(apiConfig.settings))) : {}
        };
        // Ensure all fields defined in the registry for the current provider exist in local state
        const provider = getProviderById(initialLocalState.providerType);
        if (provider && provider.configFields) {
            provider.configFields.forEach(field => {
                if (!(field.key in initialLocalState.settings)) {
                    initialLocalState.settings[field.key] = ''; // Initialize missing fields
                }
            });
        }
        setLocalApiSettings(initialLocalState);
        setSaveStatus('idle'); // Reset save status when config changes externally
        setSaveError(null);
    }, [apiConfig]); // Rerun only if the API config from context changes

    // Handle changes ONLY for API provider select and API settings inputs
    const handleApiChange = useCallback((e) => {
        const { name, value } = e.target;
        setSaveStatus('idle');
        setSaveError(null);

        setLocalApiSettings(prevApiSettings => {
            let newApiSettings = { ...prevApiSettings };

            if (name === 'providerType') {
                // Handle API provider change
                const newProviderType = value;
                const oldProviderId = prevApiSettings.providerType;
                const newProvider = getProviderById(newProviderType);

                newApiSettings.providerType = newProviderType;
                newApiSettings.settings = {}; // Reset settings object

                // Initialize new provider's fields
                if (newProvider && newProvider.configFields) {
                    newProvider.configFields.forEach(field => {
                        // Initialize with empty string
                        newApiSettings.settings[field.key] = '';
                    });
                }
            } else {
                // Handle change in a provider-specific setting input
                // Assumes input 'name' matches the key in the settings object
                newApiSettings.settings = {
                    ...prevApiSettings.settings,
                    [name]: value
                };
            }
            return newApiSettings;
        });
    }, []); // No dependencies needed

    // Handle language change directly using context function
    const handleLocaleChange = useCallback((e) => {
        changeLocale(e.target.value);
        // Note: Language change is saved immediately via context, no local state needed here.
        // Reset API save status if user changes language while API settings are modified but not saved.
        setSaveStatus('idle');
        setSaveError(null);
    }, [changeLocale]);

    // Handle saving ONLY the API configuration
    const handleSaveApiConfig = useCallback(async () => {
        setSaveStatus('saving');
        setSaveError(null);
        try {
            // Pass the local API settings state to the context update function
            await saveApiConfig(localApiSettings);
            setSaveStatus('success');
            // Optionally reset status after a delay
            // setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setSaveError(error.message || 'An unexpected error occurred.');
            setSaveStatus('error');
        }
        // Removed duplicate catch block
    }, [localApiSettings, saveApiConfig]); // Dependencies: local state being saved, context function

    // --- Export Handler ---
    const handleExport = useCallback(async () => {
        if (typeof api.exportData !== 'function') {
            setExportError(intl.formatMessage({ id: 'settings.data.exportNotSupported', defaultMessage: 'Export is not supported by the current API provider.' }));
            setExportStatus('error');
            return;
        }
        setExportStatus('exporting');
        setExportError(null);
        try {
            const zipBlob = await api.exportData(); // Provider returns a Blob
            if (zipBlob instanceof Blob) {
                // Create a URL for the blob
                const url = URL.createObjectURL(zipBlob);
                // Create a temporary link element
                const link = document.createElement('a');
                link.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                link.download = `clothing_inventory_export_${apiConfig.providerType}_${timestamp}.zip`; // Suggest filename
                document.body.appendChild(link); // Append to body
                link.click(); // Programmatically click the link to trigger download
                document.body.removeChild(link); // Remove the link
                URL.revokeObjectURL(url); // Release the object URL
                setExportStatus('success');
                setTimeout(() => setExportStatus('idle'), 3000); // Reset status
            } else {
                throw new Error(intl.formatMessage({ id: 'settings.data.exportInvalidResponse', defaultMessage: 'Export function did not return a valid file.' }));
            }
        } catch (error) {
            console.error("Export failed:", error);
            setExportError(error.message || intl.formatMessage({ id: 'settings.data.exportUnexpectedError', defaultMessage: 'An unexpected error occurred during export.' }));
            setExportStatus('error');
        }
    }, [api, apiConfig.providerType, intl]);

    // --- Import Handlers ---
    const handleFileChange = (event) => {
        setImportStatus('idle'); // Reset status when file changes
        setImportError(null);
        setImportSummary('');
        const file = event.target.files[0];
        if (file && file.type === 'application/zip') {
            setImportFile(file);
        } else {
            setImportFile(null);
            if (file) { // If a file was selected but wasn't a zip
                setImportError(intl.formatMessage({ id: 'settings.data.importInvalidFileType', defaultMessage: 'Please select a .zip file.' }));
                setImportStatus('error');
            }
        }
    };

    const handleImport = useCallback(async () => {
        if (!importFile || typeof api.importData !== 'function') {
            setImportError(intl.formatMessage({ id: 'settings.data.importNotReady', defaultMessage: 'No file selected or import is not supported.' }));
            setImportStatus('error');
            return;
        }

        // *** Confirmation Dialog ***
        const confirmed = window.confirm(intl.formatMessage({ id: 'settings.data.importConfirmReplace', defaultMessage: 'WARNING: Importing will replace ALL existing data (items, locations, categories, owners). This action cannot be undone. Are you sure you want to proceed?' }));

        if (!confirmed) {
            setImportStatus('idle'); // Reset status if cancelled
            return;
        }

        setImportStatus('importing');
        setImportError(null);
        setImportSummary('');

        try {
            const result = await api.importData(importFile);
            if (result.success) {
                setImportStatus('success');
                setImportSummary(result.summary || intl.formatMessage({ id: 'settings.data.importSuccessDefault', defaultMessage: 'Import completed successfully. Data has been replaced.' }));
                setImportFile(null); // Clear the file input state
                // Clear the actual input element value
                const fileInput = document.getElementById('import-file-input');
                if (fileInput) fileInput.value = '';
                // Consider forcing a refresh or notifying user to refresh other views
                alert(intl.formatMessage({ id: 'settings.data.importSuccessRefresh', defaultMessage: 'Import successful! It is recommended to refresh the application or navigate away and back to view the changes.' }));
            } else {
                throw new Error(result.error || intl.formatMessage({ id: 'settings.data.importFailedUnknown', defaultMessage: 'Import failed for an unknown reason.' }));
            }
        } catch (error) {
            console.error("Import failed:", error);
            setImportError(error.message || intl.formatMessage({ id: 'settings.data.importUnexpectedError', defaultMessage: 'An unexpected error occurred during import.' }));
            setImportStatus('error');
        }
    }, [api, importFile, intl]);

    // Get the definition for the currently selected provider in the local state
    const selectedProviderId = localApiSettings?.providerType || 'none';
    const selectedProvider = getProviderById(selectedProviderId);
    const availableProviderIds = getProviderIds(); // Get all available provider IDs

    return (
        <div className="settings-view"> {/* Changed class name */}
            <h2>{intl.formatMessage({ id: 'settings.title', defaultMessage: 'Settings' })}</h2>
            <form onSubmit={(e) => e.preventDefault()}>

                {/* --- Language Settings --- */}
                <fieldset className="settings-fieldset">
                    <legend>{intl.formatMessage({ id: 'settings.language.legend', defaultMessage: 'Language' })}</legend>
                    <div className="form-group">
                        <label htmlFor="locale">{intl.formatMessage({ id: 'settings.language.label', defaultMessage: 'Display Language:' })}</label>
                        <select
                            id="locale"
                            name="locale" // Informational name
                            value={currentLocale} // Value from translation context
                            onChange={handleLocaleChange} // Use dedicated handler
                        >
                            {/* Use availableLocales from translation context */}
                            {availableLocales.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </fieldset>

                {/* --- API Settings --- */}
                <fieldset className="settings-fieldset">
                    <legend>{intl.formatMessage({ id: 'settings.api.legend', defaultMessage: 'API Configuration' })}</legend>
                    <div className="form-group">
                        <label htmlFor="providerType">{intl.formatMessage({ id: 'settings.api.providerLabel', defaultMessage: 'API Provider:' })}</label>
                        <select
                            id="providerType"
                            name="providerType" // Name matches key in localApiSettings state
                            value={selectedProviderId} // Value from local API state
                            onChange={handleApiChange} // Use API change handler
                        >
                            {availableProviderIds.map(id => (
                                <option key={id} value={id}>
                                    {providerDisplayNames[id] || id} {/* Show display name */}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dynamically Rendered Provider Fields */}
                    {selectedProvider && selectedProvider.configFields && selectedProvider.configFields.map(field => (
                        <div className="form-group" key={field.key}>
                            <label htmlFor={`api-setting-${field.key}`}>{field.label}:</label>
                            <input
                                type={field.type}
                                id={`api-setting-${field.key}`} // Unique ID
                                name={field.key} // Name matches the key within localApiSettings.settings
                                value={localApiSettings.settings?.[field.key] || ''} // Access nested setting safely
                                onChange={handleApiChange} // Use API change handler
                                placeholder={field.placeholder}
                                required={field.required} // Basic HTML5 validation
                            />
                        </div>
                    ))}

                    {/* Action Buttons for API Settings */}
                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleSaveApiConfig}
                            className="save-button"
                            disabled={saveStatus === 'saving' || saveStatus === 'success'} // Disable if saving or just succeeded
                        >
                            {saveStatus === 'saving'
                                ? intl.formatMessage({ id: 'settings.api.saveButton.saving', defaultMessage: 'Saving API Config...' })
                                : intl.formatMessage({ id: 'settings.api.saveButton', defaultMessage: 'Save API Config' })
                            }
                        </button>
                    </div>

                    {/* Save Status Feedback for API Settings */}
                    {/* Use common status classes */}
                    <div className="save-feedback" style={{ minHeight: '20px' }}> {/* Remove margin-top, handled by status class */}
                        {saveStatus === 'success' && <p className="status-success">{intl.formatMessage({ id: 'settings.api.saveSuccess', defaultMessage: 'API configuration saved successfully!' })}</p>}
                        {/* Use status-error class */}
                        {saveStatus === 'error' && <p className="status-error">{intl.formatMessage({ id: 'settings.api.saveError', defaultMessage: 'API Save Error: {error}' }, { error: saveError })}</p>}
                    </div>
                </fieldset>
            </form>

            {/* --- Data Management --- */}
            <fieldset className="settings-fieldset">
                <legend>{intl.formatMessage({ id: 'settings.data.legend', defaultMessage: 'Data Management' })}</legend>

                {/* Export Section */}
                <div className="data-management-section">
                    <h4>{intl.formatMessage({ id: 'settings.data.exportTitle', defaultMessage: 'Export Data' })}</h4>
                    <p>{intl.formatMessage({ id: 'settings.data.exportDescription', defaultMessage: 'Export all items, locations, categories, and owners from the currently active provider ({providerName}) into a downloadable .zip file.' }, { providerName: providerDisplayNames[apiConfig.providerType] || apiConfig.providerType })}</p>
                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="export-button" // Use specific class if needed, or rely on general button styles
                            disabled={exportStatus === 'exporting' || !api.exportData || !apiConfig.isConfigured}
                        >
                            {exportStatus === 'exporting'
                                ? intl.formatMessage({ id: 'settings.data.exportButton.exporting', defaultMessage: 'Exporting...' })
                                : intl.formatMessage({ id: 'settings.data.exportButton', defaultMessage: 'Export All Data' })
                            }
                        </button>
                    </div>
                    <div className="feedback-section" style={{ minHeight: '20px' }}>
                        {exportStatus === 'success' && <p className="status-success">{intl.formatMessage({ id: 'settings.data.exportSuccess', defaultMessage: 'Export started successfully. Check your downloads.' })}</p>}
                        {exportStatus === 'error' && <p className="status-error">{intl.formatMessage({ id: 'settings.data.exportError', defaultMessage: 'Export Error: {error}' }, { error: exportError })}</p>}
                    </div>
                </div>

                {/* Import Section */}
                <div className="data-management-section">
                    <h4>{intl.formatMessage({ id: 'settings.data.importTitle', defaultMessage: 'Import Data' })}</h4>
                    <p className="warning-text">{intl.formatMessage({ id: 'settings.data.importWarning', defaultMessage: 'Warning: Importing data will REPLACE ALL existing data in the currently active provider ({providerName}). This action cannot be undone.' }, { providerName: providerDisplayNames[apiConfig.providerType] || apiConfig.providerType })}</p>
                    <div className="form-group">
                        <label htmlFor="import-file-input">{intl.formatMessage({ id: 'settings.data.importFileLabel', defaultMessage: 'Select .zip file to import:' })}</label>
                        <input
                            type="file"
                            id="import-file-input"
                            accept=".zip,application/zip,application/x-zip-compressed" // Be generous with MIME types
                            onChange={handleFileChange}
                            disabled={importStatus === 'importing' || !api.importData || !apiConfig.isConfigured}
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleImport}
                            className="import-button" // Use specific class if needed
                            disabled={!importFile || importStatus === 'importing' || !api.importData || !apiConfig.isConfigured}
                        >
                            {importStatus === 'importing'
                                ? intl.formatMessage({ id: 'settings.data.importButton.importing', defaultMessage: 'Importing...' })
                                : intl.formatMessage({ id: 'settings.data.importButton', defaultMessage: 'Import Data (Replace All)' })
                            }
                        </button>
                    </div>
                     <div className="feedback-section" style={{ minHeight: '40px' }}> {/* More space for summary */}
                        {importStatus === 'success' && <p className="status-success">{importSummary}</p>}
                        {importStatus === 'error' && <p className="status-error">{intl.formatMessage({ id: 'settings.data.importError', defaultMessage: 'Import Error: {error}' }, { error: importError })}</p>}
                    </div>
                </div>
            </fieldset>
        </div>
    );
};

export default SettingsView;
