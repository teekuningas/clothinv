import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ApiProvider } from "./api/ApiContext.jsx";
import { TranslationProvider } from "./translations/TranslationContext.jsx";
import { SettingsProvider } from "./settings/SettingsContext.jsx";
import "./main.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <SettingsProvider>
    <TranslationProvider>
      <ApiProvider>
        <App />
      </ApiProvider>
    </TranslationProvider>
  </SettingsProvider>,
);
