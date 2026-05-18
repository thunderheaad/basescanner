/**
 * index.js — Point d'entrée du Cloudflare Worker
 *
 * Expose une API REST consommée par le frontend React (PWA Vercel).
 * Gère également le déclencheur cron pour lancer les scans automatiques.
 *
 * Routes :
 *   GET  /api/tokens           → Derniers tokens validés + stats
 *   GET  /api/settings         → Réglages utilisateur
 *   POST /api/settings         → Met à jour les réglages
 *   GET  /api/watchlist        → Watchlist de l'utilisateur
 *   POST /api/watchlist        → Ajoute un token à la watchlist
 *   DELETE /api/watchlist/:addr → Retire un token de la watchlist
 *   POST /api/scan             → Déclenche un scan manuel (debug)
 *   GET  /api/health           → Vérifie que le Worker tourne
 */

import { runScan } from './scanner.js';
import {
  getTokens,
  getScanStats,
  getSettings,
  setSettings,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from './kv.js';

// ─────────────────────────────────────────────────────────────
// CORS — autorise toutes les origines (nécessaire pour le frontend Vercel)
// En production, remplace '*' par ton URL Vercel exacte si tu veux restreindre.
// ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Retourne une réponse JSON avec les headers CORS.
 * @param {*} data
 * @param {number} status
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Retourne une réponse d'erreur JSON.
 * @param {string} message
 * @param {number} status
 */
function error(message, status = 500) {
  return json({ error: message }, status);
}

// ─────────────────────────────────────────────────────────────
// GESTIONNAIRE DES REQUÊTES HTTP
// ─────────────────────────────────────────────────────────────

async function handleRequest(request, env, ctx) {
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method;

  // Préflight CORS (OPTIONS)
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {

    // ── GET /api/health ───────────────────────────────────────────
    if (path === '/api/health' && method === 'GET') {
      return json({ status: 'ok', ts: Date.now() });
    }

    // ── GET /api/tokens ───────────────────────────────────────────
    // Renvoie les tokens validés + statistiques de scan
    if (path === '/api/tokens' && method === 'GET') {
      const [tokens, stats] = await Promise.all([
        getTokens(env.KV),
        getScanStats(env.KV),
      ]);
      return json({ tokens, stats });
    }

    // ── GET /api/settings ─────────────────────────────────────────
    if (path === '/api/settings' && method === 'GET') {
      const settings = await getSettings(env.KV);
      return json(settings);
    }

    // ── POST /api/settings ────────────────────────────────────────
    if (path === '/api/settings' && method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return error('Corps JSON invalide', 400);
      }
      await setSettings(env.KV, body);
      return json({ success: true });
    }

    // ── GET /api/watchlist ────────────────────────────────────────
    if (path === '/api/watchlist' && method === 'GET') {
      const watchlist = await getWatchlist(env.KV);
      return json(watchlist);
    }

    // ── POST /api/watchlist ───────────────────────────────────────
    if (path === '/api/watchlist' && method === 'POST') {
      const token = await request.json().catch(() => null);
      if (!token?.address) return error('Adresse manquante', 400);
      await addToWatchlist(env.KV, token);
      return json({ success: true });
    }

    // ── DELETE /api/watchlist/:address ────────────────────────────
    const deleteMatch = path.match(/^\/api\/watchlist\/(.+)$/);
    if (deleteMatch && method === 'DELETE') {
      const address = deleteMatch[1];
      await removeFromWatchlist(env.KV, address);
      return json({ success: true });
    }

    // ── POST /api/scan ────────────────────────────────────────────
    // Déclenche un scan immédiat (utile pendant le développement)
    if (path === '/api/scan' && method === 'POST') {
      ctx.waitUntil(runScan(env));
      return json({ message: 'Scan déclenché en arrière-plan' });
    }

    // ── Route inconnue ────────────────────────────────────────────
    return error('Route introuvable', 404);

  } catch (err) {
    console.error('[Worker] Erreur non gérée :', err.message);
    return error('Erreur serveur interne');
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT DEFAULT — format ES Module requis par Cloudflare Workers
// ─────────────────────────────────────────────────────────────

export default {
  /**
   * Gère toutes les requêtes HTTP entrantes vers le Worker.
   */
  fetch: handleRequest,

  /**
   * Gère le déclencheur cron (toutes les minutes selon wrangler.toml).
   *
   * Astuce 30 secondes :
   *   Le cron minimum Cloudflare est 1 minute. En lançant un 2ème scan
   *   30s après le premier via ctx.waitUntil + setTimeout, on obtient
   *   effectivement 2 scans par minute = un scan toutes les 30 secondes.
   *
   *   Note : le Worker reste "vivant" grâce à ctx.waitUntil même après
   *   le retour de la fonction scheduled(). Le budget CPU reste faible
   *   car le temps est presque entièrement passé à attendre les I/O.
   */
  async scheduled(event, env, ctx) {
    console.log('[Cron] Déclenchement scan —', new Date().toISOString());

    // Scan 1 : immédiat
    ctx.waitUntil(runScan(env));

    // Scan 2 : 30 secondes plus tard
    ctx.waitUntil(
      new Promise(resolve => setTimeout(resolve, 30_000))
        .then(() => {
          console.log('[Cron] Scan secondaire (+30s) —', new Date().toISOString());
          return runScan(env);
        })
    );
  },
};
