import React, { useState } from 'react';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const DATASETTE_URL = 'http://127.0.0.1:8001/inventory';
  const API_TOKEN = 'dstok_<token>';

  const handleAddDefaults = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // NOTE: This function assumes that if the default location, category,
      // and image don't exist, inserting them will result in IDs 1, 1, and 1
      // respectively. This is NOT robust for a real application but serves
      // as a placeholder example. A real app would fetch IDs or handle conflicts.

      const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
      };

      try {
          // 1. Add Default Location
          const locationData = { row: { name: "Default Location", description: "Placeholder location" } };
          let res = await fetch(`${DATASETTE_URL}/locations/-/insert`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(locationData),
          });
          // Simplified check: Fail if the request wasn't successful for any reason.
          if (!res.ok) {
               throw new Error(`Failed to add location: ${res.status} ${await res.text()}`);
          }
          console.log('Location add response status:', res.status);

          // 2. Add Default Category
          const categoryData = { row: { name: "Default Category", description: "Placeholder category" } };
          res = await fetch(`${DATASETTE_URL}/categories/-/insert`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(categoryData),
          });
          // Simplified check: Fail if the request wasn't successful for any reason.
           if (!res.ok) {
               throw new Error(`Failed to add category: ${res.status} ${await res.text()}`);
          }
          console.log('Category add response status:', res.status);

          // 3. Add Default Image
          // Using base64 encoded placeholder text for binary data
          const imageData = { row: { image_data: btoa("placeholder image data"), image_mimetype: "text/plain" } };
          res = await fetch(`${DATASETTE_URL}/images/-/insert`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(imageData),
          });
          // Simplified check: Fail if the request wasn't successful for any reason.
           if (!res.ok) {
               throw new Error(`Failed to add image: ${res.status} ${await res.text()}`);
          }
          console.log('Image add response status:', res.status);
           // We assume the IDs are 1, 1, 1 if they were newly inserted.
           // If they already existed, we still try to add the item linked to ID 1.
           const assumedLocationId = 1;
           const assumedCategoryId = 1;
           const assumedImageId = 1;


          // 4. Add Default Item linked to assumed IDs
          const itemData = { row: {
              name: "Default Item",
              description: "Placeholder item created via API",
              location_id: assumedLocationId,
              category_id: assumedCategoryId,
              image_id: assumedImageId
          }};
          res = await fetch(`${DATASETTE_URL}/items/-/insert`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(itemData),
          });
          if (!res.ok) {
               throw new Error(`Failed to add item: ${res.status} ${await res.text()}`);
          }
          console.log('Item add response status:', res.status);

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
