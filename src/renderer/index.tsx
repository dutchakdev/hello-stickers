import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../components/App';
import '../styles/globals.css';

// Check if the electron API is exposed
console.log('Electron API available:', window.electron !== undefined);

// Create root element
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 