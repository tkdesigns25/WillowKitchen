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
  const activeRiders = riders.filter(r => r.orderId && orders[r.orderId]);

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--wk-vellum)', borderLeft: 'var(--wk-b)' }}>

      {/* ── Section 1 (Top): Packed & Waiting Orders ───────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', maxHeight: '35%', overflow: 'hidden', borderBottom: 'var(--wk-b)' }}>
        <div style={{
          flexShrink: 0, height: 'var(--wk-ch)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)' }}>
              Packed & Waiting
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

        <div className="wk-scroll" style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {packedOrders.length === 0 ? (
            <EmptyState icon="📦" text="No orders waiting" />
          ) : packedOrders.map(order => {
            const rider = riders.find(r => r.orderId === order.id);
            return (
              <div
                key={order.id}
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--wk-green)',
                  borderLeft: '4px solid var(--wk-green)',
                  borderRadius: 'var(--wk-r)',
                  background: 'rgba(30,107,58,0.06)',
                  display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--wk-oxblood)' }}>
                    Order #{ordNum(order.id)}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: 'var(--wk-green)', color: '#fff', textTransform: 'uppercase' }}>
                    ✓ Ready
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--wk-ink)', fontWeight: 600 }}>
                    {rider ? `🚴 ${rider.name} (${rider.status === 'arrived' ? 'Arrived' : `${fmtMSS(rider.eta)} away`})` : '⏳ Assigning Rider…'}
                  </div>
                  {rider && rider.status !== 'arrived' && (
                    <button
                      className="wk-interactive"
                      onClick={() => onCallRider(order.id)}
                      style={{ padding: '2px 6px', border: '1px solid #d97706', borderRadius: 3, background: '#fef3c7', color: '#92400e', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      📢 Call Rider
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2 (Middle): Riders Waiting (2 in a row) ────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', maxHeight: '35%', overflow: 'hidden', borderBottom: 'var(--wk-b)' }}>
        <div style={{
          flexShrink: 0, height: 'var(--wk-ch)',
          display: 'flex', alignItems: 'center', padding: '0 12px',
          borderBottom: 'var(--wk-b)', background: 'var(--wk-vellum)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)' }}>
            Riders Waiting
          </span>
        </div>
        <div className="wk-scroll" style={{ flex: 1, padding: '8px 10px' }}>
          {activeRiders.length === 0 ? (
            <EmptyState icon="🛵" text="No riders waiting" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {activeRiders.map(rider => (
                <RiderCard
                  key={rider.id}
                  rider={rider}
                  order={rider.orderId ? orders[rider.orderId] : null}
                  onCallRider={() => rider.orderId && onCallRider(rider.orderId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3 (Bottom): Ready Items Pool ──────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{
          flexShrink: 0, height: 'var(--wk-ch)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)' }}>
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

        <div className="wk-scroll" style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
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

// ── Rider Card (2 in a row) ────────────────────────────────────
function RiderCard({ rider, order, onCallRider }: {
  rider: Rider; order: Order | null; onCallRider: () => void;
}) {
  const isArrived = rider.status === 'arrived';
  const cardBorder = isArrived ? '1px solid var(--wk-green)' : 'var(--wk-b)';

  return (
    <div
      style={{
        padding: '6px 8px', border: cardBorder, borderRadius: 'var(--wk-r)',
        background: isArrived ? 'rgba(30,107,58,0.08)' : 'var(--wk-linen)',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rider.name}</span>
        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--wk-oxblood)' }}>{rider.platform[0]}</span>
      </div>

      <div style={{ fontSize: 9, color: isArrived ? 'var(--wk-green)' : 'var(--wk-graphite)', fontWeight: 600 }}>
        {isArrived ? '🟢 Arrived' : `🚴 ${fmtMSS(rider.eta)} away`}
      </div>

      {rider.orderId && (
        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--wk-ink)' }}>
          For #{ordNum(rider.orderId)}
        </div>
      )}

      {!isArrived && rider.orderId && (
        <button
          className="wk-interactive"
          onClick={onCallRider}
          style={{ marginTop: 2, padding: '2px 4px', border: '1px solid #d97706', borderRadius: 3, background: '#fef3c7', color: '#92400e', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center' }}
        >
          📢 Call Rider
        </button>
      )}
    </div>
  );
}
