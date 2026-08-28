import React from 'react';
import type { Order, Rider } from './types';
import { STATIONS, fmtMSS, ordNum } from './config';
import { EmptyState } from './Dashboard';

interface CanceledStockEntry {
  id: string; name: string; qty: number; createdAtSimSecs: number; canceledBy?: 'Customer' | 'Kitchen';
}

interface Props {
  canceledStock: CanceledStockEntry[];
  currentSimSecs: number;
  orders: Record<string, Order>;
  packedOrders: Order[];
  riders: Rider[];
  onRiderHandover: (riderId: string) => void;
  onCallRider: (orderId: string) => void;
}

// 30 min = 1800 sim-secs
const POOL_EXPIRY_SECS = 1800;

export function Column4({ canceledStock, currentSimSecs, orders, packedOrders, riders, onRiderHandover, onCallRider }: Props) {
  // ONLY show riders who have physically arrived at the kitchen while their order is still cooking
  const arrivedRiders = riders.filter(r => r.orderId && orders[r.orderId]?.status === 'active' && r.status === 'arrived');

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--wk-vellum)', height: '100%' }}>

      {/* ── TOP HALF (50%): Divided equally between Packed & Waiting and Riders Waiting ── */}
      <div style={{ flex: '1 1 50%', height: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: 'var(--wk-b)' }}>

        {/* ── Sub-Section 1 (Top 25%): Packed & Waiting Orders (2-Column Grid Layout) ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: 'var(--wk-b)' }}>
          <div style={{
            flexShrink: 0, height: 'var(--wk-ch)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 14px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>
                Packed &amp; Waiting
              </span>
              {packedOrders.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 16, padding: '0 4px',
                  background: 'var(--wk-green)', color: '#fff',
                  borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 700,
                }}>
                  {packedOrders.length}
                </span>
              )}
            </div>
          </div>

          <div className="wk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
            {packedOrders.length === 0 ? (
              <EmptyState icon="📦" text="No orders waiting" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {packedOrders.map(order => {
                  const rider = riders.find(r => r.orderId === order.id);
                  return (
                    <div
                      key={order.id}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid var(--wk-green)',
                        borderLeft: '3px solid var(--wk-green)',
                        borderRadius: 'var(--wk-r)',
                        background: 'rgba(30,107,58,0.06)',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--wk-oxblood)' }}>
                          #{ordNum(order.id)}
                        </span>
                        <span style={{ fontSize: 7.5, fontWeight: 800, padding: '1px 4px', borderRadius: 3, background: 'var(--wk-green)', color: '#fff', textTransform: 'uppercase' }}>
                          ✓ Ready
                        </span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--wk-ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rider ? `🚴 ${rider.name}` : '⏳ Assigning…'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <span style={{ fontSize: 8, color: 'var(--wk-graphite)', fontWeight: 700 }}>
                          {rider ? (rider.status === 'arrived' ? '🟢 Arrived' : `${fmtMSS(rider.eta)} away`) : 'Finding rider'}
                        </span>
                        {rider && rider.status !== 'arrived' && (
                          <button
                            className="wk-interactive"
                            onClick={() => onCallRider(order.id)}
                            style={{ padding: '1px 4px', border: '1px solid #d97706', borderRadius: 3, background: '#fef3c7', color: '#92400e', fontSize: 7.5, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            📢 Call
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sub-Section 2 (Bottom 25%): Riders Waiting (2-Column Grid Layout) ──── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            flexShrink: 0, height: 'var(--wk-ch)',
            display: 'flex', alignItems: 'center', padding: '0 14px',
            borderBottom: 'var(--wk-b)', background: 'var(--wk-vellum)',
            boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>
              Riders Waiting
            </span>
            {arrivedRiders.length > 0 && (
              <span style={{
                marginLeft: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 16, padding: '0 4px',
                background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)',
                borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 700,
              }}>
                {arrivedRiders.length}
              </span>
            )}
          </div>
          <div className="wk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
            {arrivedRiders.length === 0 ? (
              <EmptyState icon="🛵" text="No riders waiting at store" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {arrivedRiders.map(rider => (
                  <RiderCard
                    key={rider.id}
                    rider={rider}
                    order={rider.orderId ? orders[rider.orderId] : null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── BOTTOM HALF (50%): Fully Allocated for Up for Grabs ─────── */}
      <div style={{ flex: '1 1 50%', height: '50%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          flexShrink: 0, height: 'var(--wk-ch)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)',
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>
              Up for Grabs
            </span>
            {canceledStock.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 16, padding: '0 4px',
                background: '#d97706', color: '#fff',
                borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 700,
              }}>
                {canceledStock.length}
              </span>
            )}
          </div>
          <span style={{ fontSize: 9, color: 'var(--wk-graphite)', opacity: 0.6, fontStyle: 'italic' }}>30 min hold</span>
        </div>

        <div className="wk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {canceledStock.length === 0 ? (
            <EmptyState icon="♻" text="No items up for grabs" />
          ) : canceledStock.map(entry => {
            const ageSimSecs = currentSimSecs - entry.createdAtSimSecs;
            const remaining  = Math.max(0, POOL_EXPIRY_SECS - ageSimSecs);
            const ageMins    = Math.floor(ageSimSecs / 60);
            const pct        = remaining / POOL_EXPIRY_SECS;

            const isExpiring = pct < 0.2;
            const isMidLife  = pct < 0.5;
            const barColor   = isExpiring ? 'var(--wk-red)' : isMidLife ? '#d97706' : 'var(--wk-green)';
            const borderColor = isExpiring ? 'var(--wk-red)' : isMidLife ? '#d97706' : 'rgba(55,8,8,0.15)';

            const station = STATIONS.find(s =>
              Object.values(orders).some(o =>
                o.items.some(i => i.name === entry.name && i.station === s)
              )
            ) ?? 'Kitchen';

            const canceledByLabel = entry.canceledBy === 'Customer' ? 'Cancelled by Customer' : 'Cancelled by Kitchen';

            return (
              <div
                key={entry.id}
                style={{
                  padding: '6px 8px',
                  border: `1px solid ${borderColor}`,
                  borderLeft: `3px solid ${barColor}`,
                  borderRadius: 'var(--wk-r)',
                  background: isExpiring ? 'rgba(185,28,28,0.04)' : 'var(--wk-linen)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.qty}× {entry.name}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(55,8,8,0.07)', color: 'var(--wk-graphite)' }}>
                    {station}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: entry.canceledBy === 'Customer' ? 'var(--wk-red)' : 'var(--wk-graphite)' }}>
                    {canceledByLabel} ({ageMins}m ago)
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: barColor }}>Expires {fmtMSS(remaining)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </aside>
  );
}

// ── Rider Card (In the Riders Waiting section — 2-column layout) ─────
function RiderCard({ rider, order }: {
  rider: Rider; order: Order | null;
}) {
  const platformLabel = (rider.platform === 'DirectApp' || rider.platform === 'Own App') ? 'App' : rider.platform;
  const platformColor = platformLabel === 'Swiggy' ? '#c2410c' : platformLabel === 'Zomato' ? '#b91c1c' : '#6d28d9';
  const platformBg = platformLabel === 'Swiggy' ? 'rgba(252,128,25,0.12)' : platformLabel === 'Zomato' ? 'rgba(226,55,68,0.12)' : 'rgba(109,40,217,0.12)';

  return (
    <div
      style={{
        padding: '6px 8px',
        border: '1px solid var(--wk-green)',
        borderRadius: 'var(--wk-r)',
        background: 'rgba(30,107,58,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rider.name}
        </span>
        <span style={{
          fontSize: 7.5,
          fontWeight: 800,
          padding: '1px 4px',
          borderRadius: 3,
          background: platformBg,
          color: platformColor,
          border: `1px solid ${platformColor}`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {platformLabel}
        </span>
      </div>

      <div style={{ fontSize: 9, color: 'var(--wk-green)', fontWeight: 700 }}>
        🟢 Arrived
      </div>

      {rider.orderId && (
        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--wk-ink)' }}>
          For #{ordNum(rider.orderId)}
        </div>
      )}
    </div>
  );
}
