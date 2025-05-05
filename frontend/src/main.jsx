import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ApiProvider } from "./api/ApiContext.jsx";
import { TranslationProvider } from "./translations/TranslationContext.jsx"; // Import TranslationProvider
import { SettingsProvider } from "./settings/SettingsContext.jsx"; // Import SettingsProvider
import "./main.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SettingsProvider> {/* SettingsProvider is outermost */}
      {/* Wrap everything with SettingsProvider */}
      <TranslationProvider>
        <ApiProvider>
          <App />
        </ApiProvider>
      </TranslationProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
