/**
 * Watchlist.jsx — Onglet watchlist : tokens suivis manuellement
 */

import { useState, useCallback } from 'react';

function shortAddr(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scoreClass(score) {
  if (score >= 85) return 'score-high';
  if (score >= 75) return 'score-mid';
  return 'score-low';
}

export default function Watchlist({ watchlist, loading, onRemove }) {
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{
        padding: '20px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
            👁 Watchlist
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {watchlist.length} token{watchlist.length !== 1 ? 's' : ''} suivi{watchlist.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {/* ── Corps ─────────────────────────────────────────── */}
      <div style={{ padding: '12px 12px 0' }}>

        {/* Skeleton au chargement */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
            ))}
          </div>
        )}

        {/* Liste vide */}
        {!loading && watchlist.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">🔭</span>
            <p className="empty-state-title">Ta watchlist est vide</p>
            <p className="empty-state-desc">
              Dans l'onglet Scanner, appuie sur 👁 sur une carte de token pour l'ajouter ici.
            </p>
          </div>
        )}

        {/* Cartes watchlist */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {watchlist.map(token => (
              <WatchlistCard
                key={token.address}
                token={token}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WatchlistCard({ token, onRemove }) {
  const [copied,      setCopied]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token.address);
    } catch {
      const el = document.createElement('textarea');
      el.value = token.address;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token.address]);

  const handleRemove = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onRemove(token.address);
  }, [confirmDelete, token.address, onRemove]);

  return (
    <div className="card fade-in" style={{ padding: '12px 14px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        {/* Identité */}
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          {token.icon
            ? <img src={token.icon} alt="" width={28} height={28}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            : <span style={{ fontSize: 22, flexShrink: 0 }}>🪙</span>
          }
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{token.symbol}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 6 }}>{token.name}</span>
          </div>
        </div>

        {/* Score */}
        {token.score && (
          <span className={`score-ring ${scoreClass(token.score)}`}
            style={{ width: 38, height: 38, fontSize: 12 }}>
            {token.score}
          </span>
        )}
      </div>

      {/* Adresse + date */}
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          letterSpacing: '0.02em',
        }}>
          {shortAddr(token.address)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {formatDate(token.addedAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="btn btn-ghost"
          style={{ flex: 1, fontSize: 12, padding: '7px 0' }}
          onClick={handleCopy}
        >
          {copied ? '✅ Copié !' : '📋 Copier'}
        </button>

        <button
          className="btn btn-ghost"
          style={{ flex: 1, fontSize: 12, padding: '7px 0' }}
          onClick={() => window.open(`https://dexscreener.com/base/${token.address}`, '_blank', 'noopener')}
        >
          📊 DexScreener
        </button>

        <button
          className="btn"
          style={{
            fontSize: 12,
            padding: '7px 12px',
            background: confirmDelete ? 'var(--red-subtle)' : 'var(--bg-input)',
            color: confirmDelete ? 'var(--red)' : 'var(--text-muted)',
            border: `1px solid ${confirmDelete ? 'rgba(244,67,54,0.3)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}
          onClick={handleRemove}
          aria-label="Supprimer de la watchlist"
        >
          {confirmDelete ? '⚠️' : '🗑'}
        </button>
      </div>
    </div>
  );
}
