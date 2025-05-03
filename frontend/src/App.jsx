import React, { useState } from 'react';
import { useIntl } from 'react-intl'; // Import useIntl hook
import { useApi } from './api/ApiContext'; // Import the custom hook
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'; // Import react-router-dom components
// Import the view components
import ItemsView from './components/ItemsView';
import LocationsView from './components/LocationsView';
import CategoriesView from './components/CategoriesView';
import OwnersView from './components/OwnersView';
import SettingsView from './components/SettingsView'; // Settings is now a view
import ConfigureFromUrl from './components/ConfigureFromUrl'; // Import new component
import ExportConfigurationLink from './components/ExportConfigurationLink'; // Import new component
import './App.css';
// Consider adding a new CSS file for navigation styles if needed

function App() {
  // Remove loading, error, success state - moved to ItemsView
  const intl = useIntl(); // Get intl object
  // Remove isSettingsOpen state

  // Remove activeView state - routing handles this now
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
          case 'owners':
              return <OwnersView />;
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
    // Wrap the entire app structure in BrowserRouter
    <BrowserRouter>
    <div className="App">
      <header className="App-header">
        <h1>{intl.formatMessage({ id: 'app.title', defaultMessage: 'Inventory Management' })}</h1>
        {/* Hamburger button - shown only on small screens via CSS */}
        <button
            className="hamburger-button"
            onClick={toggleMobileMenu}
            aria-label={intl.formatMessage({ id: 'nav.toggleMobileMenu', defaultMessage: 'Toggle navigation menu' })} // Add aria-label
        >
            ☰ {/* Simple hamburger icon */}
        </button>
        {/* Simple Navigation - hidden on small screens via CSS */}
        <nav className="app-nav">
            {/* Use NavLink for declarative navigation and active styling */}
            <NavLink to="/items" className={({ isActive }) => isActive ? 'active' : ''}>
                {intl.formatMessage({ id: 'nav.items', defaultMessage: 'Items' })}
            </NavLink>
            <NavLink to="/locations" className={({ isActive }) => isActive ? 'active' : ''}>
                {intl.formatMessage({ id: 'nav.locations', defaultMessage: 'Locations' })}
            </NavLink>
            <NavLink to="/categories" className={({ isActive }) => isActive ? 'active' : ''}>
                {intl.formatMessage({ id: 'nav.categories', defaultMessage: 'Categories' })}
            </NavLink>
            <NavLink to="/owners" className={({ isActive }) => isActive ? 'active' : ''}>
                {intl.formatMessage({ id: 'nav.owners', defaultMessage: 'Owners' })}
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
                {intl.formatMessage({ id: 'nav.settings', defaultMessage: 'Settings' })}
            </NavLink>
        </nav>
      </header>
      {/* Mobile Menu Overlay - shown when isMobileMenuOpen is true */}
      {isMobileMenuOpen && (
          <div className="mobile-menu-overlay">
              <button
                  className="close-menu-button"
                  onClick={toggleMobileMenu}
                  aria-label={intl.formatMessage({ id: 'nav.closeMobileMenu', defaultMessage: 'Close navigation menu' })} // Add aria-label
              >
                  &times; {/* Simple close icon */}
              </button>
              <nav className="mobile-nav">
                  {/* Use NavLink here as well. Add onClick just to close the menu */}
                  <NavLink
                      to="/items"
                      className={({ isActive }) => isActive ? 'active' : ''}
                      onClick={() => setIsMobileMenuOpen(false)} // Close menu on click
                  >
                      {intl.formatMessage({ id: 'nav.items', defaultMessage: 'Items' })}
                  </NavLink>
                  <NavLink
                      to="/locations"
                      className={({ isActive }) => isActive ? 'active' : ''}
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                      {intl.formatMessage({ id: 'nav.locations', defaultMessage: 'Locations' })}
                  </NavLink>
                  <NavLink
                      to="/categories"
                      className={({ isActive }) => isActive ? 'active' : ''}
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                      {intl.formatMessage({ id: 'nav.categories', defaultMessage: 'Categories' })}
                  </NavLink>
                  <NavLink
                      to="/owners"
                      className={({ isActive }) => isActive ? 'active' : ''}
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                      {intl.formatMessage({ id: 'nav.owners', defaultMessage: 'Owners' })}
                  </NavLink>
                  <NavLink
                      to="/settings"
                      className={({ isActive }) => isActive ? 'active' : ''}
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                      {intl.formatMessage({ id: 'nav.settings', defaultMessage: 'Settings' })}
                  </NavLink>
              </nav>
          </div>
      )}
      <main className="app-main-content" style={{ padding: '20px' }}>
          {/* Define the routes */}
          <Routes>
              {/* Redirect root path to /items */}
              <Route path="/" element={<Navigate to="/items" replace />} />
              <Route path="/items" element={<ItemsView />} />
              <Route path="/locations" element={<LocationsView />} />
              <Route path="/categories" element={<CategoriesView />} />
              <Route path="/owners" element={<OwnersView />} />
              <Route path="/settings" element={
                  <SettingsView
                      currentConfig={api.config}
                      onSave={api.updateConfiguration}
                  />
              } />
              <Route path="/configure" element={<ConfigureFromUrl />} />
              <Route path="/export-configuration" element={<ExportConfigurationLink />} />
              {/* Optional: Add a catch-all 404 route */}
              {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
          </Routes>

          {/* Keep Global Warnings Here */}
          <div className="global-warnings" style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
              {/* Update Datasette token warning */}
              {api.config.providerType === 'datasette' && api.config.isConfigured && !api.config.settings?.datasetteApiToken &&
                  /* Use status-warning class instead of inline style */
                  <p className="status-warning">
                      {intl.formatMessage({
                          id: 'warning.datasetteTokenMissing',
                          defaultMessage: 'Warning: Datasette provider is configured but the optional API Token is not set. Operations requiring authentication may fail.'
                      })}
                  </p>}
              {/* General configuration warning */}
              {api.config.providerType !== 'none' && !api.config.isConfigured &&
                  /* Use status-error class instead of inline style */
                  <p className="status-error">
                      {intl.formatMessage({
                          id: 'warning.providerNotConfigured',
                          defaultMessage: 'Warning: The selected API provider ({providerType}) is not fully configured. Please check Settings.'
                      }, { providerType: api.config.providerType })}
                  </p>
              }
               {/* Informational message if no provider is selected */}
               {api.config.providerType === 'none' &&
                  /* Use status-loading class (or create a status-info) instead of inline style */
                  <p className="status-loading"> {/* Using loading style for info, adjust if needed */}
                      {intl.formatMessage({ id: 'info.noProviderSelected', defaultMessage: 'No API provider selected. Please configure one in Settings.' })}
                  </p>
              }
          </div>
      </main>

      {/* Remove SettingsView modal rendering */}
      </div>
    </BrowserRouter>
  );
}

export default App;
