import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Enregistrement du Service Worker pour les fonctionnalités PWA (cache offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker enregistré', reg.scope))
      .catch(err => console.warn('[PWA] Échec enregistrement SW :', err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
