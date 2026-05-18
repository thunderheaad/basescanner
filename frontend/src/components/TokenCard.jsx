/**
 * TokenCard.jsx — Carte d'un token avec métriques, badges et actions
 */

import { useState, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────

/** Raccourcit une adresse Ethereum (0x3f2a...4d9b) */
function shortAddr(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Formatte un montant USD compact */
function formatUsd(value) {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

/** Formatte un âge en minutes de façon lisible */
function formatAge(minutes) {
  if (minutes === null || minutes === undefined) return '?';
  if (minutes < 1)   return '<1 min';
  if (minutes < 60)  return `${Math.round(minutes)} min`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ''}`;
}

/** Formatte le temps depuis la détection */
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  return `il y a ${Math.floor(s / 3600)}h`;
}

/** Génère un emoji pertinent selon le nom/symbole du token */
function getTokenEmoji(name = '', symbol = '') {
  const text = (name + symbol).toLowerCase();
  if (/dog|doge|shib|woof|bark|puppy|hound/.test(text))    return '🐕';
  if (/cat|kit|meow|nyan|paw|feline/.test(text))            return '🐱';
  if (/moon|lunar|astro|orbit|galaxy/.test(text))           return '🌙';
  if (/fire|burn|flame|hot|inferno/.test(text))             return '🔥';
  if (/diamond|gem|crystal|jewel/.test(text))               return '💎';
  if (/rocket|pump|launch|boost|thrust/.test(text))         return '🚀';
  if (/ape|monkey|chimp|gorilla|kong/.test(text))           return '🦍';
  if (/pepe|frog|toad|ribbit/.test(text))                   return '🐸';
  if (/base|blue|ocean|sea|wave/.test(text))                 return '🔵';
  if (/gold|yellow|sun|sunny|sol/.test(text))               return '🟡';
  if (/bull|cow|moo|beef/.test(text))                       return '🐂';
  if (/bear|panda|koala/.test(text))                        return '🐻';
  if (/fish|whale|shark|dolphin|tuna|dory/.test(text))      return '🐋';
  if (/ai|bot|robot|gpt|agent/.test(text))                  return '🤖';
  if (/game|play|chess|arcade|pixel/.test(text))            return '🎮';
  if (/money|cash|dollar|bank|rich|wealth/.test(text))      return '💰';
  if (/star|stellar|nova|cosmos/.test(text))                return '⭐';
  if (/dragon|drak|fire|legend/.test(text))                 return '🐉';
  if (/wizard|magic|spell|potion/.test(text))               return '🧙';
  if (/ninja|samurai|sword/.test(text))                     return '⚔️';
  if (/santa|xmas|christmas|holiday/.test(text))            return '🎅';
  if (/pizza|food|burger|eat/.test(text))                   return '🍕';
  if (/music|song|beat|bass/.test(text))                    return '🎵';
  if (/baby|little|mini|nano|micro/.test(text))             return '👶';
  if (/safe|lock|secure|vault/.test(text))                  return '🔒';
  if (/fast|speed|quick|rapid|flash/.test(text))            return '⚡';
  return '🪙'; // Emoji par défaut
}

/** Classe CSS du score ring selon la valeur */
function scoreClass(score) {
  if (score >= 85) return 'score-high';
  if (score >= 75) return 'score-mid';
  return 'score-low';
}

// ─────────────────────────────────────────────────────────────

export default function TokenCard({ token, isNew, inWatchlist, onAddToWatchlist }) {
  const [copied, setCopied] = useState(false);

  const emoji = getTokenEmoji(token.name, token.symbol);

  // ── Copier l'adresse ──────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pour les navigateurs sans clipboard API (vieux Android)
      const el = document.createElement('textarea');
      el.value = token.address;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [token.address]);

  // ── Ouvrir DexScreener ────────────────────────────────────
  const handleDexScreener = useCallback(() => {
    window.open(`https://dexscreener.com/base/${token.address}`, '_blank', 'noopener,noreferrer');
  }, [token.address]);

  // ── Ajouter à la watchlist ────────────────────────────────
  const handleWatchlist = useCallback(() => {
    if (!inWatchlist) onAddToWatchlist(token);
  }, [token, inWatchlist, onAddToWatchlist]);

  const { details = {} } = token;
  const buyTax  = details.buyTax  ?? 0;
  const sellTax = details.sellTax ?? 0;

  return (
    <article
      className={`card fade-in ${isNew ? 'card-new' : ''}`}
      style={{ padding: '14px 14px 12px' }}
    >
      {/* ── Ligne 1 : identité + score ───────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          {/* Icône/emoji du token */}
          {token.icon
            ? <img src={token.icon} alt="" width={32} height={32}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            : <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
          }

          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-ui)' }}>
                {token.symbol}
              </span>
              {isNew && (
                <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 6px' }}>
                  NOUVEAU
                </span>
              )}
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {shortAddr(token.address)}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className={`score-ring ${scoreClass(token.score)}`}>
          {token.score}
        </div>
      </div>

      {/* ── Ligne 2 : badges de sécurité ────────────────── */}
      <div className="flex" style={{ flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {details.isOpenSource && (
          <span className="badge badge-green">✅ Vérifié</span>
        )}
        {!details.isMintable && (
          <span className="badge badge-green">🔒 No Mint</span>
        )}
        {details.isOwnershipRenounced && (
          <span className="badge badge-green">🔒 Renoncé</span>
        )}
        {details.liquidityLocked && (
          <span className="badge badge-blue">🔐 LP Lockée</span>
        )}
        {!details.hasProxy && (
          <span className="badge badge-gray">🛡 No Proxy</span>
        )}
        {!details.hasBlacklist && (
          <span className="badge badge-gray">✓ No Blacklist</span>
        )}
        {!details.isOpenSource && (
          <span className="badge badge-orange">⚠️ Non vérifié</span>
        )}
      </div>

      {/* ── Ligne 3 : métriques ──────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
        marginBottom: 10,
      }}>
        <Metric icon="💧" label="Liquidité" value={formatUsd(token.liquidityUsd)} />
        <Metric icon="⏱" label="Âge"       value={formatAge(token.ageMinutes)} />
        <Metric icon="👥" label="Wallets"   value={token.holderCount > 0 ? token.holderCount.toLocaleString() : '?'} />
        <Metric icon="📊" label="Vol 24h"   value={formatUsd(token.volumeH24)} />
        <Metric
          icon="💸"
          label="Tax B/S"
          value={`${buyTax.toFixed(1)}% / ${sellTax.toFixed(1)}%`}
          warn={buyTax + sellTax > 5}
        />
        <Metric icon="🏦" label="DEX"       value={token.dexId || '?'} small />
      </div>

      {/* ── Ligne 4 : temps + actions ────────────────────── */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {timeAgo(token.detectedAt)}
        </span>

        <div className="flex gap-2">
          {/* Bouton copier adresse */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '7px 12px', gap: 4 }}
            onClick={handleCopy}
            aria-label="Copier l'adresse du contrat"
          >
            {copied ? '✅ Copié !' : '📋 Contrat'}
          </button>

          {/* Bouton DexScreener */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '7px 12px', gap: 4 }}
            onClick={handleDexScreener}
            aria-label="Voir sur DexScreener"
          >
            📊 Dex
          </button>

          {/* Bouton watchlist */}
          <button
            className="btn"
            style={{
              fontSize: 13,
              padding: '7px 10px',
              background: inWatchlist ? 'var(--blue-subtle)' : 'var(--bg-input)',
              color: inWatchlist ? 'var(--blue-light)' : 'var(--text-secondary)',
              border: `1px solid ${inWatchlist ? 'var(--border-blue)' : 'var(--border)'}`,
            }}
            onClick={handleWatchlist}
            aria-label={inWatchlist ? 'Dans la watchlist' : 'Ajouter à la watchlist'}
          >
            {inWatchlist ? '👁' : '👁'}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Petite cellule de métrique */
function Metric({ icon, label, value, warn, small }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 8,
      padding: '6px 8px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: warn ? 'var(--orange)' : 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  );
}
