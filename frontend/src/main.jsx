import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ApiProvider } from './api/ApiContext.jsx';
import { TranslationProvider } from './translations/TranslationContext.jsx'; // Import TranslationProvider
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* TranslationProvider should wrap ApiProvider if API responses might need translation */}
    {/* Or if components using useApi need access to useTranslationContext */}
    <TranslationProvider>
      <ApiProvider>
        <App />
      </ApiProvider>
    </TranslationProvider>
  </React.StrictMode>,
)
