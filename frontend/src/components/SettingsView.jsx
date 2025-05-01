import React, { useState, useEffect } from 'react';
import './SettingsView.css';

const SettingsView = ({ isOpen, onClose, currentConfig, onSave }) => {
    // Local state for form inputs, initialized from currentConfig when opened
    // Holds all potential settings, mirroring the structure saved/loaded by ApiContext
    const [settings, setSettings] = useState({
        providerType: 'datasette',
        datasetteBaseUrl: '',
        datasetteApiToken: '',
        // Add fields for other providers here later
    });

    // Update local state when the modal opens or currentConfig changes
    useEffect(() => {
        if (isOpen) {
            setSettings({
                providerType: currentConfig.providerType || 'datasette',
                datasetteBaseUrl: currentConfig.datasetteBaseUrl || '',
                datasetteApiToken: currentConfig.datasetteApiToken || '',
                // Populate other provider fields from currentConfig here later
            });
        }
    }, [isOpen, currentConfig]);

    const handleSave = () => {
        onSave(settings); // Pass the complete local settings object
        onClose(); // Close the modal after saving
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal-content">
                <h2>API Settings</h2>

                <div className="form-group">
                    <label htmlFor="providerType">API Provider:</label>
                    <select
                        id="providerType"
                        value={settings.providerType}
                        onChange={(e) => setSettings(s => ({ ...s, providerType: e.target.value }))}
                        disabled // Only one option for now
                    >
                        <option value="datasette">Datasette</option>
                        {/* Add other providers here later */}
                        {/* <option value="homebox">Homebox</option> */}
                    </select>
                </div>

                {/* Show Datasette specific settings */}
                {settings.providerType === 'datasette' && (
                    <>
                        <div className="form-group">
                            <label htmlFor="baseUrl">Datasette Base URL:</label>
                            <input
                                type="text"
                                id="baseUrl"
                                value={settings.datasetteBaseUrl}
                                onChange={(e) => setSettings(s => ({ ...s, datasetteBaseUrl: e.target.value }))}
                                placeholder="e.g., http://localhost:8001/database"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="apiToken">Datasette API Token (Optional):</label>
                            <input
                                type="password"
                                id="apiToken"
                                value={settings.datasetteApiToken}
                                onChange={(e) => setSettings(s => ({ ...s, datasetteApiToken: e.target.value }))}
                                placeholder="Paste token if required"
                            />
                        </div>
                    </>
                )}

                {/* Add conditional blocks for other providers here later */}
                {/* {settings.providerType === 'homebox' && ( ... )} */}

                <div className="form-actions">
                    <button onClick={handleSave} className="save-button">Save</button>
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
