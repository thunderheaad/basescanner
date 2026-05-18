/**
 * useScanner.js — Hook de polling du Cloudflare Worker
 *
 * - Interroge GET /api/tokens toutes les 30 secondes
 * - Détecte les nouveaux tokens (pour l'animation flash + son)
 * - Joue un bip via Web Audio API si soundEnabled = true
 * - Gère les erreurs réseau sans crasher l'UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 30_000; // 30 secondes

/**
 * Génère un bip de notification via Web Audio API.
 * Pas de fichier audio requis — synthèse directe dans le navigateur.
 */
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx  = new AudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Deux bips courts (do-mi) — discrets et reconnaissables
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);        // Do
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // Mi

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);

    // Fermeture du contexte audio après le son pour libérer la ressource
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Certains navigateurs bloquent l'audio sans interaction utilisateur préalable
  }
}

/**
 * Hook principal du scanner.
 *
 * @param {string}  workerUrl      — URL du Cloudflare Worker
 * @param {object}  settings       — Réglages utilisateur (pour filtrage côté frontend)
 * @param {boolean} soundEnabled   — Activer le son de notification
 *
 * @returns {{
 *   tokens: Array,
 *   stats: object,
 *   newAddresses: Set,
 *   isLoading: boolean,
 *   error: string|null,
 *   lastPollAt: number|null,
 *   refresh: Function,
 * }}
 */
export function useScanner(workerUrl, settings, soundEnabled) {
  const [tokens,       setTokens]      = useState([]);
  const [stats,        setStats]       = useState(null);
  const [newAddresses, setNewAddresses] = useState(new Set());
  const [isLoading,    setIsLoading]   = useState(true);
  const [error,        setError]       = useState(null);
  const [lastPollAt,   setLastPollAt]  = useState(null);

  // Ensemble des adresses déjà connues (pour détecter les nouvelles)
  const knownAddresses = useRef(new Set());
  // Indique si c'est le tout premier chargement (pas de notification au démarrage)
  const isFirstLoad    = useRef(true);
  const pollTimer      = useRef(null);

  const fetchTokens = useCallback(async () => {
    if (!workerUrl) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${workerUrl}/api/tokens`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const incoming = Array.isArray(data.tokens) ? data.tokens : [];

      // Détection des nouveaux tokens
      const freshAddresses = new Set();
      for (const token of incoming) {
        if (!knownAddresses.current.has(token.address)) {
          freshAddresses.add(token.address);
          knownAddresses.current.add(token.address);
        }
      }

      // Mettre à jour la liste complète
      setTokens(incoming);
      if (data.stats) setStats(data.stats);
      setLastPollAt(Date.now());
      setError(null);

      // Notifications seulement après le premier chargement
      if (!isFirstLoad.current && freshAddresses.size > 0) {
        setNewAddresses(freshAddresses);
        if (soundEnabled) playNotificationSound();

        // Effacer le marqueur "nouveau" après l'animation (3s)
        setTimeout(() => setNewAddresses(new Set()), 3000);
      }

      isFirstLoad.current = false;

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [workerUrl, soundEnabled]);

  // ── Polling toutes les 30 secondes ──────────────────────────
  useEffect(() => {
    fetchTokens(); // Premier appel immédiat

    pollTimer.current = setInterval(fetchTokens, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollTimer.current);
    };
  }, [fetchTokens]);

  return {
    tokens,
    stats,
    newAddresses,
    isLoading,
    error,
    lastPollAt,
    refresh: fetchTokens,
  };
}
