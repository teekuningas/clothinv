import React, { useState } from 'react';
import { useIntl } from 'react-intl'; // Import useIntl hook
import { useApi } from './api/ApiContext'; // Import the custom hook
// Import the view components
import ItemsView from './components/ItemsView';
import LocationsView from './components/LocationsView';
import CategoriesView from './components/CategoriesView';
import SettingsView from './components/SettingsView'; // Settings is now a view
import './App.css';
// Consider adding a new CSS file for navigation styles if needed

function App() {
  // Remove loading, error, success state - moved to ItemsView
  const intl = useIntl(); // Get intl object
  // Remove isSettingsOpen state

  const [activeView, setActiveView] = useState('items'); // Default view
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
  const api = useApi(); // Use the API context hook

  // Remove handleAddDefaults function - moved to ItemsView
/*
      // NOTE: The responsibility for adding location/category/image and handling IDs
      // The responsibility for adding related entities is handled within the provider's addItem method.

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
*/

    // Toggle mobile menu visibility
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    // Handle navigation from mobile menu (sets view and closes menu)
    const handleMobileNavClick = (view) => {
        setActiveView(view);
        setIsMobileMenuOpen(false);
    };

  // Helper function to render the active view
  const renderActiveView = () => {
      switch (activeView) {
          case 'items':
              return <ItemsView />;
          case 'locations':
              return <LocationsView />;
          case 'categories':
              return <CategoriesView />;
          case 'settings':
              // Pass props needed by SettingsView
              return <SettingsView
                         currentConfig={api.config}
                         onSave={api.updateConfiguration}
                     />;
          default:
              return <ItemsView />; // Default to items view
      }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>{intl.formatMessage({ id: 'app.title', defaultMessage: 'Inventory Management' })}</h1>
        {/* Hamburger button - shown only on small screens via CSS */}
        <button className="hamburger-button" onClick={toggleMobileMenu}>
            ☰ {/* Simple hamburger icon */}
        </button>
        {/* Simple Navigation - hidden on small screens via CSS */}
        <nav className="app-nav">
            <button onClick={() => setActiveView('items')} disabled={activeView === 'items'}>
                {intl.formatMessage({ id: 'nav.items', defaultMessage: 'Items' })}
            </button>
            <button onClick={() => setActiveView('locations')} disabled={activeView === 'locations'}>
                {intl.formatMessage({ id: 'nav.locations', defaultMessage: 'Locations' })}
            </button>
            <button onClick={() => setActiveView('categories')} disabled={activeView === 'categories'}>
                {intl.formatMessage({ id: 'nav.categories', defaultMessage: 'Categories' })}
            </button>
            <button onClick={() => setActiveView('settings')} disabled={activeView === 'settings'}>
                {intl.formatMessage({ id: 'nav.settings', defaultMessage: 'Settings' })}
            </button>
        </nav>
      </header>
      {/* Mobile Menu Overlay - shown when isMobileMenuOpen is true */}
      {isMobileMenuOpen && (
          <div className="mobile-menu-overlay">
              <button className="close-menu-button" onClick={toggleMobileMenu}>
                  &times; {/* Simple close icon */}
              </button>
              <nav className="mobile-nav">
                  <button onClick={() => handleMobileNavClick('items')} disabled={activeView === 'items'}>
                      {intl.formatMessage({ id: 'nav.items', defaultMessage: 'Items' })}
                  </button>
                  <button onClick={() => handleMobileNavClick('locations')} disabled={activeView === 'locations'}>
                      {intl.formatMessage({ id: 'nav.locations', defaultMessage: 'Locations' })}
                  </button>
                  <button onClick={() => handleMobileNavClick('categories')} disabled={activeView === 'categories'}>
                      {intl.formatMessage({ id: 'nav.categories', defaultMessage: 'Categories' })}
                  </button>
                  <button onClick={() => handleMobileNavClick('settings')} disabled={activeView === 'settings'}>
                      {intl.formatMessage({ id: 'nav.settings', defaultMessage: 'Settings' })}
                  </button>
              </nav>
          </div>
      )}
      <main className="app-main-content" style={{ padding: '20px' }}>
          {/* Render the active view component */}
          {renderActiveView()}

          {/* Keep Global Warnings Here */}
          <div className="global-warnings" style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
              {/* Update Datasette token warning */}
              {api.config.providerType === 'datasette' && api.config.isConfigured && !api.config.settings?.datasetteApiToken &&
                  <p style={{ color: 'orange' }}>
                      {intl.formatMessage({
                          id: 'warning.datasetteTokenMissing',
                          defaultMessage: 'Warning: Datasette provider is configured but the optional API Token is not set. Operations requiring authentication may fail.'
                      })}
                  </p>}
              {/* General configuration warning */}
              {api.config.providerType !== 'none' && !api.config.isConfigured &&
                  <p style={{ color: 'red' }}>
                      {intl.formatMessage({
                          id: 'warning.providerNotConfigured',
                          defaultMessage: 'Warning: The selected API provider ({providerType}) is not fully configured. Please check Settings.'
                      }, { providerType: api.config.providerType })}
                  </p>
              }
               {/* Informational message if no provider is selected */}
               {api.config.providerType === 'none' &&
                  <p style={{ color: 'grey' }}>
                      {intl.formatMessage({ id: 'info.noProviderSelected', defaultMessage: 'No API provider selected. Please configure one in Settings.' })}
                  </p>
              }
          </div>
      </main>

      {/* Remove SettingsView modal rendering */}
    </div>
  );
}

export default App;
