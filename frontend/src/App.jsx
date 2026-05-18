import { useState, useEffect, useCallback } from 'react';
import Scanner from './components/Scanner.jsx';
import Watchlist from './components/Watchlist.jsx';
import Settings from './components/Settings.jsx';
import { useSettings } from './hooks/useSettings.js';

// URL du Cloudflare Worker — définie dans les variables d'environnement Vercel
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

export default function App() {
  const [activeTab, setActiveTab]   = useState('scanner');
  const [watchlist, setWatchlist]   = useState([]);
  const [wlLoading, setWlLoading]   = useState(true);

  const { settings, updateSetting } = useSettings(WORKER_URL);

  // ── Chargement initial de la watchlist ──────────────────────
  useEffect(() => {
    if (!WORKER_URL) { setWlLoading(false); return; }

    fetch(`${WORKER_URL}/api/watchlist`)
      .then(r => r.json())
      .then(data => {
        setWatchlist(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('[Watchlist] Chargement échoué :', err))
      .finally(() => setWlLoading(false));
  }, []);

  // ── Ajouter un token à la watchlist ─────────────────────────
  const handleAddToWatchlist = useCallback(async (token) => {
    // Vérification locale immédiate (évite le doublon avant la réponse serveur)
    if (watchlist.some(t => t.address === token.address)) return;

    const entry = { ...token, addedAt: Date.now() };
    setWatchlist(prev => [entry, ...prev]);

    try {
      await fetch(`${WORKER_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token),
      });
    } catch (err) {
      console.error('[Watchlist] Ajout échoué :', err);
      // Rollback en cas d'erreur réseau
      setWatchlist(prev => prev.filter(t => t.address !== token.address));
    }
  }, [watchlist]);

  // ── Supprimer un token de la watchlist ──────────────────────
  const handleRemoveFromWatchlist = useCallback(async (address) => {
    setWatchlist(prev => prev.filter(t => t.address !== address));

    try {
      await fetch(`${WORKER_URL}/api/watchlist/${address}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[Watchlist] Suppression échouée :', err);
    }
  }, []);

  // ── Vérifier si un token est déjà en watchlist ──────────────
  const isInWatchlist = useCallback(
    (address) => watchlist.some(t => t.address === address),
    [watchlist]
  );

  return (
    <div className="app">
      {/* Contenu de l'onglet actif */}
      <div className="tab-content">
        {activeTab === 'scanner' && (
          <Scanner
            workerUrl={WORKER_URL}
            settings={settings}
            onAddToWatchlist={handleAddToWatchlist}
            isInWatchlist={isInWatchlist}
          />
        )}
        {activeTab === 'watchlist' && (
          <Watchlist
            watchlist={watchlist}
            loading={wlLoading}
            onRemove={handleRemoveFromWatchlist}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdate={updateSetting}
          />
        )}
      </div>

      {/* Barre de navigation fixe en bas */}
      <nav className="tab-nav" role="navigation" aria-label="Navigation principale">
        <button
          className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
          aria-label="Scanner"
          aria-current={activeTab === 'scanner' ? 'page' : undefined}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-label">Scanner</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('watchlist')}
          aria-label={`Watchlist${watchlist.length ? ` — ${watchlist.length} tokens` : ''}`}
          aria-current={activeTab === 'watchlist' ? 'page' : undefined}
        >
          <span className="tab-icon">👁</span>
          <span className="tab-label">Watchlist</span>
          {watchlist.length > 0 && (
            <span className="tab-badge" aria-hidden="true">
              {watchlist.length > 99 ? '99+' : watchlist.length}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          aria-label="Réglages"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Réglages</span>
        </button>
      </nav>
    </div>
  );
}
