import React, { useState } from 'react';
import { useApi } from './api/ApiContext'; // Import the custom hook
import SettingsView from './components/SettingsView'; // Import the SettingsView component
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for modal visibility
  const api = useApi(); // Use the API context hook

  const handleAddDefaults = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // NOTE: The responsibility for adding location/category/image and handling IDs
      // (even if brittlely assuming '1' for now) is pushed down into the provider's addItem method.

      try {
          if (!api.config.isConfigured) { // Check the nested config object
              throw new Error("API provider is not configured. Check VITE_API_PROVIDER and associated variables in your .env file.");
          }
          if (api.config.providerType !== 'datasette') { // Check the nested config object
               throw new Error(`This 'Add Default Entries' button currently only supports the 'datasette' provider type. Current type: ${api.config.providerType}`);
          }
          // Check if the necessary addItem method exists (it might not if config failed)
          if (!api.addItem) {
              throw new Error("API 'addItem' method is not available. Check configuration and console logs.");
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
    <div className="App">
      <header className="App-header">
        <h1>Inventory Management</h1>
        <p>Frontend Placeholder - React App</p>
        <p>Datasette backend running separately.</p>
        {/* Add Settings Button */}
        <button onClick={() => setIsSettingsOpen(true)} className="settings-button">
          API Settings
        </button>
      </header>
      <main style={{ padding: '20px' }}>
        {/* Only show Datasette-specific default data section if configured */}
        {api.config.isConfigured && api.config.providerType === 'datasette' && (
          <>
            <h2>Add Default Data</h2>
            <p>Click the button below to add placeholder entries for Location, Category, Image, and Item via the Datasette API.</p>
            <button onClick={handleAddDefaults} disabled={loading}>
                {loading ? 'Adding...' : 'Add Default Entries'}
            </button>
            {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>} {/* Error/Success messages remain the same */}
            {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
            {/* Warning moved below */}
          </>
        )}
        {/* Update Datasette token warning to use specific config key */}
        {api.config.providerType === 'datasette' && !api.config.datasetteApiToken && api.config.isConfigured && // Corrected property name
          <p style={{ color: 'orange', marginTop: '10px' }}>
            Warning: Datasette provider is configured but API Token (VITE_DATASETTE_TOKEN / Settings) is not set. Operations requiring authentication may fail.
          </p>}
      </main>

      {/* Render Settings Modal */}
      <SettingsView
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentConfig={api.config} // Pass the whole config object from context
        onSave={api.updateConfiguration} // Pass the update function from context
      />
    </div>
  );
}

export default App;
