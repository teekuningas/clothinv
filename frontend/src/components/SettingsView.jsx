import React, { useState, useEffect } from 'react';
import { getProviderIds, getProviderById, getProviderDisplayNames } from '../api/providerRegistry'; // Import registry functions
import './SettingsView.css';

const SettingsView = ({ isOpen, onClose, currentConfig, onSave }) => {
    // Local state holds the complete settings object being edited,
    // including providerType and provider-specific fields.
    const [localSettings, setLocalSettings] = useState({});
    const [providerDisplayNames, setProviderDisplayNames] = useState({});

    // Populate provider display names once
    useEffect(() => {
        setProviderDisplayNames(getProviderDisplayNames());
    }, []);

    // Initialize local state when the modal opens or the external config changes
    useEffect(() => {
        if (isOpen) {
            // Create a deep copy to avoid mutating the context state directly
            const initialSettings = JSON.parse(JSON.stringify({
                providerType: currentConfig.providerType || 'none',
                ...(currentConfig.settings || {}) // Spread existing settings
            }));
             // Ensure all fields defined in the registry for the current provider exist in local state
             const provider = getProviderById(initialSettings.providerType);
             if (provider && provider.configFields) {
                 provider.configFields.forEach(field => {
                     if (!(field.key in initialSettings)) {
                         initialSettings[field.key] = ''; // Initialize missing fields
                     }
                 });
             }
            setLocalSettings(initialSettings);
        }
    }, [isOpen, currentConfig]); // Rerun if modal opens or context config changes

    // Handle changes to any input field or the provider select
    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalSettings(prevSettings => {
            const newSettings = { ...prevSettings, [name]: value };
            // If providerType changed, reset specific fields to avoid carrying over old values
            if (name === 'providerType') {
                const oldProviderId = prevSettings.providerType;
                const newProvider = getProviderById(value);
                // Remove old provider's fields
                const oldProvider = getProviderById(oldProviderId);
                if (oldProvider && oldProvider.configFields) {
                    oldProvider.configFields.forEach(field => {
                        delete newSettings[field.key];
                    });
                }
                 // Initialize new provider's fields
                 if (newProvider && newProvider.configFields) {
                     newProvider.configFields.forEach(field => {
                         // Initialize with empty string, respecting existing values if any (e.g., from context)
                         newSettings[field.key] = newSettings[field.key] ?? '';
                     });
                 }
            }
            return newSettings;
        });
    };


    const handleSave = () => {
        // Pass the entire localSettings object (including providerType and specific fields)
        // back to the ApiContext's updateConfiguration function.
        onSave(localSettings);
        onClose(); // Close the modal
    };

    if (!isOpen) {
        return null;
    }

    // Get the definition for the currently selected provider in the form
    const selectedProviderId = localSettings.providerType || 'none';
    const selectedProvider = getProviderById(selectedProviderId);
    const availableProviderIds = getProviderIds();

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal-content">
                <h2>API Settings</h2>

                {/* Provider Selection */}
                <div className="form-group">
                    <label htmlFor="providerType">API Provider:</label>
                    <select
                        id="providerType"
                        name="providerType" // Name matches the key in localSettings state
                        value={selectedProviderId}
                        onChange={handleChange}
                        // disabled={availableProviderIds.length <= 1} // Optionally disable if only one provider
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
                        <label htmlFor={field.key}>{field.label}:</label>
                        <input
                            type={field.type}
                            id={field.key}
                            name={field.key} // Name matches the key in localSettings state
                            value={localSettings[field.key] || ''} // Ensure controlled component
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            required={field.required} // HTML5 validation (basic)
                        />
                    </div>
                ))}

                {/* Action Buttons */}
                <div className="form-actions">
                    <button onClick={handleSave} className="save-button">Save</button>
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
