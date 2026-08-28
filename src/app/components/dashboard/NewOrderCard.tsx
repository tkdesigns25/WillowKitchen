import React from 'react';
import type { Order } from './types';
import { fmtMSS, ordNum, getPlacedTime } from './config';
import { ChannelBadge } from './Dashboard';

interface CanceledStockEntry {
  id: string; name: string; qty: number; createdAtSimSecs: number;
}

interface Props {
  order: Order;
  oosItems: Record<string, boolean>;
  stationLoads: Record<string, number>;
  orders: Record<string, Order>;
  canceledStock: CanceledStockEntry[];
  currentSimSecs: number;
  onAccept: () => void;
  onReject: () => void;
}

export function NewOrderCard({ order, oosItems, stationLoads, orders, canceledStock, currentSimSecs, onAccept, onReject }: Props) {
  const secs = order.autoCancelSecs;
  const oos  = order.items.some(i => !!oosItems[i.name]);
  const isUrgent = secs <= 15;
  const isWarn   = secs <= 45;

  // Capacity warnings
  const stns = [...new Set(order.items.map(i => i.station || 'Hot'))];
  const capWarns = stns.filter(s => (stationLoads[s] || 0) >= 90).map(s => `${s} Station load is high`);

  // Prep Together matches (items already in kitchen queue/cooking matching this order)
  const incoming = new Set(order.items.map(i => i.name));
  const prepTogetherHits: Record<string, number> = {};
  Object.values(orders).forEach(o => {
    if (o.id === order.id) return; // skip self
    if (o.status === 'active' || o.status === 'new') {
      o.items.forEach(item => {
        if (incoming.has(item.name) && item.state !== 'Ready') {
          prepTogetherHits[item.name] = (prepTogetherHits[item.name] || 0) + item.qty;
        }
      });
    }
  });

  // Ready Items Pool matches
  const poolMatches = order.items.flatMap(item => {
    const match = canceledStock.find(c => c.name === item.name && c.qty >= item.qty);
    if (!match) return [];
    const ageMins = Math.floor((currentSimSecs - match.createdAtSimSecs) / 60);
    return [{ name: item.name, ageMins, matchId: match.id }];
  });

  // Timer color
  let timerBg = 'var(--wk-oxblood)';
  if (isUrgent) timerBg = 'var(--wk-red)';
  else if (isWarn) timerBg = 'var(--wk-gold)';
  const timerColor = isWarn && !isUrgent ? 'var(--wk-ink)' : 'var(--wk-vellum)';

  // Group items by station
  const itemsByStation: Record<string, typeof order.items> = {};
  order.items.forEach(item => {
    if (!itemsByStation[item.station]) itemsByStation[item.station] = [];
    itemsByStation[item.station].push(item);
  });

  return (
    <article
      className={`wk-glide-in wk-interactive ${isUrgent ? 'wk-sla-breach' : isWarn ? 'wk-sla-urgent' : ''}`}
      style={{
        width: '100%',
        flexShrink: 0,
        height: 'fit-content',
        background: 'var(--wk-vellum)',
        border: oos ? '2px solid var(--wk-gold)' : 'var(--wk-b)',
        borderRadius: 'var(--wk-r)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header row */}
      <header style={{ display: 'flex', alignItems: 'stretch', borderBottom: 'var(--wk-b)', flexShrink: 0 }}>
        {/* Left: order number + platform */}
        <div style={{ padding: '10px 12px', borderRight: 'var(--wk-b)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 96 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 2 }}>Order</div>
            <div className="wk-ordnum" style={{ fontSize: 26, color: 'var(--wk-oxblood)', lineHeight: 1 }}>{ordNum(order.id)}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 3 }}><ChannelBadge source={order.source} /></div>
            <div style={{ fontSize: 9, opacity: 0.8 }}>Placed {getPlacedTime(order.arrivedAt)}</div>
          </div>
        </div>

        {/* Right: timer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: timerBg, color: timerColor, padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, marginBottom: 3 }}>Accept in</div>
            <div className="wk-countdown" style={{ fontSize: 24, lineHeight: 1 }}>
              {fmtMSS(secs)}
            </div>
          </div>
        </div>
      </header>

      {/* Alert banners */}
      {oos && (
        <div style={{ padding: '5px 12px', background: '#fef08a', borderBottom: 'var(--wk-b)', fontSize: 10, fontWeight: 700, color: '#713f12' }}>
          ⚠️ Has out-of-stock items — check before starting
        </div>
      )}
      {capWarns.map((w, i) => (
        <div key={i} style={{ padding: '5px 12px', background: 'rgba(248,228,125,0.5)', borderBottom: 'var(--wk-b)', fontSize: 10, fontStyle: 'italic', color: 'var(--wk-ink)' }}>Note: {w}</div>
      ))}
      {Object.entries(prepTogetherHits).map(([name, qty]) => (
        <div key={name} style={{ padding: '5px 12px', background: 'rgba(30,107,58,0.08)', borderBottom: 'var(--wk-b)', fontSize: 10, fontWeight: 700, color: 'var(--wk-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--wk-green)', color: '#fff', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>Prep Together</span>
          <span>Opportunity: {qty}× <strong>{name}</strong> in kitchen queue</span>
        </div>
      ))}
      {poolMatches.map(m => (
        <div key={m.matchId} style={{ padding: '5px 12px', background: 'rgba(217,119,6,0.08)', borderBottom: 'var(--wk-b)', fontSize: 10, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#d97706', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>Grabs</span>
          <strong>{m.name}</strong> ready — made {m.ageMins}m ago
        </div>
      ))}

      {/* Customer info */}
      <div style={{ padding: '6px 12px', borderBottom: 'var(--wk-b)', background: 'rgba(240,231,215,0.3)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{order.customer}</span>
        {order.notes && <span style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.8 }}>"{order.notes}"</span>}
      </div>

      {/* Items by station */}
      <main style={{ overflow: 'visible' }}>
        {Object.entries(itemsByStation).map(([station, items]) => (
          <section key={station} style={{ borderBottom: 'var(--wk-b)' }}>
            <div style={{ background: 'var(--wk-linen)', padding: '3px 12px', borderBottom: '1px solid rgba(55,8,8,0.1)' }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--wk-oxblood)' }}>{station} Station</span>
            </div>
            {items.map(item => {
              const poolMatch = poolMatches.find(m => m.name === item.name);
              const prepMatch = prepTogetherHits[item.name];
              return (
                <div key={item.id} style={{ padding: '6px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid rgba(55,8,8,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-oxblood)', flexShrink: 0, minWidth: 18 }}>{item.qty}×</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--wk-ink)', wordBreak: 'break-word' }}>{item.name}</div>
                    {item.modifier && (
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--wk-graphite)', paddingLeft: 10, marginTop: 1 }}>
                        <span style={{ color: 'var(--wk-oxblood)' }}>♦ </span>{item.modifier}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    {prepMatch && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '2px 5px', borderRadius: 3,
                        background: 'var(--wk-green)', color: '#fff',
                      }}>Prep Together</span>
                    )}
                    {poolMatch && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '2px 5px', borderRadius: 3,
                        background: '#d97706', color: '#fff',
                      }}>↺ Up for Grabs</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>

      {/* Actions */}
      <footer style={{ display: 'flex', flexShrink: 0, borderTop: 'var(--wk-b)', height: 40 }}>
        <button
          className="wk-interactive"
          onClick={onAccept}
          style={{ flex: 3, background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', border: 'none', fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          ✓ Start This Order
        </button>
        <button
          className="wk-interactive"
          onClick={onReject}
          style={{ flex: 2, background: 'transparent', color: 'var(--wk-oxblood)', border: 'none', borderLeft: 'var(--wk-b)', fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          ✕ Decline
        </button>
      </footer>
    </article>
  );
}
