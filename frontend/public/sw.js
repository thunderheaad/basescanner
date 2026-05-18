/**
 * sw.js — Service Worker PWA BaseScan
 *
 * Stratégie :
 *   - Assets statiques (JS, CSS, fonts) : Cache First → réponse rapide hors ligne
 *   - Appels API Worker (/api/*) : Network First → données fraîches, fallback cache
 *   - Autres requêtes : Network First avec fallback sur la page d'accueil (SPA)
 */

const CACHE_NAME     = 'basescan-v1';
const API_CACHE_NAME = 'basescan-api-v1';

// Assets à mettre en cache immédiatement lors de l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─────────────────────────────────────────────────────────────
// Installation : pré-cache des assets critiques
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────────────
// Activation : nettoyage des anciens caches
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────
// Interception des requêtes
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions navigateur
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ── Appels API Worker → Network First ──────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE_NAME, 30));
    return;
  }

  // ── Polices Google Fonts → Cache First (TTL long) ──────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // ── Assets statiques Vite (JS/CSS avec hash) → Cache First ─
  if (url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // ── Navigation SPA → Network First, fallback index.html ────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
});

// ─────────────────────────────────────────────────────────────
// Helpers de stratégies de cache
// ─────────────────────────────────────────────────────────────

/** Network First : essaie le réseau, utilise le cache en cas d'échec */
async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cloner avant de mettre en cache (stream ne peut être lu qu'une fois)
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Réseau indisponible → retour sur le cache
    const cached = await cache.match(request);
    if (cached) return cached;
    // Aucune réponse disponible
    return new Response(JSON.stringify({ error: 'Hors ligne — données indisponibles' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Cache First : sert depuis le cache, sinon fait la requête réseau */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Ressource indisponible hors ligne', { status: 503 });
  }
}
