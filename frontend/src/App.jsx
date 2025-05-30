import React, { useState } from "react";
import { useIntl } from "react-intl";
import { useApi } from "./api/ApiContext";
import { useSettings } from "./settings/SettingsContext";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import ItemsView from "./components/ItemsView";
import LocationsView from "./components/LocationsView";
import CategoriesView from "./components/CategoriesView";
import OwnersView from "./components/OwnersView";
import SettingsView from "./components/SettingsView";
import ConfigureFromUrlView from "./components/ConfigureFromUrlView";
import ShareConfigurationLinkView from "./components/ShareConfigurationLinkView";
import MigrateView from "./components/MigrateView";
import "./App.css";

function App() {
  const intl = useIntl();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const api = useApi();
  const { settings } = useSettings();

  const warn = api.isVersionMismatch
    ? intl.formatMessage(
        {
          id: "app.warn.versionMismatch",
          defaultMessage:
            "Schema version mismatch (DB v{dbVersion} vs App v{appVersion}). Writes disabled until you migrate."
        },
        { dbVersion: api.dbVersion, appVersion: api.appMajor }
      )
    : "";

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileNavClick = (view) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "items":
        return <ItemsView />;
      case "locations":
        return <LocationsView />;
      case "categories":
        return <CategoriesView />;
      case "owners":
        return <OwnersView />;
      case "settings":
        // Pass props needed by SettingsView
        return (
          <SettingsView
            currentConfig={api.config}
            onSave={api.updateConfiguration}
          />
        );
      default:
        return <ItemsView />; // Default to items view
    }
  };

  // Use VITE_BASE_URL from environment variables, defaulting to "/" if not set
  const baseUrl = import.meta.env.VITE_BASE_URL || "/";

  return (
    <BrowserRouter basename={baseUrl}>
      {warn && (
        <div className="status-warning">
          <NavLink to="/migrate" className="migrate-link">
            {warn}
          </NavLink>
        </div>
      )}
      <div className="app">
        <header className="app-header">
          <h1>
            {intl.formatMessage({
              id: "app.title",
              defaultMessage: "Inventory Management",
            })}
          </h1>
          {/* Hamburger button - shown only on small screens via CSS */}
          <button
            className="hamburger-button"
            onClick={toggleMobileMenu}
            aria-label={intl.formatMessage({
              id: "nav.toggleMobileMenu",
              defaultMessage: "Toggle navigation menu",
            })}
          >
            ☰
          </button>
          <nav className="app-nav">
            <NavLink
              to="/items"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {intl.formatMessage({ id: "nav.items", defaultMessage: "Items" })}
            </NavLink>
            <NavLink
              to="/locations"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {intl.formatMessage({
                id: "nav.locations",
                defaultMessage: "Locations",
              })}
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {intl.formatMessage({
                id: "nav.categories",
                defaultMessage: "Categories",
              })}
            </NavLink>
            <NavLink
              to="/owners"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {intl.formatMessage({
                id: "nav.owners",
                defaultMessage: "Owners",
              })}
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {intl.formatMessage({
                id: "nav.settings",
                defaultMessage: "Settings",
              })}
            </NavLink>
          </nav>
        </header>
        {/* Mobile Menu Overlay - shown when isMobileMenuOpen is true */}
        {isMobileMenuOpen && (
          <div className="mobile-menu-overlay">
            <button
              className="close-menu-button"
              onClick={toggleMobileMenu}
              aria-label={intl.formatMessage({
                id: "nav.closeMobileMenu",
                defaultMessage: "Close navigation menu",
              })}
            >
              &times;
            </button>
            <nav className="mobile-nav">
              <NavLink
                to="/items"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {intl.formatMessage({
                  id: "nav.items",
                  defaultMessage: "Items",
                })}
              </NavLink>
              <NavLink
                to="/locations"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {intl.formatMessage({
                  id: "nav.locations",
                  defaultMessage: "Locations",
                })}
              </NavLink>
              <NavLink
                to="/categories"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {intl.formatMessage({
                  id: "nav.categories",
                  defaultMessage: "Categories",
                })}
              </NavLink>
              <NavLink
                to="/owners"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {intl.formatMessage({
                  id: "nav.owners",
                  defaultMessage: "Owners",
                })}
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {intl.formatMessage({
                  id: "nav.settings",
                  defaultMessage: "Settings",
                })}
              </NavLink>
            </nav>
          </div>
        )}
        <main className="app-main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/items" replace />} />
            <Route path="/items" element={<ItemsView />} />
            <Route path="/locations" element={<LocationsView />} />
            <Route path="/categories" element={<CategoriesView />} />
            <Route path="/owners" element={<OwnersView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/configure" element={<ConfigureFromUrlView />} />
            <Route
              path="/share-configuration"
              element={<ShareConfigurationLinkView />}
            />
            <Route path="/migrate" element={<MigrateView />} />
          </Routes>
          <div
            className="global-warnings"
            style={{
              marginTop: "20px",
              borderTop: "1px solid #ccc",
              paddingTop: "10px",
            }}
          >
            {settings.apiProviderType !== "none" && !api.isConfigured && (
              <p className="status-error">
                {" "}
                {intl.formatMessage(
                  {
                    id: "warning.providerNotConfigured",
                    defaultMessage:
                      "Warning: The selected API provider ({providerType}) is not fully configured. Please check Settings.",
                  },
                  { providerType: settings.apiProviderType },
                )}
              </p>
            )}
            {/* Informational message if no provider is selected - Use status-loading (info style) */}
            {settings.apiProviderType === "none" && (
              <p className="status-loading">
                {" "}
                {intl.formatMessage({
                  id: "info.noProviderSelected",
                  defaultMessage:
                    "No API provider selected. Please configure one in Settings.",
                })}
              </p>
            )}
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
