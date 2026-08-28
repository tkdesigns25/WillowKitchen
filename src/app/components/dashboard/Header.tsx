import React from 'react';
import { GhostBtn } from './Dashboard';

interface HeaderProps {
  isOpen: boolean; autoAccept: boolean; soundEnabled: boolean;
  cookingCount: number; waitingCount: number; doneCount: number;
  stationLoads: Record<string, number>; clock: string;
  onOpen: () => void; onClose: () => void;
  onAutoAcceptOn: () => void; onAutoAcceptOff: () => void;
  onToggleSound: () => void;
  onOpenNewOrder: () => void; onOpenPause: () => void; onOpenMenu: () => void;
}

const STATIONS = ['Hot', 'Grill', 'Assembly'] as const;

function WillowLogo({ size = 26, color = 'var(--wk-oxblood)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M 12 86 C 38 74 62 74 88 86 C 62 80 38 80 12 86 Z" fill={color} stroke="none" />
      <path d="M 50 82 L 50 42" strokeWidth="7" />
      {/* Left drooping arches */}
      <path d="M 50 46 C 30 40 10 22 10 44 L 10 70 M 17 44 L 17 70 M 24 40 L 24 70 M 31 36 L 31 70" />
      <path d="M 50 42 C 36 24 22 12 22 32 L 22 46 M 29 32 L 29 46 M 36 28 L 36 46" />
      {/* Center top crown */}
      <path d="M 50 44 C 40 28 40 8 50 8 C 60 8 60 28 50 44 Z" fill={color} stroke="none" />
      {/* Right drooping arches */}
      <path d="M 50 42 C 64 24 78 12 78 32 L 78 46 M 71 32 L 71 46 M 64 28 L 64 46" />
      <path d="M 50 46 C 70 40 90 22 90 44 L 90 70 M 83 44 L 83 70 M 76 40 L 76 70 M 69 36 L 69 70" />
    </svg>
  );
}

export function DashboardHeader(props: HeaderProps) {
  const { isOpen, autoAccept, soundEnabled, cookingCount, waitingCount, doneCount, stationLoads, clock } = props;

  return (
    <header className="wk-header-bar">
      {/* Brand */}
      <div className="wk-header-brand">
        <WillowLogo size={24} color="var(--wk-oxblood)" />
        <span className="wk-brand-title" style={{ fontFamily: 'var(--wk-font-ui)', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wk-oxblood)', whiteSpace: 'nowrap' }}>
          Willow Kitchen
        </span>
      </div>

      {/* Left controls: Open/Close & Auto-Accept switches */}
      <div className="wk-header-left-controls">
        {/* Open / Close switch */}
        <div style={{ display: 'flex', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', overflow: 'hidden', flexShrink: 0 }}>
          <OcBtn active={isOpen ? 'open' : null} onClick={props.onOpen}>✓ Open</OcBtn>
          <OcBtn active={!isOpen ? 'close' : null} onClick={props.onClose}>⛔ Close</OcBtn>
        </div>

        {/* Auto-Accept switch */}
        <div style={{ display: 'flex', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', overflow: 'hidden', flexShrink: 0 }}>
          <OcBtn active={autoAccept ? 'open' : null} onClick={props.onAutoAcceptOn}>Auto-Accept: ON</OcBtn>
          <OcBtn active={!autoAccept ? 'close' : null} onClick={props.onAutoAcceptOff}>Auto-Accept: OFF</OcBtn>
        </div>
      </div>

      {/* Live stats */}
      <div className="wk-header-stats">
        <StatPill label="Cooking" value={cookingCount} />
        <StatPill label="Waiting" value={waitingCount} />
        <StatPill label="Done Today" value={doneCount} />
      </div>

      {/* Station load tracks */}
      <div className="wk-header-station-loads">
        {STATIONS.map(stn => {
          const load  = stationLoads[stn] || 0;
          const count = Math.round(load / 10); // 0–10 items
          const isFull = count >= 10;
          const isWarn = count >= 7;
          const numColor = isFull ? 'var(--wk-red)' : isWarn ? '#b07800' : 'var(--wk-oxblood)';
          return (
            <div key={stn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wk-graphite)' }}>
                {stn}
              </span>
              {/* Segment bar */}
              <div className={isFull ? 'wk-sl-track overloaded' : 'wk-sl-track'} style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={`wk-sl-segment ${i < count ? 'filled' : ''}`} />
                ))}
              </div>
              {/* Count below bar */}
              <span style={{ fontSize: 9, fontWeight: 900, lineHeight: 1, color: numColor, fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'center', display: 'inline-block' }}>
                {count}/10
              </span>
            </div>
          );
        })}
      </div>

      {/* Right controls: Restored clean previous buttons (Out of Stock, ⏸ Stop Apps, + New Order, 🔔 Bell) */}
      <div className="wk-header-right-controls">
        <span className="wk-clock-display" style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--wk-graphite)',
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
          width: 82,
          textAlign: 'center',
          display: 'inline-block',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {clock}
        </span>
        <IconBtn title={soundEnabled ? 'Turn sounds off' : 'Turn sounds on'} active={soundEnabled} onClick={props.onToggleSound}>
          {soundEnabled ? '🔔' : '🔕'}
        </IconBtn>
        <GhostBtn className="wk-ghost-btn-resp" onClick={props.onOpenMenu}>Out of Stock</GhostBtn>
        <GhostBtn className="wk-ghost-btn-resp" onClick={props.onOpenPause}>⏸ Stop Apps</GhostBtn>
        <GhostBtn className="wk-ghost-btn-resp" onClick={props.onOpenNewOrder}>+ New Order</GhostBtn>
      </div>
    </header>
  );
}

function OcBtn({ children, active, onClick }: { children: React.ReactNode; active: 'open' | 'close' | null; onClick: () => void }) {
  const bg = active === 'open' ? 'var(--wk-oxblood)' : active === 'close' ? 'var(--wk-gold)' : 'var(--wk-vellum)';
  const color = active === 'open' ? 'var(--wk-vellum)' : active === 'close' ? 'var(--wk-ink)' : 'var(--wk-graphite)';
  return (
    <button
      className="wk-interactive"
      onClick={onClick}
      style={{ padding: '6px 11px', border: 'none', background: bg, color, fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="wk-stat-pill-resp" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, padding: '3px 8px', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', background: 'var(--wk-linen)', whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wk-graphite)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--wk-ink)', lineHeight: 1, minWidth: 14, textAlign: 'center', display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function IconBtn({ children, title, active, onClick }: { children: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className="wk-interactive"
      title={title}
      onClick={onClick}
      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--wk-linen)' : 'var(--wk-vellum)', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
    >
      {children}
    </button>
  );
}
