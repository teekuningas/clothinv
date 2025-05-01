import React, { useState, useEffect } from 'react';
import { getProviderIds, getProviderById, getProviderDisplayNames } from '../api/providerRegistry'; // Import registry functions
import './SettingsView.css';

// Remove isOpen, onClose from props
const SettingsView = ({ currentConfig, onSave }) => {
    // Local state holds the complete settings object being edited,
    // including providerType and provider-specific fields.
    const [localSettings, setLocalSettings] = useState({}); // Keep this state
    const [providerDisplayNames, setProviderDisplayNames] = useState({});

    // Populate provider display names once
    useEffect(() => {
        setProviderDisplayNames(getProviderDisplayNames());
    }, []);

    // Initialize local state when the component mounts or the external config changes
    useEffect(() => {
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
        }
        setLocalSettings(initialSettings);
    }, [currentConfig]); // Rerun if context config changes

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
        // Remove onClose(); - No longer a modal
        // Optionally add a success message state here
    };

    // Get the definition for the currently selected provider in the form
    const selectedProviderId = localSettings?.providerType || 'none'; // Add optional chaining for safety
    const selectedProvider = getProviderById(selectedProviderId);
    const availableProviderIds = getProviderIds();

    return (
        <div className="settings-view-container"> {/* Use a container class */}
                <h2>API Settings</h2>
                {/* Keep the form structure, but remove modal wrappers */}
                <form onSubmit={(e) => e.preventDefault()}>
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
                    <button type="button" onClick={handleSave} className="save-button">Save Settings</button>
                    {/* Remove Cancel button */}
                </div>
                </form>
        </div>
    );
};

export default SettingsView;
