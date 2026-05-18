/**
 * scanner.js — Récupération des nouveaux tokens sur Base Chain via DexScreener
 *
 * Stratégie d'appel DexScreener (API publique, sans clé) :
 *   1. GET /token-profiles/latest/v1    → 30 derniers tokens profilés toutes chaînes
 *   2. Filtre chainId === "base"
 *   3. GET /latest/dex/tokens/{adresses} → données de trading (liquidité, volume, âge…)
 *   4. Dédoublonnage via le cache KV "seen_tokens" (TTL 5 min)
 *
 * Limites DexScreener free tier : ~300 req/min → très largement suffisant ici.
 */

import { getSeenTokens, setSeenTokens, addRejectedToken } from './kv.js';
import { analyzeToken } from './scorer.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const SEEN_TTL_MS      = 5 * 60 * 1000;   // 5 minutes de cache anti-doublon
const MAX_TOKEN_AGE_MIN = 120;             // Ignorer les paires de plus de 2h
const MIN_LIQUIDITY_USD = 500;             // Filtrage très bas côté Worker (le frontend filtre plus)
const FETCH_TIMEOUT_MS  = 10000;           // Timeout sur les appels DexScreener

/**
 * Fetch avec timeout intégré.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout fetch: ${url}`)), timeoutMs)
  );
  return Promise.race([fetch(url, { headers: { Accept: 'application/json' } }), timeout]);
}

/**
 * Récupère les profils des derniers tokens listés sur DexScreener (toutes chaînes).
 * Retourne uniquement les tokens sur Base Chain.
 * @returns {Promise<Array<{tokenAddress: string, icon: string|null}>>}
 */
async function fetchBaseTokenProfiles() {
  const res = await fetchWithTimeout(`${DEXSCREENER_BASE}/token-profiles/latest/v1`);
  if (!res.ok) throw new Error(`DexScreener profiles HTTP ${res.status}`);

  const profiles = await res.json();
  if (!Array.isArray(profiles)) return [];

  return profiles
    .filter(p => p.chainId === 'base' && p.tokenAddress)
    .map(p => ({
      tokenAddress: p.tokenAddress.toLowerCase(),
      icon: p.icon || null,
      description: p.description || null,
    }));
}

/**
 * Récupère les données de trading DexScreener pour une liste d'adresses.
 * DexScreener accepte jusqu'à 30 adresses par requête (séparées par des virgules).
 * @param {string[]} addresses
 * @returns {Promise<Array>}
 */
async function fetchPairsForAddresses(addresses) {
  if (addresses.length === 0) return [];

  // Batch de max 30 adresses
  const batched = addresses.slice(0, 30).join(',');
  const res = await fetchWithTimeout(`${DEXSCREENER_BASE}/latest/dex/tokens/${batched}`);
  if (!res.ok) throw new Error(`DexScreener tokens HTTP ${res.status}`);

  const data = await res.json();
  return Array.isArray(data.pairs) ? data.pairs : [];
}

/**
 * Sélectionne la meilleure paire pour un token (plus haute liquidité).
 * Un token peut avoir plusieurs paires (Uniswap V2, V3, Aerodrome…).
 * @param {Array} pairs
 * @param {string} tokenAddress
 * @returns {object|null}
 */
function selectBestPair(pairs, tokenAddress) {
  const tokenPairs = pairs.filter(
    p => p.chainId === 'base' &&
         p.baseToken?.address?.toLowerCase() === tokenAddress
  );

  if (tokenPairs.length === 0) return null;

  // On prend la paire avec la liquidité la plus élevée
  return tokenPairs.reduce((best, p) =>
    (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
  );
}

/**
 * Point d'entrée principal du scanner.
 * Récupère les nouveaux tokens Base, filtre les doublons, retourne la liste à analyser.
 *
 * @param {KVNamespace} kv
 * @returns {Promise<Array>} Tokens nouveaux (non encore vus) prêts pour l'analyse GoPlus
 */
export async function fetchNewTokens(kv) {
  const now = Date.now();

  // 1. Profils récents sur Base Chain
  const profiles = await fetchBaseTokenProfiles();
  if (profiles.length === 0) return [];

  // 2. Données de trading pour ces adresses
  const addresses = profiles.map(p => p.tokenAddress);
  const pairs = await fetchPairsForAddresses(addresses);

  // 3. Cache des tokens déjà traités
  const seenTokens = await getSeenTokens(kv);
  const newTokens  = [];

  for (const profile of profiles) {
    const addr = profile.tokenAddress;

    // Ignorer si analysé récemment
    if (seenTokens[addr] && (now - seenTokens[addr]) < SEEN_TTL_MS) continue;

    const bestPair = selectBestPair(pairs, addr);
    if (!bestPair) {
      // Token sans paire = trop récent ou hors DexScreener, on marque quand même comme vu
      seenTokens[addr] = now;
      continue;
    }

    const liquidityUsd = bestPair.liquidity?.usd || 0;
    if (liquidityUsd < MIN_LIQUIDITY_USD) {
      seenTokens[addr] = now;
      continue;
    }

    // Calcul de l'âge en minutes
    const pairCreatedAt = bestPair.pairCreatedAt || now;
    const ageMinutes    = Math.floor((now - pairCreatedAt) / 60000);

    // Ignorer les paires trop anciennes (on ne les a pas ratées au scan précédent)
    if (ageMinutes > MAX_TOKEN_AGE_MIN) {
      seenTokens[addr] = now;
      continue;
    }

    newTokens.push({
      address:      addr,
      name:         bestPair.baseToken?.name   || 'Unknown',
      symbol:       bestPair.baseToken?.symbol || '???',
      pairAddress:  bestPair.pairAddress,
      dexId:        bestPair.dexId || 'unknown',
      liquidityUsd,
      volumeH24:    bestPair.volume?.h24    || 0,
      volumeH6:     bestPair.volume?.h6     || 0,
      priceUsd:     bestPair.priceUsd        || '0',
      priceChange24h: bestPair.priceChange?.h24 || 0,
      pairCreatedAt,
      ageMinutes,
      txnsH24Buy:   bestPair.txns?.h24?.buys  || 0,
      txnsH24Sell:  bestPair.txns?.h24?.sells || 0,
      icon:         profile.icon,
      description:  profile.description,
    });

    // Marquer comme vu pour cette session
    seenTokens[addr] = now;
  }

  // 4. Sauvegarder le cache mis à jour
  await setSeenTokens(kv, seenTokens, SEEN_TTL_MS);

  return newTokens;
}

/**
 * Orchestre un cycle complet de scan :
 *   1. Récupère les nouveaux tokens
 *   2. Analyse chacun via GoPlus
 *   3. Conserve ceux avec score ≥ 75
 *   4. Met à jour KV (tokens validés + stats)
 *
 * @param {object} env — Environnement Cloudflare Worker (env.KV, env.GOPLUS_API_KEY)
 */
export async function runScan(env) {
  const kv        = env.KV;
  const goplusKey = env.GOPLUS_API_KEY || '';

  // Charger les stats actuelles
  const statsRaw = await kv.get('scan_stats');
  const stats = statsRaw
    ? JSON.parse(statsRaw)
    : { totalScanned: 0, totalFiltered: 0, lastScanAt: null, lastError: null };

  try {
    // ── Étape 1 : nouveaux tokens DexScreener ───────────────────────
    const newTokens = await fetchNewTokens(kv);
    stats.totalScanned += newTokens.length;

    if (newTokens.length === 0) {
      stats.lastScanAt = Date.now();
      await kv.put('scan_stats', JSON.stringify(stats));
      return;
    }

    // ── Étape 2 : charger la liste existante des tokens validés ─────
    const existingRaw = await kv.get('tokens');
    const existingTokens = existingRaw ? JSON.parse(existingRaw) : [];
    const existingAddresses = new Set(existingTokens.map(t => t.address));

    const newValidated = [];

    // ── Étape 3 : analyser chaque nouveau token via GoPlus ──────────
    for (const token of newTokens) {
      // Pas de doublons dans la liste validée
      if (existingAddresses.has(token.address)) continue;

      try {
        const analysis = await analyzeToken(token.address, goplusKey);

        if (!analysis.pass) {
          console.log(`[Scanner] Rejeté ${token.symbol} (${token.address.slice(0, 8)}…) — ${analysis.reason || `score ${analysis.score}`}`);

          // Persistance dans la clé KV "rejected_tokens" pour l'onglet Rejetés du frontend
          await addRejectedToken(kv, {
            ...token,
            score:       analysis.score,
            details:     analysis.details,
            holderCount: analysis.holderCount,
            reason:      analysis.reason || null,   // raison éliminatoire si applicable
            rejectedAt:  Date.now(),
          });
          continue;
        }

        // ✅ Token validé !
        const validated = {
          ...token,
          score:       analysis.score,
          details:     analysis.details,
          holderCount: analysis.holderCount,
          detectedAt:  Date.now(),
        };

        newValidated.push(validated);
        existingAddresses.add(token.address);
        stats.totalFiltered++;

        console.log(`[Scanner] Validé ✅ ${token.symbol} — score ${analysis.score}/100`);

        // Pause courte entre les appels GoPlus pour respecter le rate limit
        await sleep(300);

      } catch (tokenErr) {
        // On log l'erreur mais on continue avec les autres tokens
        console.error(`[Scanner] Erreur analyse ${token.address.slice(0, 8)}… : ${tokenErr.message}`);
        await sleep(500); // Pause plus longue si erreur (possible rate limit)
      }
    }

    // ── Étape 4 : sauvegarder les 50 derniers tokens validés ────────
    if (newValidated.length > 0) {
      const merged = [...newValidated, ...existingTokens].slice(0, 50);
      await kv.put('tokens', JSON.stringify(merged));
    }

    stats.lastScanAt = Date.now();
    stats.lastError  = null;

  } catch (err) {
    console.error('[Scanner] Erreur scan globale :', err.message);
    stats.lastError  = err.message;
    stats.lastScanAt = Date.now();
  }

  await kv.put('scan_stats', JSON.stringify(stats));
}

/** Utilitaire de pause asynchrone. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
