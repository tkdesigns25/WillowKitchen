import React, { useState } from 'react';
import type { Order, Rider, Item } from './types';
import { CFG, fmtMSS, ordNum, getPlacedTime } from './config';
import { ChannelBadge } from './Dashboard';

interface CanceledStockEntry {
  id: string; name: string; qty: number; createdAtSimSecs: number;
}

interface Props {
  order: Order;
  riders: Rider[];
  canceledStock: CanceledStockEntry[];
  currentSimSecs: number;
  stationLoads: Record<string, number>;
  orders: Record<string, Order>;
  onToggleItem: (orderId: string, itemId: string) => void;
  onStartItem: (orderId: string, itemId: string) => void;
  onHoldItem: (orderId: string, itemId: string) => void;
  onPackOrder: () => void;
  onHandover: () => void;
  onCallRider: () => void;
  onCancel: () => void;
  onConsumeCanceled: (matchId: string, orderId: string, itemName: string) => void;
}

export function ActiveOrderCard(props: Props) {
  const { order, riders, canceledStock, currentSimSecs, stationLoads } = props;
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const rider     = riders.find(r => r.orderId === order.id);
  const doneCount = order.items.filter(i => i.state === 'Ready').length;
  const total     = order.items.length;
  const allReady  = doneCount === total;

  const slaLabel = fmtMSS(Math.floor(order.slaSecsRemaining));
  const elapsed  = fmtMSS(order.elapsedPrepSimSecs || 0);

  const isBreach = order.slaSecsRemaining < 0;
  const isWarn   = order.slaSecsRemaining <= CFG.SLA_WARN_SECS;

  // Urgency class (animation only — no style conflict)
  const urgencyClass = isBreach ? 'wk-sla-breach' : isWarn ? 'wk-sla-urgent' : '';

  const isPacked    = order.status === 'packed';
  const readyToPack = !isPacked && allReady;

  // All border/background values computed as longhands — never mix with shorthands
  const cardBgColor        = readyToPack ? 'var(--wk-buttered-gold)' : 'var(--wk-vellum)';
  const cardBorderColor    = readyToPack ? 'var(--wk-gold)' : 'var(--wk-border)';
  const cardBorderLWidth   = (isBreach || isWarn) ? '4px' : '1px';
  const cardBorderLColor   = isBreach ? 'var(--wk-red)' : isWarn ? 'var(--wk-gold)' : cardBorderColor;

  // Timer display on dark oxblood background — must always be high-contrast
  let slaTimerBg     = 'transparent';
  let slaTimerColor  = 'var(--wk-vellum)';
  let slaTimerBorder = '1px solid transparent';
  if (isBreach) { slaTimerBg = 'var(--wk-red)'; slaTimerColor = '#fff'; slaTimerBorder = 'none'; }
  else if (isWarn) { slaTimerBg = 'var(--wk-gold)'; slaTimerColor = '#000'; slaTimerBorder = 'none'; }

  // Ready Items Pool matches for active items
  const canceledMatches = order.status === 'active'
    ? order.items.flatMap(item => {
        if (item.state === 'Ready') return [];
        const match = canceledStock.find(c => c.name === item.name && c.qty >= item.qty);
        if (!match) return [];
        const ageMins = Math.floor((currentSimSecs - match.createdAtSimSecs) / 60);
        return [{ name: item.name, ageMins, matchId: match.id, itemId: item.id }];
      })
    : [];

  // Group items by station
  const itemsByStation: Record<string, Item[]> = {};
  order.items.forEach(item => {
    if (!itemsByStation[item.station]) itemsByStation[item.station] = [];
    itemsByStation[item.station].push(item);
  });

  function handleCancelClick() {
    if (confirmingCancel) {
      props.onCancel();
      setConfirmingCancel(false);
    } else {
      setConfirmingCancel(true);
      setTimeout(() => setConfirmingCancel(false), 3000);
    }
  }

  return (
    <article
      className={`wk-interactive wk-glide-in ${urgencyClass}`}
      style={{
        width: '100%', maxWidth: 380,
        // Background — longhand only, no 'background' shorthand
        backgroundColor: cardBgColor,
        // Border — all four sides as longhands to avoid shorthand/longhand conflict
        borderTopWidth: '1px',    borderTopStyle: 'solid',    borderTopColor: cardBorderColor,
        borderRightWidth: '1px',  borderRightStyle: 'solid',  borderRightColor: cardBorderColor,
        borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: cardBorderColor,
        borderLeftWidth: cardBorderLWidth, borderLeftStyle: 'solid', borderLeftColor: cardBorderLColor,
        borderRadius: 'var(--wk-r)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'stretch', borderBottom: 'var(--wk-b)', flexShrink: 0 }}>
        {/* Left: order num + platform + elapsed */}
        <div style={{ padding: '9px 10px', borderRight: 'var(--wk-b)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 96 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 2 }}>Order</div>
            <div className="wk-ordnum" style={{ fontSize: 28, color: 'var(--wk-oxblood)', lineHeight: 1 }}>{ordNum(order.id)}</div>
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ marginBottom: 3 }}><ChannelBadge source={order.source} /></div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>🕐 {elapsed}</div>
          </div>
        </div>

        {/* Right: Time Left timer + cancel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', padding: '9px 12px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,249,235,0.7)', marginBottom: 2 }}>Time Left</span>
            <span
              className="wk-countdown"
              style={{ fontSize: 22, padding: '2px 6px', borderRadius: 3, background: slaTimerBg, color: slaTimerColor, border: slaTimerBorder }}
            >
              {slaLabel}
            </span>
          </div>
          {/* Rider action + Cancel button */}
          <div style={{ padding: '3px 8px', background: 'rgba(240,231,215,0.5)', borderTop: 'var(--wk-b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            {rider && rider.status === 'transit' ? (
              <button
                className="wk-interactive"
                onClick={props.onCallRider}
                style={{
                  padding: '3px 7px', border: '1px solid #d97706',
                  borderRadius: 'var(--wk-r)', background: '#fef3c7',
                  color: '#92400e',
                  fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 9,
                  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                📢 Call Rider
              </button>
            ) : <div />}
            <button
              className="wk-interactive"
              onClick={handleCancelClick}
              style={{
                padding: '3px 8px', border: `1px solid ${confirmingCancel ? 'var(--wk-red)' : 'var(--wk-oxblood)'}`,
                borderRadius: 'var(--wk-r)', background: confirmingCancel ? 'var(--wk-red)' : 'transparent',
                color: confirmingCancel ? '#fff' : 'var(--wk-oxblood)',
                fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 9,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {confirmingCancel ? '⚠ Tap again to cancel' : 'Cancel order'}
            </button>
          </div>
        </div>
      </header>

      {/* Ready Items Pool prompts */}
      {canceledMatches.map(m => (
        <div
          key={m.matchId}
          className="wk-interactive"
          onClick={() => props.onConsumeCanceled(m.matchId, order.id, m.name)}
          style={{ padding: '5px 12px', background: 'rgba(217,119,6,0.08)', borderBottom: 'var(--wk-b)', fontSize: 10, fontWeight: 700, color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#d97706', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>Grabs</span>
          Use {m.name} from Up for Grabs? (Made {m.ageMins}m ago)
        </div>
      ))}

      {/* Customer + notes */}
      <div style={{ padding: '5px 12px', borderBottom: 'var(--wk-b)', background: 'rgba(240,231,215,0.3)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{order.customer}</span>
        {order.notes && <span style={{ fontSize: 9, fontStyle: 'italic', opacity: 0.8 }}>"{order.notes}"</span>}
      </div>

      {/* Items — hidden when packed */}
      {!isPacked && (
        <main>
          {Object.entries(itemsByStation).map(([station, items]) => (
            <section key={station} style={{ borderBottom: 'var(--wk-b)' }}>
              <div style={{ background: 'var(--wk-linen)', padding: '3px 12px', borderBottom: '1px solid rgba(55,8,8,0.1)' }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--wk-oxblood)' }}>{station} Station</span>
              </div>
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  orderId={order.id}
                  stationLoad={stationLoads[station] || 0}
                  hasPoolMatch={canceledMatches.some(m => m.itemId === item.id)}
                />
              ))}
            </section>
          ))}
        </main>
      )}

      {/* CTA footer */}
      {isPacked ? <PackedFooter order={order} rider={rider} onHandover={props.onHandover} onCallRider={props.onCallRider} />
        : allReady ? (
          <footer style={{ flexShrink: 0, borderTop: 'var(--wk-b)', height: 40 }}>
            <button
              className="wk-interactive"
              onClick={props.onPackOrder}
              style={{ width: '100%', height: '100%', background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', border: 'none', fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              📦 Confirm Packed
            </button>
          </footer>
        ) : (
          <footer style={{ flexShrink: 0, borderTop: 'var(--wk-b)', height: 40, display: 'flex' }}>
            <div style={{ flex: 3, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
              <div style={{ width: '100%', background: 'var(--wk-vellum)', height: 6, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(55,8,8,0.15)' }}>
                <div style={{ background: 'var(--wk-oxblood)', height: '100%', width: `${(doneCount / total) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--wk-oxblood)' }}>{doneCount} / {total} READY</span>
            </div>
          </footer>
        )
      }
    </article>
  );
}

function ItemRow({ item, orderId, stationLoad, hasPoolMatch }: {
  item: Item; orderId: string; stationLoad: number; hasPoolMatch: boolean;
}) {
  let rowBg     = 'transparent';
  let rowBorder = '1px solid transparent';
  if (item.state === 'Queued') { rowBg = 'rgba(248,228,125,0.38)'; rowBorder = `1px solid var(--wk-gold)`; }
  if (item.state === 'Hold')   { rowBorder = '1px dashed rgba(55,8,8,0.3)'; }

  const isDone = item.state === 'Ready';

  return (
    <div
      style={{
        padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid rgba(55,8,8,0.06)',
        opacity: item.state === 'Hold' ? 0.7 : 1,
        background: rowBg, border: rowBorder, borderRadius: 0,
      }}
    >
      {/* Item text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--wk-oxblood)' }}>{item.qty}×</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--wk-ink)', wordBreak: 'break-word', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.5 : 1 }}>
          {item.name}
        </div>
        {item.modifier && (
          <div style={{ fontSize: 9, fontStyle: 'italic', color: 'var(--wk-graphite)', paddingLeft: 8, marginTop: 1 }}>
            <span style={{ color: 'var(--wk-oxblood)' }}>♦ </span>{item.modifier}
          </div>
        )}
      </div>

      {/* Pool badge — shown when a matching pool item exists */}
      {hasPoolMatch && !isDone && (
        <span style={{
          fontSize: 7, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '2px 4px', borderRadius: 3,
          background: '#d97706', color: '#fff', flexShrink: 0,
        }}>↺ Grabs</span>
      )}

      {/* Status displays */}
      {item.state === 'Queued' && (
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--wk-graphite)', opacity: 0.7 }}>⏳ Queued</span>
      )}
      {item.state === 'Hold' && (
        <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>⏸ Hold</span>
      )}
      {item.state === 'Cooking' && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', marginBottom: 2 }}>🔥 Cooking</div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: 'var(--wk-ink)' }}>{fmtMSS(item.cookingElapsedSimSecs || 0)}</div>
        </div>
      )}
      {item.state === 'Ready' && (
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-green)', flexShrink: 0 }}>✓ Ready</span>
      )}
    </div>
  );
}

function SmBtn({ children, onClick, highlight }: { children: React.ReactNode; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      className={`wk-interactive ${highlight ? 'wk-suggest-hold' : ''}`}
      onClick={onClick}
      style={{
        padding: '3px 7px', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)',
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        cursor: 'pointer', background: 'transparent', color: 'var(--wk-oxblood)',
        fontFamily: 'var(--wk-font-ui)',
      }}
    >
      {children}
    </button>
  );
}

function PackedFooter({ order, rider, onHandover, onCallRider }: {
  order: Order; rider: Rider | undefined; onHandover: () => void; onCallRider: () => void;
}) {
  const isArrived = rider?.status === 'arrived';
  const riderMsg = rider
    ? isArrived ? `🟢 ${rider.name} HAS ARRIVED (Handover Complete)` : `🚴 ${rider.name} on the way — ${fmtMSS(rider.eta)} away`
    : '⏳ Waiting for rider assignment';

  return (
    <footer style={{ flexShrink: 0, borderTop: 'var(--wk-b)', background: 'var(--wk-linen)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--wk-oxblood)' }}>
          [Packed & Ready]
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, fontStyle: 'italic', color: isArrived ? 'var(--wk-green)' : 'var(--wk-graphite)' }}>
          {isArrived ? '✓ Picked Up' : '⏳ Awaiting Arrival'}
        </span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--wk-ink)' }}>
        {riderMsg}
      </div>

      {!isArrived && rider && (
        <button
          className="wk-interactive"
          onClick={onCallRider}
          style={{
            width: '100%', marginTop: 2, padding: '6px',
            background: '#fef3c7', border: '1px solid #d97706', borderRadius: 'var(--wk-r)',
            color: '#92400e', fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 10,
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer'
          }}
        >
          📢 Call Rider / Speed Up Arrival
        </button>
      )}
    </footer>
  );
}
