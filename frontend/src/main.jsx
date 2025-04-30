import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ApiProvider } from './api/ApiContext.jsx'; // Import the provider
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ApiProvider> {/* Wrap App with ApiProvider */}
      <App />
    </ApiProvider>
  </React.StrictMode>,
)
