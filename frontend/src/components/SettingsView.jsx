import React, { useState, useEffect } from 'react';
import './SettingsView.css'; // We'll create this CSS file next

const SettingsView = ({ isOpen, onClose, currentConfig, onSave }) => {
    // Local state for form inputs, initialized from currentConfig when opened
    const [providerType, setProviderType] = useState('datasette'); // Only option for now
    const [baseUrl, setBaseUrl] = useState('');
    const [apiToken, setApiToken] = useState('');

    // Update local state when the modal opens or currentConfig changes
    useEffect(() => {
        if (isOpen) {
            setProviderType(currentConfig.providerType || 'datasette');
            setBaseUrl(currentConfig.baseUrl || '');
            setApiToken(currentConfig.apiToken || '');
        }
    }, [isOpen, currentConfig]);

    const handleSave = () => {
        // Call the onSave function passed from ApiContext via App
        onSave({
            providerType,
            baseUrl,
            apiToken,
        });
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
                        value={providerType}
                        onChange={(e) => setProviderType(e.target.value)}
                        disabled // Only one option for now
                    >
                        <option value="datasette">Datasette</option>
                        {/* Add other providers here later */}
                        {/* <option value="homebox">Homebox</option> */}
                    </select>
                </div>

                {/* Show Datasette specific settings */}
                {providerType === 'datasette' && (
                    <>
                        <div className="form-group">
                            <label htmlFor="baseUrl">Datasette Base URL:</label>
                            <input
                                type="text"
                                id="baseUrl"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="e.g., http://localhost:8001/database"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="apiToken">Datasette API Token (Optional):</label>
                            <input
                                type="password" // Use password type for tokens
                                id="apiToken"
                                value={apiToken}
                                onChange={(e) => setApiToken(e.target.value)}
                                placeholder="Paste token if required"
                            />
                        </div>
                    </>
                )}

                {/* Add conditional blocks for other providers here later */}
                {/* {providerType === 'homebox' && ( ... )} */}

                <div className="form-actions">
                    <button onClick={handleSave} className="save-button">Save</button>
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
