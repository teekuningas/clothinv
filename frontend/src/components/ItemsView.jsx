import React, { useState } from 'react';
import { useApi } from '../api/ApiContext';

const ItemsView = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const api = useApi(); // Use the API context hook

    const handleAddDefaults = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Use the generic isConfigured flag from the context
            if (!api.config.isConfigured) {
                throw new Error(`API provider (${api.config.providerType}) is not configured. Please check settings.`);
            }
            // Keep the check for datasette-specific feature
            if (api.config.providerType !== 'datasette') {
                 throw new Error(`This 'Add Default Entries' button currently only supports the 'datasette' provider type. Current type: ${api.config.providerType}`);
            }
            // Check if the addItem method was successfully bound by the context
            if (!api.addItem) {
                throw new Error("API 'addItem' method is not available. Check provider configuration and console logs.");
            }

            // Prepare the composite data object for the single API call
            const defaultData = {
                location: { name: "Default Location", description: "Placeholder location" },
                category: { name: "Default Category", description: "Placeholder category" },
                image: { image_data: "placeholder image data", image_mimetype: "text/plain" },
                item: {
                    name: "Default Item",
                    description: "Placeholder item created via API",
                    // location_id, category_id, image_id will be handled by the provider
                }
            };

            // Single call to the abstracted addItem method
            await api.addItem(defaultData);

            setSuccess('Successfully added default item (including location, category, image).');

        } catch (err) {
            console.error("Error adding default data:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Items Management</h2>
            <p>Item listing and management features will go here.</p>

            {/* Only show Datasette-specific default data section if configured */}
            {api.config.isConfigured && api.config.providerType === 'datasette' && (
                <div style={{ marginTop: '20px', borderTop: '1px dashed #ccc', paddingTop: '15px' }}>
                    <h3>Add Default Data (Datasette Only)</h3>
                    <p>Click the button below to add placeholder entries for Location, Category, Image, and Item via the Datasette API.</p>
                    <button onClick={handleAddDefaults} disabled={loading}>
                        {loading ? 'Adding...' : 'Add Default Entries'}
                    </button>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
                    {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
                </div>
            )}
        </div>
    );
};

export default ItemsView;
