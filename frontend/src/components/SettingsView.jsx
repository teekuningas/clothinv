import React, { useState, useEffect, useCallback } from 'react';
import { getProviderIds, getProviderById, getProviderDisplayNames } from '../api/providerRegistry';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import { useTranslationContext } from '../translations/TranslationContext'; // Import translation hook
import './SettingsView.css';

// SettingsView now gets its state and save functions from context
const SettingsView = () => {
    const { config: apiConfig, updateConfiguration: saveApiConfig } = useApi(); // Get API context
    const { locale: currentLocale, changeLocale, availableLocales } = useTranslationContext(); // Get Translation context

    // Local state ONLY holds the API configuration being edited
    const [localApiSettings, setLocalApiSettings] = useState({ providerType: 'none', settings: {} });
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
    const [saveError, setSaveError] = useState(null);
    const [providerDisplayNames, setProviderDisplayNames] = useState({});
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
    const [saveError, setSaveError] = useState(null);

    // Populate provider display names once
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
        } catch (error) {
            console.error("Error saving API settings:", error);
            setSaveError(error.message || 'An unexpected error occurred.');
            setSaveStatus('error');
        }
    }, [localApiSettings, saveApiConfig]); // Dependencies: local state being saved, context function

    // Get the definition for the currently selected provider in the local state
    const selectedProviderId = localApiSettings?.providerType || 'none';
    const selectedProvider = getProviderById(selectedProviderId);
    const availableProviderIds = getProviderIds(); // Get all available provider IDs

    return (
        <div className="settings-view-container">
            <h2>Settings</h2>
            <form onSubmit={(e) => e.preventDefault()}>

                {/* --- Language Settings --- */}
                <fieldset className="settings-fieldset">
                    <legend>Language</legend>
                    <div className="form-group">
                        <label htmlFor="locale">Display Language:</label>
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
                    <legend>API Configuration</legend>
                    <div className="form-group">
                        <label htmlFor="providerType">API Provider:</label>
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
                            {saveStatus === 'saving' ? 'Saving API Config...' : 'Save API Config'}
                        </button>
                    </div>

                    {/* Save Status Feedback for API Settings */}
                    <div className="save-feedback" style={{ marginTop: '10px', minHeight: '20px' }}>
                        {saveStatus === 'success' && <p style={{ color: 'green' }}>API configuration saved successfully!</p>}
                        {saveStatus === 'error' && <p style={{ color: 'red' }}>API Save Error: {saveError}</p>}
                    </div>
                </fieldset>
            </form>
        </div>
    );
};

export default SettingsView;
