import React, { useState } from 'react';
import { useApi } from './api/ApiContext'; // Import the custom hook
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const api = useApi(); // Use the API context hook

  const handleAddDefaults = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // NOTE: This function assumes that if the default location, category,
      // and image don't exist, inserting them will result in IDs 1, 1, and 1
      // respectively. This is NOT robust for a real application but serves
      // as a placeholder example. A real app would fetch IDs or handle conflicts.
      // A robust implementation would handle potential existing records or get returned IDs.

      try {
          if (!api.isConfigured) {
              throw new Error("API provider is not configured. Check VITE_API_PROVIDER and associated variables in your .env file.");
          }
          if (api.providerType !== 'datasette') {
               throw new Error(`Unsupported provider type for default data: ${api.providerType}`);
          }
          // Check if the necessary methods exist (they might not if config failed)
          if (!api.addLocation || !api.addCategory || !api.addImage || !api.addItem) {
              throw new Error("API methods are not available. Check configuration and console logs.");
          }

          // 1. Add Default Location
          const locationData = { name: "Default Location", description: "Placeholder location" };
          await api.addLocation(locationData);

          // 2. Add Default Category
          const categoryData = { name: "Default Category", description: "Placeholder category" };
          await api.addCategory(categoryData);

          // 3. Add Default Image
          // Using base64 encoded placeholder text for binary data
          // Note: The base64 encoding is now handled inside datasetteProvider.addImage
          const imageData = { image_data: "placeholder image data", image_mimetype: "text/plain" };
          await api.addImage(imageData);
           // We assume the IDs are 1, 1, 1 if they were newly inserted.
           // If they already existed, we still try to add the item linked to ID 1.
          // TODO: A robust solution would fetch/confirm IDs after insertion.
           const assumedLocationId = 1;
           const assumedCategoryId = 1;
           const assumedImageId = 1;

          // 4. Add Default Item linked to assumed IDs
          const itemData = {
              name: "Default Item",
              description: "Placeholder item created via API",
              location_id: assumedLocationId,
              category_id: assumedCategoryId,
              image_id: assumedImageId
          };
          await api.addItem(itemData);

          setSuccess('Successfully added default location, category, image, and item.'); // Updated message

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
      </header>
      <main style={{ padding: '20px' }}>
          <h2>Add Default Data</h2>
          <p>Click the button below to add placeholder entries for Location, Category, Image, and Item via the Datasette API.</p>
          <button onClick={handleAddDefaults} disabled={loading}>
              {loading ? 'Adding...' : 'Add Default Entries'}
          </button>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
          {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
          {!API_TOKEN.startsWith('dstok_') && <p style={{ color: 'orange', marginTop: '10px' }}>Warning: API Token looks like a placeholder. Please replace `YOUR_DATASATTE_API_TOKEN_HERE` in App.jsx.</p>}
      </main>
    </div>
  );
}

export default App;
