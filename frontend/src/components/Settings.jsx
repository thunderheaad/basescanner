/**
 * Settings.jsx — Onglet réglages : sliders + toggles persistés dans le KV
 */

export default function Settings({ settings, onUpdate }) {
  const s = settings || {};

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>⚙️ Réglages</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Filtres appliqués en temps réel — sauvegarde automatique
        </p>
      </header>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Section : Filtres de scan ──────────────────────── */}
        <SectionTitle>Filtres de scan</SectionTitle>

        {/* Liquidité minimum */}
        <SliderRow
          label="Liquidité minimum"
          icon="💧"
          value={s.liquidityMin ?? 10000}
          min={5000}
          max={100000}
          step={1000}
          format={v => `$${(v / 1000).toFixed(0)}k`}
          onChange={v => onUpdate('liquidityMin', v)}
          description="Ignore les tokens avec trop peu de liquidité"
        />

        {/* Âge maximum */}
        <SliderRow
          label="Âge maximum de la paire"
          icon="⏱"
          value={s.ageMax ?? 30}
          min={5}
          max={120}
          step={5}
          format={v => `${v} min`}
          onChange={v => onUpdate('ageMax', v)}
          description="Filtre les paires créées avant ce délai"
        />

        {/* Wallets uniques minimum */}
        <SliderRow
          label="Wallets uniques minimum"
          icon="👥"
          value={s.uniqueWalletsMin ?? 20}
          min={5}
          max={200}
          step={5}
          format={v => `${v} wallets`}
          onChange={v => onUpdate('uniqueWalletsMin', v)}
          description="Évite les tokens avec trop peu de holders"
        />

        {/* ── Section : Sécurité ─────────────────────────────── */}
        <SectionTitle style={{ marginTop: 8 }}>Sécurité</SectionTitle>

        {/* Score minimum — lecture seule */}
        <div style={{
          padding: '14px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16 }}>🛡</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Score minimum</span>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: 'var(--green-subtle)',
              border: '1px solid rgba(0,200,83,0.2)',
              borderRadius: 20,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--green)',
            }}>
              75 / 100
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 26 }}>
            Mode prudent activé — valeur fixe, non modifiable
          </p>
        </div>

        {/* ── Section : Notifications ────────────────────────── */}
        <SectionTitle style={{ marginTop: 8 }}>Notifications</SectionTitle>

        {/* Son de notification */}
        <div style={{
          padding: '14px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16 }}>🔔</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Son de notification</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Bip discret à chaque nouveau token détecté
                </div>
              </div>
            </div>
            <label className="toggle" aria-label="Activer le son de notification">
              <input
                type="checkbox"
                checked={s.soundEnabled ?? false}
                onChange={e => onUpdate('soundEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* ── Informations système ───────────────────────────── */}
        <SectionTitle style={{ marginTop: 8 }}>Informations</SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
          <InfoRow label="Chaîne" value="Base Chain (ID 8453)" />
          <InfoRow label="Intervalle de scan" value="~30 secondes" />
          <InfoRow label="Tokens conservés" value="50 derniers validés" />
          <InfoRow label="Source sécurité" value="GoPlus Security API" />
          <InfoRow label="Source données" value="DexScreener API" />
          <InfoRow label="Stockage" value="Cloudflare KV" />
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div style={{
          marginTop: 8,
          padding: '16px 0',
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            BaseScan — Scanner de tokens Base Chain{'\n'}
            <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
              Aucun appel direct aux APIs depuis ton téléphone.{'\n'}
              Toutes les données transitent via le Cloudflare Worker.
            </span>
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            padding: '5px 12px',
            background: 'var(--blue-subtle)',
            borderRadius: 20,
            border: '1px solid var(--border-blue)',
          }}>
            <span style={{ fontSize: 14 }}>🔵</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-light)' }}>
              Powered by Base Chain
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────

function SectionTitle({ children, style }) {
  return (
    <h2 style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      paddingTop: 16,
      paddingBottom: 8,
      ...style,
    }}>
      {children}
    </h2>
  );
}

function SliderRow({ label, icon, value, min, max, step, format, onChange, description }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
            {description && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {description}
              </div>
            )}
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--blue-light)',
          minWidth: 70,
          textAlign: 'right',
        }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--blue-base) 0%, var(--blue-base) ${((value - min) / (max - min)) * 100}%, var(--border) ${((value - min) / (max - min)) * 100}%, var(--border) 100%)`
        }}
      />
      <div className="flex justify-between" style={{ marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {format(min)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {format(max)}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between" style={{
      padding: '8px 12px',
      background: 'var(--bg-card)',
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
