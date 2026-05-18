/**
 * scorer.js — Analyse de sécurité via GoPlus Security + calcul du score (0-100)
 *
 * GoPlus Security API :
 *   Base Chain ID : 8453
 *   Endpoint      : https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses={address}
 *   Header auth   : Authorization: {GOPLUS_API_KEY}
 *
 * Grille de score :
 *   ═ Critères ÉLIMINATOIRES (score = 0 si l'un d'eux échoue) ═════════
 *   • Honeypot détecté
 *   • Fonction Mint active
 *   • Ownership non renoncé (owner peut encore agir)
 *   • Tax buy ou sell > 10%
 *
 *   ═ Critères PONDÉRÉS (si tous les éliminatoires passent) ════════════
 *   • Liquidité lockée (Unicrypt/PinkLock/Team Finance)  → +25 pts
 *   • Top 10 holders < 40% du supply                     → +20 pts
 *   • Wallet créateur < 5% du supply                     → +15 pts
 *   • Pas de fonction blacklist                          → +15 pts
 *   • Pas de proxy contract                              → +15 pts
 *   • Tax total < 5%                                     → +10 pts
 *   • Tax total entre 5% et 10%                          → +5 pts
 *   ────────────────────────────────────────────────────────────────────
 *   Score maximum : 100 pts (si tout est parfait)
 *   Seuil de validation : 75 pts
 */

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';
const BASE_CHAIN_ID = '8453';
const REQUEST_TIMEOUT_MS = 8000; // 8 secondes avant timeout

/**
 * Analyse un token via l'API GoPlus et retourne son score de sécurité.
 *
 * @param {string} tokenAddress  — Adresse du contrat ERC-20
 * @param {string} apiKey        — Clé API GoPlus (peut être vide sur le free tier sans auth)
 * @returns {Promise<{score: number, details: object, pass: boolean, holderCount: number, reason?: string}>}
 * @throws {Error} Si l'API est indisponible ou renvoie une erreur
 */
export async function analyzeToken(tokenAddress, apiKey) {
  const url = `${GOPLUS_BASE_URL}/token_security/${BASE_CHAIN_ID}?contract_addresses=${tokenAddress.toLowerCase()}`;

  const headers = { 'Accept': 'application/json' };
  if (apiKey) headers['Authorization'] = apiKey;

  // Timeout manuel car Cloudflare Workers n'implémente pas AbortSignal.timeout() partout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('GoPlus timeout')), REQUEST_TIMEOUT_MS)
  );

  const fetchPromise = fetch(url, { headers });
  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (!response.ok) {
    // 429 = rate limit GoPlus → on lève une erreur explicite pour retry ultérieur
    if (response.status === 429) throw new Error('GoPlus rate limit (429)');
    throw new Error(`GoPlus HTTP ${response.status}`);
  }

  const data = await response.json();

  // code !== 1 signale une erreur applicative GoPlus (token non trouvé, etc.)
  if (data.code !== 1) {
    throw new Error(`GoPlus erreur applicative : ${data.message || 'inconnue'}`);
  }

  if (!data.result) throw new Error('GoPlus : résultat vide');

  // GoPlus retourne l'adresse en clé, parfois en minuscules, parfois avec checksum
  const tokenData =
    data.result[tokenAddress.toLowerCase()] ||
    data.result[tokenAddress];

  if (!tokenData) throw new Error('GoPlus : données token introuvables');

  return calculateScore(tokenData);
}

/**
 * Calcule le score de sécurité à partir des données brutes GoPlus.
 * Cette fonction est exportée pour faciliter les tests unitaires.
 *
 * @param {object} data — Objet résultat GoPlus pour un token
 * @returns {{score: number, details: object, pass: boolean, holderCount: number, reason?: string}}
 */
export function calculateScore(data) {
  // ── Extraction et normalisation des champs GoPlus ──────────────────
  const isHoneypot          = data.is_honeypot === '1';
  const isMintable          = data.is_mintable === '1';
  const hasProxy            = data.is_proxy === '1';
  const hasBlacklist        = data.is_blacklisted === '1';
  const canTakeBackOwner    = data.can_take_back_ownership === '1';
  const hasHiddenOwner      = data.hidden_owner === '1';
  const isOpenSource        = data.is_open_source === '1';
  const isAntiWhale         = data.is_anti_whale === '1';
  const transferPausable    = data.transfer_pausable === '1';

  const buyTax              = parseFloat(data.buy_tax  || '0');
  const sellTax             = parseFloat(data.sell_tax || '0');
  const totalTax            = buyTax + sellTax;

  // Les pourcentages GoPlus sont entre 0 et 1 (ex: 0.05 = 5%)
  const creatorPercent      = parseFloat(data.creator_percent || '0') * 100;
  const ownerPercent        = parseFloat(data.owner_percent   || '0') * 100;

  const holderCount         = parseInt(data.holder_count    || '0', 10);
  const lpHolderCount       = parseInt(data.lp_holder_count || '0', 10);

  // Ownership renoncé = owner_address vide ou adresse zéro, ET pas de reprise possible
  const ownerAddress = data.owner_address || '';
  const isOwnershipRenounced =
    (ownerAddress === '' || ownerAddress === '0x0000000000000000000000000000000000000000') &&
    !canTakeBackOwner &&
    !hasHiddenOwner;

  // Top 10 holders : somme des pourcentages des 10 premiers wallets
  const holders = Array.isArray(data.holders) ? data.holders : [];
  const top10Percent = holders
    .slice(0, 10)
    .reduce((sum, h) => sum + (parseFloat(h.percent || '0') * 100), 0);

  // Liquidité lockée : un des LP holders est un locker connu
  const lpHolders = Array.isArray(data.lp_holders) ? data.lp_holders : [];
  const knownLockers = ['unicrypt', 'pinklock', 'team finance', 'mudra', 'dx lock', 'flokilock'];
  const liquidityLocked = lpHolders.some(h => {
    if (h.is_locked === 1 || h.is_locked === '1') return true;
    const tag = (h.tag || '').toLowerCase();
    const addr = (h.address || '').toLowerCase();
    return knownLockers.some(l => tag.includes(l) || addr.includes(l));
  });

  // Objet détails transmis au frontend pour afficher les badges
  const details = {
    isHoneypot,
    isMintable,
    isOwnershipRenounced,
    hasBlacklist,
    hasProxy,
    isOpenSource,
    buyTax,
    sellTax,
    totalTax,
    creatorPercent,
    ownerPercent,
    holderCount,
    lpHolderCount,
    top10Percent: Math.round(top10Percent * 10) / 10,
    liquidityLocked,
    isAntiWhale,
    transferPausable,
  };

  // ── CRITÈRES ÉLIMINATOIRES ─────────────────────────────────────────
  // Un seul suffit pour rejeter le token (score = 0, pass = false)

  if (isHoneypot) {
    return { score: 0, details, pass: false, holderCount, reason: 'HONEYPOT' };
  }

  if (isMintable) {
    return { score: 0, details, pass: false, holderCount, reason: 'MINT_FUNCTION' };
  }

  if (!isOwnershipRenounced) {
    return { score: 0, details, pass: false, holderCount, reason: 'OWNERSHIP_NOT_RENOUNCED' };
  }

  if (buyTax > 10 || sellTax > 10) {
    return { score: 0, details, pass: false, holderCount, reason: 'HIGH_TAX' };
  }

  // ── CRITÈRES PONDÉRÉS ──────────────────────────────────────────────
  let score = 0;
  const scoreBreakdown = {};

  if (liquidityLocked) {
    score += 25;
    scoreBreakdown.liquidityLocked = 25;
  }

  if (top10Percent < 40) {
    score += 20;
    scoreBreakdown.top10Holders = 20;
  }

  if (creatorPercent < 5) {
    score += 15;
    scoreBreakdown.creatorWallet = 15;
  }

  if (!hasBlacklist) {
    score += 15;
    scoreBreakdown.noBlacklist = 15;
  }

  if (!hasProxy) {
    score += 15;
    scoreBreakdown.noProxy = 15;
  }

  if (totalTax < 5) {
    score += 10;
    scoreBreakdown.tax = 10;
  } else if (totalTax <= 10) {
    score += 5;
    scoreBreakdown.tax = 5;
  }

  details.scoreBreakdown = scoreBreakdown;

  return {
    score,
    details,
    pass: score >= 75,
    holderCount,
  };
}
