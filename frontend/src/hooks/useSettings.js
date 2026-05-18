/**
 * useSettings.js — Lecture/écriture des réglages utilisateur via le Worker KV
 *
 * - Charge les réglages depuis GET /api/settings au montage
 * - Applique les changements en local immédiatement (UX réactive)
 * - Persiste dans Cloudflare KV avec un debounce de 600ms (évite le spam)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Réglages par défaut (miroir du Worker — utilisés si le KV est vide)
const DEFAULT_SETTINGS = {
  liquidityMin:     10000,
  ageMax:           30,
  uniqueWalletsMin: 20,
  soundEnabled:     false,
  scoreMin:         75,
};

const DEBOUNCE_MS = 600;

/**
 * @param {string} workerUrl
 * @returns {{ settings: object, updateSetting: Function, isLoading: boolean }}
 */
export function useSettings(workerUrl) {
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Timer de debounce pour la sauvegarde KV
  const saveTimer = useRef(null);
  // Dernière version des settings à sauvegarder
  const pendingSave = useRef(null);

  // ── Chargement initial depuis le KV ────────────────────────
  useEffect(() => {
    if (!workerUrl) { setIsLoading(false); return; }

    fetch(`${workerUrl}/api/settings`)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setSettings(prev => ({ ...prev, ...data, scoreMin: 75 }));
        }
      })
      .catch(err => console.warn('[Settings] Chargement échoué :', err))
      .finally(() => setIsLoading(false));
  }, [workerUrl]);

  // ── Sauvegarde debouncée dans le KV ────────────────────────
  const persistSettings = useCallback((newSettings) => {
    clearTimeout(saveTimer.current);
    pendingSave.current = newSettings;

    saveTimer.current = setTimeout(async () => {
      if (!workerUrl || !pendingSave.current) return;
      try {
        await fetch(`${workerUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingSave.current),
        });
      } catch (err) {
        console.warn('[Settings] Sauvegarde échouée :', err);
      }
    }, DEBOUNCE_MS);
  }, [workerUrl]);

  // ── Mise à jour d'un réglage individuel ────────────────────
  const updateSetting = useCallback((key, value) => {
    // scoreMin est en lecture seule
    if (key === 'scoreMin') return;

    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      persistSettings(updated);
      return updated;
    });
  }, [persistSettings]);

  // Nettoyage du timer au démontage
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return { settings, updateSetting, isLoading };
}
