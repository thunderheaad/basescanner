/**
 * Scanner.jsx — Onglet principal : liste des tokens détectés
 */

import { useState, useMemo } from 'react';
import { useScanner } from '../hooks/useScanner.js';
import TokenCard from './TokenCard.jsx';

// Filtre "Marché calme" : aucun token depuis X minutes
const QUIET_MARKET_THRESHOLD_MS = 5 * 60 * 1000;

/** Formatte un delta de temps en français (ex: "il y a 3 min") */
function timeAgo(ms) {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60)  return `il y a ${seconds}s`;
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  return `il y a ${Math.floor(seconds / 3600)}h`;
}

/** Formatte un nombre en format compact ($12k, $1.2M) */
function formatUsd(value) {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value)}`;
}

export default function Scanner({ workerUrl, settings, onAddToWatchlist, isInWatchlist }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const { tokens, stats, newAddresses, isLoading, error, lastPollAt, refresh } =
    useScanner(workerUrl, settings, settings?.soundEnabled);

  // ── Filtrage côté frontend selon les réglages utilisateur ──
  const filteredTokens = useMemo(() => {
    if (!tokens.length) return [];

    return tokens.filter(token => {
      // Filtre liquidité minimale
      if (token.liquidityUsd < (settings?.liquidityMin ?? 10000)) return false;
      // Filtre âge maximum
      if (token.ageMinutes !== null && token.ageMinutes > (settings?.ageMax ?? 30)) return false;
      // Filtre wallets uniques
      if (token.holderCount < (settings?.uniqueWalletsMin ?? 20)) return false;
      return true;
    });
  }, [tokens, settings]);

  // ── Chips de filtre rapide ──────────────────────────────────
  const displayedTokens = useMemo(() => {
    switch (activeFilter) {
      case 'top':
        return filteredTokens.filter(t => t.score >= 85);
      case 'new':
        return filteredTokens.filter(t => (t.ageMinutes ?? 999) < 15);
      default:
        return filteredTokens;
    }
  }, [filteredTokens, activeFilter]);

  // Dernier token vu (pour le message "marché calme")
  const lastTokenTime = tokens[0]?.detectedAt ?? null;
  const isQuietMarket =
    lastTokenTime
      ? Date.now() - lastTokenTime > QUIET_MARKET_THRESHOLD_MS
      : !isLoading && tokens.length > 0;

  // Temps depuis le dernier scan
  const lastScanAgo = stats?.lastScanAt ? timeAgo(stats.lastScanAt) : null;

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{
        padding: '16px 16px 0',
        background: 'linear-gradient(180deg, #0a0f1e 0%, transparent 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Logo + badge ON/OFF */}
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24 }}>🔵</span>
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 800,
              fontSize: 22,
              background: 'linear-gradient(90deg, #0052FF, #00C2FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>
              BaseScan
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton refresh manuel */}
            <button
              onClick={refresh}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
                color: 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
              }}
              aria-label="Rafraîchir"
            >
              ↻
            </button>

            {/* Badge ON animé */}
            <div className="flex items-center gap-2" style={{
              background: 'var(--green-subtle)',
              border: '1px solid rgba(0,200,83,0.25)',
              borderRadius: 20,
              padding: '5px 10px',
            }}>
              <span className="pulse" style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: 'var(--green)',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                ON
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <StatPill
            icon="🔍"
            label={`${stats?.totalScanned ?? 0} scannés`}
          />
          <StatPill
            icon="✅"
            label={`${stats?.totalFiltered ?? 0} validés`}
            highlight
          />
          {lastScanAgo && (
            <StatPill icon="⏱" label={`Scan ${lastScanAgo}`} />
          )}
        </div>

        {/* Chips de filtre */}
        <div className="chip-group" style={{ marginBottom: 12, paddingBottom: 4 }}>
          {[
            { id: 'all',  label: `Tous (${filteredTokens.length})` },
            { id: 'top',  label: '⭐ Score >85' },
            { id: 'new',  label: '🆕 Nouveaux (<15 min)' },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`chip ${activeFilter === id ? 'active' : ''}`}
              onClick={() => setActiveFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 0 }} />
      </header>

      {/* ── Corps ─────────────────────────────────────────── */}
      <div style={{ padding: '12px 12px 0' }}>

        {/* Erreur Worker non configuré */}
        {!workerUrl && (
          <div style={{
            margin: '24px 0',
            padding: 16,
            background: 'var(--orange-subtle)',
            border: '1px solid rgba(255,152,0,0.25)',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
            <p style={{ fontWeight: 600, color: 'var(--orange)', marginBottom: 4 }}>
              Worker non configuré
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Ajoute la variable <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>VITE_WORKER_URL</code> dans Vercel.
            </p>
          </div>
        )}

        {/* Erreur réseau */}
        {error && workerUrl && (
          <div style={{
            margin: '8px 0 12px',
            padding: '10px 14px',
            background: 'var(--red-subtle)',
            border: '1px solid rgba(244,67,54,0.2)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--red)',
          }}>
            ⚠️ Erreur de connexion au Worker — nouvelle tentative dans 30s
          </div>
        )}

        {/* Skeleton loader au premier chargement */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
            ))}
          </div>
        )}

        {/* Message "marché calme" */}
        {!isLoading && isQuietMarket && filteredTokens.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--blue-subtle)',
            border: '1px solid var(--border-blue)',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 12,
            color: 'var(--blue-light)',
          }}>
            <span>🌊</span>
            <span>Marché calme sur Base — scan actif, aucun nouveau token depuis 5 min</span>
          </div>
        )}

        {/* Liste vide */}
        {!isLoading && displayedTokens.length === 0 && !error && workerUrl && (
          <div className="empty-state">
            <span className="empty-state-icon">
              {activeFilter === 'top' ? '⭐' : activeFilter === 'new' ? '🆕' : '🔭'}
            </span>
            <p className="empty-state-title">
              {activeFilter === 'top'
                ? 'Pas de token avec score ≥ 85 pour le moment'
                : activeFilter === 'new'
                ? 'Aucun token détecté depuis 15 min'
                : 'Aucun token validé pour le moment'}
            </p>
            <p className="empty-state-desc">
              Le scanner tourne en arrière-plan — les résultats apparaîtront automatiquement.
            </p>
          </div>
        )}

        {/* Cartes des tokens */}
        {!isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayedTokens.map(token => (
              <TokenCard
                key={token.address}
                token={token}
                isNew={newAddresses.has(token.address)}
                inWatchlist={isInWatchlist(token.address)}
                onAddToWatchlist={onAddToWatchlist}
              />
            ))}
          </div>
        )}

        {/* Message si tokens filtrés par les réglages */}
        {!isLoading && filteredTokens.length < tokens.length && tokens.length > 0 && (
          <p style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            padding: '16px 0 8px',
          }}>
            {tokens.length - filteredTokens.length} token(s) masqué(s) par tes filtres de réglages
          </p>
        )}
      </div>
    </div>
  );
}

/** Petite pilule de statistique dans le header */
function StatPill({ icon, label, highlight }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      background: highlight ? 'var(--green-subtle)' : 'var(--bg-card)',
      color: highlight ? 'var(--green)' : 'var(--text-secondary)',
      border: `1px solid ${highlight ? 'rgba(0,200,83,0.2)' : 'var(--border)'}`,
    }}>
      {icon} {label}
    </span>
  );
}
