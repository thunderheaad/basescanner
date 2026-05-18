/**
 * kv.js — Helpers de lecture/écriture Cloudflare KV
 *
 * Clés utilisées dans le namespace KV :
 *   "tokens"      → tableau JSON des 50 derniers tokens validés (score ≥ 75)
 *   "scan_stats"  → statistiques du scanner (total scannés/filtrés, dernière date)
 *   "settings"    → réglages utilisateur (liquidité min, âge max, etc.)
 *   "watchlist"   → tokens ajoutés manuellement par l'utilisateur
 *   "seen_tokens" → cache des adresses déjà analysées (évite les doublons)
 */

// Réglages par défaut appliqués si aucun réglage n'est sauvegardé
const DEFAULT_SETTINGS = {
  liquidityMin: 10000,    // Liquidité minimum en USD ($10k)
  ageMax: 30,             // Âge maximum de la paire en minutes
  uniqueWalletsMin: 20,   // Nombre minimum de wallets uniques (holders)
  soundEnabled: false,    // Son de notification désactivé par défaut
  scoreMin: 75,           // Score minimum — fixé, non modifiable par l'utilisateur
};

// ─────────────────────────────────────────────────────────────
// TOKENS VALIDÉS
// ─────────────────────────────────────────────────────────────

/**
 * Récupère les derniers tokens validés depuis KV.
 * @param {KVNamespace} kv
 * @returns {Promise<Array>}
 */
export async function getTokens(kv) {
  const raw = await kv.get('tokens');
  return raw ? JSON.parse(raw) : [];
}

/**
 * Sauvegarde la liste de tokens validés dans KV.
 * @param {KVNamespace} kv
 * @param {Array} tokens
 */
export async function setTokens(kv, tokens) {
  await kv.put('tokens', JSON.stringify(tokens));
}

// ─────────────────────────────────────────────────────────────
// STATISTIQUES DE SCAN
// ─────────────────────────────────────────────────────────────

/**
 * Récupère les statistiques de scan depuis KV.
 * @param {KVNamespace} kv
 * @returns {Promise<object>}
 */
export async function getScanStats(kv) {
  const raw = await kv.get('scan_stats');
  return raw
    ? JSON.parse(raw)
    : { totalScanned: 0, totalFiltered: 0, lastScanAt: null, lastError: null };
}

/**
 * Met à jour les statistiques de scan dans KV.
 * @param {KVNamespace} kv
 * @param {object} stats
 */
export async function setScanStats(kv, stats) {
  await kv.put('scan_stats', JSON.stringify(stats));
}

// ─────────────────────────────────────────────────────────────
// RÉGLAGES UTILISATEUR
// ─────────────────────────────────────────────────────────────

/**
 * Récupère les réglages utilisateur depuis KV.
 * Les réglages manquants sont remplacés par les valeurs par défaut.
 * @param {KVNamespace} kv
 * @returns {Promise<object>}
 */
export async function getSettings(kv) {
  const raw = await kv.get('settings');
  const saved = raw ? JSON.parse(raw) : {};
  // Fusion avec les valeurs par défaut pour gérer les nouveaux réglages ajoutés plus tard
  return { ...DEFAULT_SETTINGS, ...saved, scoreMin: 75 };
}

/**
 * Sauvegarde les réglages utilisateur dans KV.
 * Le scoreMin est toujours forcé à 75 (non modifiable).
 * @param {KVNamespace} kv
 * @param {object} settings
 */
export async function setSettings(kv, settings) {
  const toSave = { ...settings, scoreMin: 75 };
  await kv.put('settings', JSON.stringify(toSave));
}

// ─────────────────────────────────────────────────────────────
// WATCHLIST
// ─────────────────────────────────────────────────────────────

/**
 * Récupère la watchlist depuis KV.
 * @param {KVNamespace} kv
 * @returns {Promise<Array>}
 */
export async function getWatchlist(kv) {
  const raw = await kv.get('watchlist');
  return raw ? JSON.parse(raw) : [];
}

/**
 * Ajoute un token à la watchlist si il n'y est pas déjà.
 * @param {KVNamespace} kv
 * @param {object} token — Au minimum { address, name, symbol, score }
 */
export async function addToWatchlist(kv, token) {
  const watchlist = await getWatchlist(kv);

  const address = token.address?.toLowerCase();
  if (!address) return;

  // Ne pas ajouter si déjà présent
  if (watchlist.some(t => t.address === address)) return;

  watchlist.unshift({
    ...token,
    address,
    addedAt: Date.now(),
  });

  await kv.put('watchlist', JSON.stringify(watchlist));
}

/**
 * Supprime un token de la watchlist par son adresse.
 * @param {KVNamespace} kv
 * @param {string} address
 */
export async function removeFromWatchlist(kv, address) {
  const watchlist = await getWatchlist(kv);
  const filtered = watchlist.filter(
    t => t.address !== address.toLowerCase()
  );
  await kv.put('watchlist', JSON.stringify(filtered));
}

// ─────────────────────────────────────────────────────────────
// CACHE DES TOKENS DÉJÀ VUS
// ─────────────────────────────────────────────────────────────

/**
 * Récupère le cache des tokens déjà analysés.
 * Structure : { "0x...": timestamp, ... }
 * @param {KVNamespace} kv
 * @returns {Promise<object>}
 */
export async function getSeenTokens(kv) {
  const raw = await kv.get('seen_tokens');
  return raw ? JSON.parse(raw) : {};
}

/**
 * Sauvegarde le cache en supprimant les entrées expirées (> TTL).
 * @param {KVNamespace} kv
 * @param {object} seen   — { address: timestamp }
 * @param {number} ttlMs  — Durée de vie du cache en millisecondes
 */
export async function setSeenTokens(kv, seen, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const cleaned = {};
  for (const [addr, time] of Object.entries(seen)) {
    if (now - time < ttlMs) cleaned[addr] = time;
  }
  await kv.put('seen_tokens', JSON.stringify(cleaned));
}

// ─────────────────────────────────────────────────────────────
// TOKENS REJETÉS
// Clé KV : "rejected_tokens" — tableau des 50 derniers refusés
// ─────────────────────────────────────────────────────────────

/**
 * Récupère les tokens rejetés depuis KV.
 * @param {KVNamespace} kv
 * @returns {Promise<Array>}
 */
export async function getRejectedTokens(kv) {
  const raw = await kv.get('rejected_tokens');
  return raw ? JSON.parse(raw) : [];
}

/**
 * Ajoute un token rejeté dans KV (max 50, sans doublons).
 * @param {KVNamespace} kv
 * @param {object} token — { address, name, symbol, score, reason, details, rejectedAt, ... }
 */
export async function addRejectedToken(kv, token) {
  const rejected = await getRejectedTokens(kv);

  const address = token.address?.toLowerCase();
  if (!address) return;

  // Ne pas dupliquer si déjà présent
  if (rejected.some(t => t.address === address)) return;

  rejected.unshift({ ...token, address });

  // Garder seulement les 50 derniers
  await kv.put('rejected_tokens', JSON.stringify(rejected.slice(0, 50)));
}
