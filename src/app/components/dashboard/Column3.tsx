import React, { useRef } from 'react';
import type { Order, Item } from './types';
import { STATIONS, fmtMSS, ordNum } from './config';

interface Props {
  orders: Record<string, Order>;
  stationLoads: Record<string, number>;
  onStartItem: (orderId: string, itemId: string) => void;
  onHoldItem: (orderId: string, itemId: string) => void;
  onGroupPrep: (name: string, station: string) => void;
  onMoveUp: (orderId: string, itemIds: string | string[]) => void;
  onMoveDown: (orderId: string, itemIds: string | string[]) => void;
  onReorder: (draggedItemIds: string | string[], targetItemId: string, station: string) => void;
  getGroupPrepCandidates: (station: string) => Array<{name: string; totalQty: number; items: any[]}>;
}

type QueueEntry = 
  | { type: 'single'; order: Order; item: Item }
  | { type: 'group-prep'; name: string; totalQty: number; station: string; items: Array<{order: Order; item: Item}>; primaryItem: Item }
  | { type: 'group-cooking'; name: string; totalQty: number; station: string; items: Array<{order: Order; item: Item}>; primaryItem: Item };

export function Column3(props: Props) {
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--wk-vellum)', borderRight: 'var(--wk-b)' }}>
      {/* Station Queues Header */}
      <div style={{ flexShrink: 0, height: 'var(--wk-ch)', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: 'var(--wk-b)', background: 'var(--wk-vellum)', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>Station Queues</span>
      </div>

      {/* 3 Fixed Equal Station Zones (Hot, Grill, Assembly) */}
      <div style={{ flex: 1, minHeight: 0, padding: '10px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', boxSizing: 'border-box' }}>
        {STATIONS.map(stn => (
          <StationQueue
            key={stn}
            station={stn}
            orders={props.orders}
            stationLoad={props.stationLoads[stn] || 0}
            onStartItem={props.onStartItem}
            onHoldItem={props.onHoldItem}
            onGroupPrep={props.onGroupPrep}
            onMoveUp={props.onMoveUp}
            onMoveDown={props.onMoveDown}
            onReorder={props.onReorder}
          />
        ))}
      </div>
    </aside>
  );
}

// ── Station Queue ──────────────────────────────────────────────
function StationQueue({ station, orders, stationLoad, onStartItem, onHoldItem, onGroupPrep, onMoveUp, onMoveDown, onReorder }: {
  station: string;
  orders: Record<string, Order>;
  stationLoad: number;
  onStartItem: (orderId: string, itemId: string) => void;
  onHoldItem: (orderId: string, itemId: string) => void;
  onGroupPrep: (name: string, station: string) => void;
  onMoveUp: (orderId: string, itemIds: string | string[]) => void;
  onMoveDown: (orderId: string, itemIds: string | string[]) => void;
  onReorder: (draggedItemIds: string | string[], targetItemId: string, station: string) => void;
}) {
  const isOver = stationLoad >= 90;
  const dragRef = useRef<{itemIds: string[]; station: string} | null>(null);

  // Collect raw active items for this station
  const rawItems: Array<{order: Order; item: Item}> = [];
  Object.values(orders).forEach(o => {
    if (o.status !== 'active') return;
    o.items.forEach(item => {
      if ((item.state === 'Queued' || item.state === 'Cooking' || item.state === 'Hold') && item.station === station) {
        rawItems.push({ order: o, item });
      }
    });
  });

  // Sort raw items: Cooking ALWAYS on top (0), then Queued (1), then Hold (2)
  const stateOrder: Record<string, number> = { Cooking: 0, Queued: 1, Hold: 2 };
  rawItems.sort((a, b) => {
    const sA = stateOrder[a.item.state] ?? 99;
    const sB = stateOrder[b.item.state] ?? 99;
    if (sA !== sB) return sA - sB;
    return a.item.queuePriority - b.item.queuePriority;
  });

  // Build queue entries
  const queueEntries: QueueEntry[] = [];
  const processedItemIds = new Set<string>();

  rawItems.forEach(entry => {
    if (processedItemIds.has(entry.item.id)) return;

    if (entry.item.state === 'Cooking') {
      const cookingMatches = rawItems.filter(x => !processedItemIds.has(x.item.id) && x.item.state === 'Cooking' && x.item.name === entry.item.name);
      if (cookingMatches.length >= 2) {
        const totalQty = cookingMatches.reduce((sum, x) => sum + x.item.qty, 0);
        cookingMatches.forEach(x => processedItemIds.add(x.item.id));
        queueEntries.push({
          type: 'group-cooking',
          name: entry.item.name,
          totalQty,
          station,
          items: cookingMatches,
          primaryItem: entry.item,
        });
      } else {
        queueEntries.push({ type: 'single', order: entry.order, item: entry.item });
        processedItemIds.add(entry.item.id);
      }
    } else {
      const nonCookingMatches = rawItems.filter(x => !processedItemIds.has(x.item.id) && x.item.state !== 'Cooking' && x.item.name === entry.item.name);
      if (nonCookingMatches.length >= 2) {
        const totalQty = nonCookingMatches.reduce((sum, x) => sum + x.item.qty, 0);
        nonCookingMatches.forEach(x => processedItemIds.add(x.item.id));
        queueEntries.push({
          type: 'group-prep',
          name: entry.item.name,
          totalQty,
          station,
          items: nonCookingMatches,
          primaryItem: entry.item,
        });
      } else {
        queueEntries.push({ type: 'single', order: entry.order, item: entry.item });
        processedItemIds.add(entry.item.id);
      }
    }
  });

  const isEmpty = queueEntries.length === 0;

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      background: 'var(--wk-linen)',
      border: 'var(--wk-b)',
      borderRadius: 'var(--wk-r)',
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Station Title Header */}
      <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wk-graphite)', borderBottom: 'var(--wk-b)', paddingBottom: 4, marginBottom: 4 }}>
        {station} Station
      </div>

      {/* Dedicated Inner Scrollable Area */}
      <div className="wk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
        {isEmpty ? (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wk-graphite)', textAlign: 'center', padding: '12px 0', opacity: 0.5 }}>Queue is empty</div>
        ) : queueEntries.map((entry, idx) => {

          // ── GROUP COOKING BOX (Items Cooking Together) ────────
          if (entry.type === 'group-cooking') {
            const { name, totalQty, items, primaryItem } = entry;
            const orderTags = items.map(x => `#${ordNum(x.order.id)}`).join(', ');
            const allIds = items.map(x => x.item.id);
            const avgElapsed = Math.floor(items.reduce((s, x) => s + (x.item.cookingElapsedSimSecs || 0), 0) / items.length);

            return (
              <div
                key={`group-cooking-${name}`}
                className="wk-queue-card wk-interactive"
                draggable={true}
                data-item-id={primaryItem.id}
                data-station={station}
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ itemIds: allIds, itemId: primaryItem.id, station }));
                  dragRef.current = { itemIds: allIds, station };
                  (e.currentTarget as HTMLElement).classList.add('dragging');
                }}
                onDragEnd={e => {
                  (e.currentTarget as HTMLElement).classList.remove('dragging');
                  document.querySelectorAll('.wk-queue-card').forEach(el => el.classList.remove('drag-over'));
                }}
                onDragOver={e => {
                  e.preventDefault();
                  if (dragRef.current?.station === station) (e.currentTarget as HTMLElement).classList.add('drag-over');
                }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).classList.remove('drag-over'); }}
                onDrop={e => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).classList.remove('drag-over');
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.station === station) {
                      onReorder(data.itemIds || [data.itemId], primaryItem.id, station);
                    }
                  } catch (_) {}
                }}
                style={{
                  padding: '8px 10px',
                  border: '2px solid #d97706',
                  borderRadius: 'var(--wk-r)',
                  background: 'rgba(217,119,6,0.08)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  cursor: 'grab',
                  userSelect: 'none',
                  boxShadow: '0 2px 6px rgba(217,119,6,0.12)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(217,119,6,0.3)', paddingBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    🔥 COOKING TOGETHER ({totalQty}×)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 800, color: '#b45309' }}>
                      {fmtMSS(avgElapsed)}
                    </span>
                    {idx > 0 && (
                      <button
                        className="wk-interactive"
                        onClick={e => { e.stopPropagation(); onMoveUp(items[0].order.id, allIds); }}
                        title="Move Up"
                        style={{ padding: '2px 4px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-vellum)', fontSize: 8, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                      >▲</button>
                    )}
                    {idx < queueEntries.length - 1 && (
                      <button
                        className="wk-interactive"
                        onClick={e => { e.stopPropagation(); onMoveDown(items[0].order.id, allIds); }}
                        title="Move Down"
                        style={{ padding: '2px 4px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-vellum)', fontSize: 8, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                      >▼</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--wk-ink)' }}>
                      {totalQty}× {name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--wk-graphite)', marginTop: 2, fontWeight: 600 }}>
                      Orders: <span style={{ color: 'var(--wk-oxblood)' }}>{orderTags}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {items.map(x => (
                      <button
                        key={x.item.id}
                        className="wk-interactive"
                        onClick={e => { e.stopPropagation(); onHoldItem(x.order.id, x.item.id); }}
                        style={{ padding: '3px 6px', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', fontSize: 8, fontWeight: 700, cursor: 'pointer', background: '#fff', color: 'var(--wk-oxblood)', fontFamily: 'var(--wk-font-ui)', textTransform: 'uppercase' }}
                        title={`Hold #${ordNum(x.order.id)}`}
                      >Hold #{ordNum(x.order.id)}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // ── GROUP PREP UNIT (Candidates for Prep Together) ─────
          if (entry.type === 'group-prep') {
            const { name, totalQty, items, primaryItem } = entry;
            const orderTags = items.map(x => `#${ordNum(x.order.id)}`).join(', ');
            const allIds = items.map(x => x.item.id);

            return (
              <div
                key={`group-prep-${name}`}
                className="wk-queue-card wk-interactive"
                draggable={true}
                data-item-id={primaryItem.id}
                data-station={station}
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ itemIds: allIds, itemId: primaryItem.id, station }));
                  dragRef.current = { itemIds: allIds, station };
                  (e.currentTarget as HTMLElement).classList.add('dragging');
                }}
                onDragEnd={e => {
                  (e.currentTarget as HTMLElement).classList.remove('dragging');
                  document.querySelectorAll('.wk-queue-card').forEach(el => el.classList.remove('drag-over'));
                }}
                onDragOver={e => {
                  e.preventDefault();
                  if (dragRef.current?.station === station) (e.currentTarget as HTMLElement).classList.add('drag-over');
                }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).classList.remove('drag-over'); }}
                onDrop={e => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).classList.remove('drag-over');
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.station === station) {
                      onReorder(data.itemIds || [data.itemId], primaryItem.id, station);
                    }
                  } catch (_) {}
                }}
                style={{
                  padding: '8px 10px',
                  border: '2px dashed var(--wk-green)',
                  borderLeft: '4px solid var(--wk-green)',
                  borderRadius: 'var(--wk-r)',
                  background: 'linear-gradient(135deg, rgba(30,107,58,0.08) 0%, rgba(248,228,125,0.18) 100%)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  cursor: 'grab',
                  userSelect: 'none',
                  boxShadow: '0 1px 4px rgba(30,107,58,0.15)',
                  flexShrink: 0,
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'var(--wk-green)', color: '#fff' }}>
                        PREP TOGETHER
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--wk-ink)' }}>
                        {totalQty}× {name}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--wk-graphite)', marginTop: 2, fontWeight: 600 }}>
                      Orders: <span style={{ color: 'var(--wk-oxblood)' }}>{orderTags}</span>
                    </div>
                  </div>

                  {/* Actions: Move group up/down and bulk prep button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {idx > 0 && (
                      <button
                        className="wk-interactive"
                        onClick={e => { e.stopPropagation(); onMoveUp(items[0].order.id, allIds); }}
                        title="Move Up Unit"
                        style={{ padding: '3px 5px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-vellum)', fontSize: 9, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                      >▲</button>
                    )}
                    {idx < queueEntries.length - 1 && (
                      <button
                        className="wk-interactive"
                        onClick={e => { e.stopPropagation(); onMoveDown(items[0].order.id, allIds); }}
                        title="Move Down Unit"
                        style={{ padding: '3px 5px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-vellum)', fontSize: 9, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                      >▼</button>
                    )}
                    <button
                      className="wk-interactive"
                      onClick={e => { e.stopPropagation(); onGroupPrep(name, station); }}
                      style={{ padding: '4px 8px', border: 'none', borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 800, cursor: 'pointer', background: 'var(--wk-green)', color: '#fff', fontFamily: 'var(--wk-font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                    >
                      Prep Together
                    </button>
                  </div>
                </div>

                {/* Individual sub-items row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px dashed rgba(30,107,58,0.25)' }}>
                  {items.map(sub => (
                    <div
                      key={sub.item.id}
                      draggable={true}
                      onDragStart={e => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', JSON.stringify({ itemIds: [sub.item.id], itemId: sub.item.id, station }));
                        dragRef.current = { itemIds: [sub.item.id], station };
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', padding: '3px 6px', borderRadius: 3, cursor: 'grab' }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--wk-ink)' }}>
                        #{ordNum(sub.order.id)} ({sub.item.qty}×)
                      </span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button
                          className="wk-interactive"
                          onClick={e => { e.stopPropagation(); onStartItem(sub.order.id, sub.item.id); }}
                          style={{ padding: '2px 5px', border: 'var(--wk-b)', borderRadius: 3, fontSize: 8, fontWeight: 700, cursor: 'pointer', background: 'var(--wk-vellum)', color: 'var(--wk-oxblood)' }}
                        >Prep</button>
                        <button
                          className="wk-interactive"
                          onClick={e => { e.stopPropagation(); onHoldItem(sub.order.id, sub.item.id); }}
                          style={{ padding: '2px 5px', border: 'var(--wk-b)', borderRadius: 3, fontSize: 8, fontWeight: 700, cursor: 'pointer', background: 'var(--wk-vellum)', color: 'var(--wk-graphite)' }}
                        >Hold</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // ── SINGLE ITEM CARD (Cooking / Queued / Hold) ────────
          const { order, item } = entry;
          const isCooking = item.state === 'Cooking';
          const isHold    = item.state === 'Hold';

          const accentBorderLeft: string | undefined = isCooking
            ? '4px solid #d97706'
            : isHold
            ? '3px solid #3b82f6'
            : undefined;

          const bgTint = isCooking
            ? 'rgba(217,119,6,0.1)'
            : isHold
            ? 'rgba(59,130,246,0.07)'
            : 'var(--wk-vellum)';

          return (
            <div
              key={item.id}
              className="wk-queue-card wk-interactive"
              draggable={true}
              data-item-id={item.id}
              data-station={station}
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ itemIds: [item.id], itemId: item.id, station }));
                dragRef.current = { itemIds: [item.id], station };
                (e.currentTarget as HTMLElement).classList.add('dragging');
              }}
              onDragEnd={e => {
                (e.currentTarget as HTMLElement).classList.remove('dragging');
                document.querySelectorAll('.wk-queue-card').forEach(el => el.classList.remove('drag-over'));
              }}
              onDragOver={e => {
                e.preventDefault();
                if (dragRef.current?.station === station) (e.currentTarget as HTMLElement).classList.add('drag-over');
              }}
              onDragLeave={e => { (e.currentTarget as HTMLElement).classList.remove('drag-over'); }}
              onDrop={e => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).classList.remove('drag-over');
                try {
                  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                  if (data.station === station) {
                    onReorder(data.itemIds || [data.itemId], item.id, station);
                  }
                } catch (_) {}
              }}
              style={{
                padding: '6px 8px',
                border: 'var(--wk-b)',
                ...(accentBorderLeft ? { borderLeft: accentBorderLeft } : {}),
                borderRadius: 'var(--wk-r)',
                background: bgTint,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5,
                cursor: 'grab',
                userSelect: 'none',
                opacity: isHold ? 0.85 : 1,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--wk-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.qty}× {item.name}
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '2px 5px', borderRadius: 3,
                    background: isCooking ? '#d97706' : isHold ? '#3b82f6' : 'var(--wk-linen)',
                    color: (isCooking || isHold) ? '#fff' : 'var(--wk-graphite)',
                    border: (isCooking || isHold) ? 'none' : 'var(--wk-b)'
                  }}>
                    {isCooking ? '🔥 Cooking' : isHold ? '⏸ Hold' : '⏳ Queued'}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--wk-graphite)', marginTop: 1 }}>
                  [#{ordNum(order.id)}] {isCooking ? `Timer: ${fmtMSS(item.cookingElapsedSimSecs || 0)}` : `Due in: ${fmtMSS(order.slaSecsRemaining)}`}
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {idx > 0 && (
                  <button
                    className="wk-interactive"
                    onClick={e => { e.stopPropagation(); onMoveUp(order.id, item.id); }}
                    title="Move Up"
                    style={{ padding: '2px 4px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-linen)', fontSize: 9, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                  >▲</button>
                )}
                {idx < queueEntries.length - 1 && (
                  <button
                    className="wk-interactive"
                    onClick={e => { e.stopPropagation(); onMoveDown(order.id, item.id); }}
                    title="Move Down"
                    style={{ padding: '2px 4px', border: 'var(--wk-b)', borderRadius: 3, background: 'var(--wk-linen)', fontSize: 9, fontWeight: 700, cursor: 'pointer', color: 'var(--wk-ink)' }}
                  >▼</button>
                )}
                {!isCooking && (
                  <button
                    className="wk-interactive"
                    onClick={e => { e.stopPropagation(); onStartItem(order.id, item.id); }}
                    style={{ padding: '3px 6px', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'var(--wk-oxblood)', fontFamily: 'var(--wk-font-ui)', textTransform: 'uppercase' }}
                  >Prep</button>
                )}
                {!isHold && (
                  <button
                    className={`wk-interactive ${isOver ? 'wk-suggest-hold' : ''}`}
                    onClick={e => { e.stopPropagation(); onHoldItem(order.id, item.id); }}
                    style={{ padding: '3px 6px', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)', fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'var(--wk-oxblood)', fontFamily: 'var(--wk-font-ui)', textTransform: 'uppercase' }}
                  >Hold</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
