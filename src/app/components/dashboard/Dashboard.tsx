import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Order, Item } from './types';
import {
  CFG, BRANDS, ITEM_BRAND,
  makeId, makeItem, makeOrder, createInitialState, deepClone,
  fmtMSS, ordNum,
  pickCustomer, pickNote, pickRiderName, randomColor,
  safeStorageSet,
} from './config';
import { playSound } from './audio';
import { DashboardHeader } from './Header';
import { NewOrderCard } from './NewOrderCard';
import { ActiveOrderCard } from './ActiveOrderCard';
import { Column3 } from './Column3';
import { Column4 } from './Column4';
import { DashboardModals } from './Modals';
import { UndoToast } from './UndoToast';

// ── Helpers ────────────────────────────────────────────────────
function getGroupPrepCandidates(station: string, orders: Record<string, Order>) {
  const map: Record<string, Array<{orderId: string; item: Item; sla: number}>> = {};
  Object.values(orders).forEach(o => {
    if (o.status !== 'active') return;
    o.items.forEach(item => {
      if ((item.state === 'Queued' || item.state === 'Hold') && item.station === station) {
        if (!map[item.name]) map[item.name] = [];
        map[item.name].push({ orderId: o.id, item, sla: o.slaSecsRemaining });
      }
    });
  });
  return Object.entries(map)
    .filter(([, list]) => {
      if (list.length < 2) return false;
      const slas = list.map(x => x.sla);
      return Math.max(...slas) - Math.min(...slas) <= 300;
    })
    .map(([name, list]) => ({ name, totalQty: list.reduce((s, x) => s + x.item.qty, 0), items: list }));
}

function updateCapacity(state: AppState) {
  const counts: Record<string, number> = { 'Hot': 0, 'Grill': 0, 'Assembly': 0 };
  Object.values(state.orders).forEach(o => {
    if (o.status === 'active') {
      o.items.forEach(item => {
        if (item.state === 'Cooking' || item.state === 'Queued') {
          counts[item.station] = (counts[item.station] || 0) + item.qty;
        }
      });
    }
  });
  const MAX = CFG.MAX_STATION_ITEMS;
  state.stationLoads = {
    'Hot':      Math.min(100, (counts['Hot']      / MAX) * 100),
    'Grill':    Math.min(100, (counts['Grill']    / MAX) * 100),
    'Assembly': Math.min(100, (counts['Assembly'] / MAX) * 100),
  };
  Object.keys(state.stationLoads).forEach(stn => {
    if (state.stationLoads[stn] > (state.shiftStats.peakLoad[stn] || 0)) {
      state.shiftStats.peakLoad[stn] = state.stationLoads[stn];
    }
  });
  const anyOver = Object.values(state.stationLoads).some(l => l >= 90);
  if (anyOver) {
    if (!state.throttleStart) state.throttleStart = Date.now();
    else if (Date.now() - state.throttleStart >= CFG.THROTTLE_TRIGGER_SECS * 1000) {
      state.throttleActive = true;
    }
  } else if (Object.values(state.stationLoads).every(l => l < 70)) {
    state.throttleActive = false;
    state.throttleStart  = null;
  }
}


// ── Main Willow Kitchen Component ─────────────────────────────────────────
export function Dashboard() {
  const stateRef = useRef<AppState>(null!);
  if (!stateRef.current) {
    stateRef.current = createInitialState();
  }
  const [, setVersion] = useState(0);
  const update = useCallback(() => setVersion(v => v + 1), []);

  // Modal visibility via clean useState (not mixed into the mutable ref)
  const [showNewOrder,    setShowNewOrder]    = useState(false);
  const [showPause,       setShowPause]       = useState(false);
  const [showMenu,        setShowMenu]        = useState(false);
  const [undoLabel,       setUndoLabel]       = useState('');
  const [showPoolConfirm, setShowPoolConfirm] = useState(false);
  const [poolConfirmItems, setPoolConfirmItems] = useState<Array<{name: string; ageMins: number; matchId: string}>>([]);
  const pendingAcceptOrderId = React.useRef<string | null>(null);
  const orderArrivalRealTimestampsRef = React.useRef<number[]>([]);

  const s = stateRef.current; // convenient alias for reading state in render

  // ── Action Functions ──────────────────────────────────────────

  function nextOrderId(): string {
    stateRef.current.orderCounter++;
    return `ORD-${String(stateRef.current.orderCounter).padStart(4, '0')}`;
  }

  function pushUndo(label: string, restore: () => void) {
    const state = stateRef.current;
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoEntry = restore;
    state.undoTimer = setTimeout(() => {
      stateRef.current.undoEntry = null;
      setUndoLabel('');
      update();
    }, CFG.UNDO_WINDOW_MS);
    setUndoLabel(label);
    update();
  }

  function executeUndo() {
    const state = stateRef.current;
    if (!state.undoEntry) return;
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoEntry();
    state.undoEntry = null;
    setUndoLabel('');
    update();
  }

  function assignRider(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order || order.riderId) return;

    let rider = state.riders.find(r => !r.orderId && r.platform === order.source);
    if (!rider) rider = state.riders.find(r => !r.orderId);
    if (!rider) {
      const platforms: Record<string, string> = { Swiggy: 'Swiggy', Zomato: 'Zomato' };
      rider = {
        id: `RD-${String(state.riders.length + 1).padStart(3, '0')}`,
        name: pickRiderName(),
        platform: platforms[order.source] || order.source,
        orderId: null,
        tag: `Tag: ${randomColor()}-${Math.floor(Math.random() * 9) + 1}`,
        eta: 0,
        status: 'transit',
        waitSecs: 0,
      };
      state.riders.push(rider);
    }

    // Realistic ETA distribution:
    // ~35% arrive quickly / already outside (15–40s) -> quickly enters Riders Waiting at store
    // ~45% normal transit (50–110s)
    // ~20% far transit (130–220s)
    const roll = Math.random();
    const etaSecs = roll < 0.35
      ? Math.floor(Math.random() * 25) + 15
      : roll < 0.80
        ? Math.floor(Math.random() * 60) + 50
        : Math.floor(Math.random() * 90) + 130;

    rider.orderId  = orderId;
    rider.status   = 'transit';
    rider.eta      = etaSecs;
    rider.waitSecs = 0;
    order.riderId  = rider.id;
    order.riderStatus = 'transit';
    order.riderEta = rider.eta;
  }

  function acceptOrderCore(orderId: string, state: AppState) {
    const order = state.orders[orderId];
    if (!order) return;
    order.status             = 'active';
    order.acceptedAt         = Date.now();
    order.elapsedPrepSimSecs = 0;
    order.items.forEach(item => {
      const match = state.canceledStock.find(c => c.name === item.name && c.qty >= item.qty);
      if (match) {
        const idx = state.canceledStock.indexOf(match);
        if (match.qty > item.qty) match.qty -= item.qty;
        else state.canceledStock.splice(idx, 1);
        item.state = 'Ready';
      } else {
        item.state = 'Queued';
      }
      item.cookingElapsedSimSecs = 0;
      item.queuePriority = Date.now() + Math.random();
    });
    assignRider(orderId);
  }

  function acceptOrder(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order || order.status !== 'new') return;

    // Check for Ready Items Pool matches
    const poolMatches = order.items.flatMap(item => {
      const match = state.canceledStock.find(c => c.name === item.name && c.qty >= item.qty);
      if (!match) return [];
      const ageMins = Math.floor((state.currentSimSecs - match.createdAtSimSecs) / 60);
      return [{ name: item.name, ageMins, matchId: match.id }];
    });

    if (poolMatches.length > 0) {
      // Pause and ask: Use Pool Items or Cook Fresh?
      pendingAcceptOrderId.current = orderId;
      setPoolConfirmItems(poolMatches);
      setShowPoolConfirm(true);
    } else {
      acceptOrderCore(orderId, state);
      update();
    }
  }

  function handlePoolAcceptUseItems() {
    const orderId = pendingAcceptOrderId.current;
    if (!orderId) return;
    pendingAcceptOrderId.current = null;
    setShowPoolConfirm(false);
    setPoolConfirmItems([]);
    // acceptOrderCore already auto-consumes canceledStock matches
    acceptOrderCore(orderId, stateRef.current);
    update();
  }

  function handlePoolAcceptCookFresh() {
    const orderId = pendingAcceptOrderId.current;
    if (!orderId) return;
    pendingAcceptOrderId.current = null;
    setShowPoolConfirm(false);
    setPoolConfirmItems([]);
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;
    // Cook fresh: move items to Queued state, skip pool consumption
    order.status             = 'active';
    order.acceptedAt         = Date.now();
    order.elapsedPrepSimSecs = 0;
    order.items.forEach(item => {
      item.state                 = 'Queued';
      item.cookingElapsedSimSecs = 0;
      item.queuePriority         = Date.now() + Math.random();
    });
    assignRider(orderId);
    update();
  }

  function openRejectOverlay(orderId: string) {
    stateRef.current.rejectingOrderId = orderId;
    stateRef.current.rejectReason     = null;
    update();
  }

  function closeRejectOverlay() {
    stateRef.current.rejectingOrderId = null;
    stateRef.current.rejectReason     = null;
    update();
  }

  function selectRejectReason(reason: string) {
    stateRef.current.rejectReason = reason;
    update();
  }

  function finalizeReject() {
    const state = stateRef.current;
    if (!state.rejectReason || !state.rejectingOrderId) return;
    const orderId  = state.rejectingOrderId;
    const order    = state.orders[orderId];
    if (!order) { closeRejectOverlay(); return; }

    const snapshot = deepClone(order);
    order.status   = 'rejected';

    closeRejectOverlay();
    pushUndo(`Order ${ordNum(orderId)} declined`, () => {
      stateRef.current.orders[orderId] = snapshot;
      stateRef.current.rejected = stateRef.current.rejected.filter(o => o.id !== orderId);
      stateRef.current.shiftStats.rejectedCount = Math.max(0, stateRef.current.shiftStats.rejectedCount - 1);
    });

    state.rejected.push(deepClone(order));
    delete state.orders[orderId];
    state.shiftStats.rejectedCount++;
    update();
  }

  function startItem(orderId: string, itemId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    item.state = 'Cooking';
    item.cookingElapsedSimSecs = 0;

    // Place this newly started cooking item directly after existing cooking items in this station
    const station = item.station;
    const existingCooking: Item[] = [];
    Object.values(state.orders).forEach(o => {
      if (o.status === 'active') {
        o.items.forEach(it => {
          if (it.station === station && it.id !== item.id && it.state === 'Cooking') {
            existingCooking.push(it);
          }
        });
      }
    });
    existingCooking.sort((a, b) => a.queuePriority - b.queuePriority);
    const maxCookingPriority = existingCooking.length > 0
      ? existingCooking[existingCooking.length - 1].queuePriority
      : Date.now();
    item.queuePriority = maxCookingPriority + 1;

    update();
  }

  function holdItem(orderId: string, itemId: string) {
    const order = stateRef.current.orders[orderId];
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    item.state = 'Hold';
    update();
  }

  function markItemReady(orderId: string, itemId: string) {
    const order = stateRef.current.orders[orderId];
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (!item || item.state === 'Hold') return;
    item.state = item.state === 'Ready' ? 'Cooking' : 'Ready';
    update();
  }

  function toggleItemState(orderId: string, itemId: string) {
    const order = stateRef.current.orders[orderId];
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    if (item.state === 'Queued' || item.state === 'Hold') {
      startItem(orderId, itemId);
    } else if (item.state === 'Cooking' || item.state === 'Ready') {
      markItemReady(orderId, itemId);
    }
  }

  function packOrder(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;
    order.status   = 'packed';
    order.packedAt = Date.now();
    order.sittingSecs = 0;

    // If delivery guy is already here, automatically deliver when packed!
    const rider = state.riders.find(r => r.orderId === orderId);
    if (rider && rider.status === 'arrived') {
      confirmHandover(orderId);
      return;
    }
    update();
  }

  function confirmHandover(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order || order.status !== 'packed') return;

    const rider  = state.riders.find(r => r.orderId === orderId);
    if (rider && rider.status !== 'arrived') return;

    const snapshot = deepClone(order);
    const onTime   = order.slaSecsRemaining >= 0;

    pushUndo(`Order ${ordNum(orderId)} handed over`, () => {
      stateRef.current.orders[orderId] = snapshot;
      stateRef.current.completed = stateRef.current.completed.filter(o => o.id !== orderId);
      if (rider) rider.orderId = orderId;
      stateRef.current.shiftStats.velocities.pop();
      if (onTime) stateRef.current.shiftStats.onTimeCount = Math.max(0, stateRef.current.shiftStats.onTimeCount - 1);
      stateRef.current.shiftStats.totalCompleted = Math.max(0, stateRef.current.shiftStats.totalCompleted - 1);
      stateRef.current.completedRush = Math.max(0, stateRef.current.completedRush - 1);
    });

    order.completedAt = Date.now();
    const systemPrepMins = Math.max(1, Math.round(((order.elapsedPrepSimSecs || 0) + (order.sittingSecs || 0)) / 60 * 10) / 10);
    state.shiftStats.velocities.push(systemPrepMins);
    if (onTime) state.shiftStats.onTimeCount++;
    state.shiftStats.totalCompleted++;
    state.completedRush++;

    if (rider) { rider.orderId = null; rider.status = 'transit'; rider.eta = 0; }
    state.slaAlerted.delete(orderId);
    state.completed.push(deepClone(order));
    delete state.orders[orderId];

    checkAndShowAnalytics();
    update();
  }

  function cancelOrder(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;
    const snapshot = deepClone(order);

    // STRICT RULE: ONLY items actively in 'Cooking' or 'Ready' states move to Up for Grabs.
    // Untouched/queued/held items ('Queued' or 'Hold') NEVER go to Up for Grabs.
    const preppedItems = order.items.filter(item => item.state === 'Cooking' || item.state === 'Ready');

    preppedItems.forEach(item => {
      state.canceledStock.push({
        id: makeId(),
        name: item.name,
        qty: item.qty,
        createdAtSimSecs: state.currentSimSecs || 0,
        canceledBy: 'Kitchen',
      });
    });

    pushUndo(`Order ${ordNum(orderId)} cancelled`, () => {
      stateRef.current.orders[orderId] = snapshot;
      preppedItems.forEach(item => {
        const idx = stateRef.current.canceledStock.findIndex(c => c.name === item.name);
        if (idx !== -1) stateRef.current.canceledStock.splice(idx, 1);
      });
      stateRef.current.shiftStats.rejectedCount = Math.max(0, stateRef.current.shiftStats.rejectedCount - 1);
    });

    const rider = state.riders.find(r => r.orderId === orderId);
    if (rider) rider.orderId = null;
    state.shiftStats.rejectedCount++;
    delete state.orders[orderId];
    update();
  }

  function cancelOrderByCustomer(orderId: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;

    // STRICT RULE: ONLY items actively in 'Cooking' or 'Ready' states move to Up for Grabs.
    // Untouched/queued/held items ('Queued' or 'Hold') NEVER go to Up for Grabs.
    const preppedItems = order.items.filter(item => item.state === 'Cooking' || item.state === 'Ready');

    if (preppedItems.length > 0) {
      preppedItems.forEach(item => {
        state.canceledStock.push({
          id: makeId(),
          name: item.name,
          qty: item.qty,
          createdAtSimSecs: state.currentSimSecs || 0,
          canceledBy: 'Customer',
        });
      });
      setUndoLabel(`⚠️ Order #${ordNum(orderId)} Cancelled by Customer — ${preppedItems.length} cooking item(s) moved to Up for Grabs`);
    } else {
      setUndoLabel(`⚠️ Order #${ordNum(orderId)} Cancelled by Customer`);
    }

    const rider = state.riders.find(r => r.orderId === orderId);
    if (rider) rider.orderId = null;

    delete state.orders[orderId];
    playSound('slaWarn', state.soundEnabled);
    update();
  }

  function consumeCanceledStock(matchId: string, orderId: string, itemName: string) {
    const state = stateRef.current;
    const order = state.orders[orderId];
    if (!order) return;
    const item = order.items.find(i => i.name === itemName);
    if (!item) return;
    const idx = state.canceledStock.findIndex(c => c.id === matchId);
    if (idx !== -1) {
      const m = state.canceledStock[idx];
      if (m.qty > item.qty) m.qty -= item.qty;
      else state.canceledStock.splice(idx, 1);
    }
    item.state = 'Ready';
    update();
  }

  function prepareInBulk(name: string, station: string) {
    const state = stateRef.current;
    let changed = false;

    // Find highest priority among currently cooking items in this station
    const existingCooking: Item[] = [];
    Object.values(state.orders).forEach(o => {
      if (o.status === 'active') {
        o.items.forEach(it => {
          if (it.station === station && it.state === 'Cooking') {
            existingCooking.push(it);
          }
        });
      }
    });
    existingCooking.sort((a, b) => a.queuePriority - b.queuePriority);
    let basePriority = existingCooking.length > 0
      ? existingCooking[existingCooking.length - 1].queuePriority
      : Date.now();

    Object.values(state.orders).forEach(order => {
      if (order.status === 'active') {
        order.items.forEach(item => {
          if ((item.state === 'Queued' || item.state === 'Hold') && item.name === name && item.station === station) {
            item.state = 'Cooking';
            item.cookingElapsedSimSecs = 0;
            basePriority += 2;
            item.queuePriority = basePriority;
            changed = true;
          }
        });
      }
    });
    if (changed) update();
  }

  function moveQueueItem(orderId: string, itemIds: string | string[], direction: 'up' | 'down') {
    const state = stateRef.current;
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    const primary = Object.values(state.orders).flatMap(o => o.items).find(i => ids.includes(i.id));
    if (!primary) return;
    const station = primary.station;

    const all: Array<{orderId: string; item: Item}> = [];
    Object.values(state.orders).forEach(o => {
      if (o.status === 'active') {
        o.items.forEach(it => {
          if (it.state !== 'Ready' && it.station === station) all.push({ orderId: o.id, item: it });
        });
      }
    });
    all.sort((a, b) => a.item.queuePriority - b.item.queuePriority);

    const indices = ids.map(id => all.findIndex(x => x.item.id === id)).filter(idx => idx !== -1).sort((a, b) => a - b);
    if (indices.length === 0) return;

    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];

    if (direction === 'up' && minIdx > 0) {
      const swapTarget = all[minIdx - 1];
      const dragged = all.filter(x => ids.includes(x.item.id));
      const remaining = all.filter(x => !ids.includes(x.item.id));
      const targetIdx = remaining.findIndex(x => x.item.id === swapTarget.item.id);
      remaining.splice(targetIdx, 0, ...dragged);
      const base = Date.now();
      remaining.forEach((x, i) => { x.item.queuePriority = base + i * 10; });
      update();
    } else if (direction === 'down' && maxIdx < all.length - 1) {
      const swapTarget = all[maxIdx + 1];
      const dragged = all.filter(x => ids.includes(x.item.id));
      const remaining = all.filter(x => !ids.includes(x.item.id));
      const targetIdx = remaining.findIndex(x => x.item.id === swapTarget.item.id);
      remaining.splice(targetIdx + 1, 0, ...dragged);
      const base = Date.now();
      remaining.forEach((x, i) => { x.item.queuePriority = base + i * 10; });
      update();
    }
  }

  function reorderQueue(draggedItemId: string | string[], targetItemId: string, station: string) {
    const state = stateRef.current;
    const all: Array<{orderId: string; item: Item}> = [];
    Object.values(state.orders).forEach(o => {
      if (o.status === 'active') {
        o.items.forEach(item => {
          if (item.state !== 'Ready' && item.station === station) all.push({ orderId: o.id, item });
        });
      }
    });
    all.sort((a, b) => a.item.queuePriority - b.item.queuePriority);

    const draggedIds = Array.isArray(draggedItemId) ? draggedItemId : [draggedItemId];
    const draggedItems = all.filter(x => draggedIds.includes(x.item.id));
    if (draggedItems.length === 0) return;

    const remaining = all.filter(x => !draggedIds.includes(x.item.id));
    const targetIdx = remaining.findIndex(x => x.item.id === targetItemId);
    const insertIdx = targetIdx === -1 ? remaining.length : targetIdx;

    remaining.splice(insertIdx, 0, ...draggedItems);
    const base = Date.now();
    remaining.forEach((x, i) => { x.item.queuePriority = base + i * 10; });
    update();
  }

  function callRider(orderId: string) {
    const state = stateRef.current;
    const rider = state.riders.find(r => r.orderId === orderId);
    if (rider) {
      rider.status   = 'arrived';
      rider.eta      = 0;
      rider.waitSecs = 0;
      const order = state.orders[orderId];
      if (order) order.riderStatus = 'arrived';
      playSound('riderHere', state.soundEnabled);
      update();
    }
  }

  // BUG FIX #1: Resume Apps correctly clears pause state
  function resumeApps() {
    const state = stateRef.current;
    state.pausedChannels = { Swiggy: false, Zomato: false, DirectApp: false };
    state.pausedBrands   = { 'All Brands': true };
    state.pausedUntil    = null;
    update();
  }

  function applyPause(channels: {Swiggy: boolean; Zomato: boolean; DirectApp: boolean}, brands: Record<string, boolean>, mins: number) {
    const state = stateRef.current;
    if (mins === 0) {
      resumeApps();
      return;
    }
    state.pausedChannels = channels;
    state.pausedBrands   = brands;
    const anyPaused = Object.values(channels).some(v => v);
    state.pausedUntil = anyPaused ? (state.currentSimSecs || 0) + (mins * 60) : null;
    if (!anyPaused) state.pausedBrands = { 'All Brands': true };
    update();
  }

  function setOpen(open: boolean) {
    stateRef.current.isOpen = open;
    if (open) {
      // Queue the first order to arrive after ~3 real seconds
      stateRef.current.firstOrderCountdown = 3;
      stateRef.current.firstOrderSent      = false;
    }
    update();
  }

  function setAutoAccept(on: boolean) {
    stateRef.current.autoAccept = on;
    if (on) {
      Object.keys(stateRef.current.orders).forEach(id => {
        if (stateRef.current.orders[id].status === 'new') {
          acceptOrderCore(id, stateRef.current);
        }
      });
    }
    update();
  }

  function toggleSound() {
    const state = stateRef.current;
    state.soundEnabled = !state.soundEnabled;
    safeStorageSet('wk-sound', String(state.soundEnabled));
    if (state.soundEnabled) playSound('newOrder', true);
    update();
  }

  function saveOosItems(items: Record<string, boolean>) {
    stateRef.current.oosItems = items;
    update();
  }

  // BUG FIX #2: Manual order submission auto-accepts when autoAccept is ON
  function submitManualOrder(params: {
    customer: string; platform: string; brand: string;
    items: Item[]; notes: string;
  }) {
    if (params.items.length === 0) return false;
    const state = stateRef.current;
    const id    = nextOrderId();
    const order = makeOrder({
      id,
      brand:    params.brand,
      source:   params.platform,
      customer: params.customer,
      items:    params.items,
      notes:    params.notes,
    });
    state.orders[id] = order;

    if (state.autoAccept) {
      acceptOrderCore(id, state);
    } else {
      playSound('newOrder', state.soundEnabled);
    }
    update();
    return true;
  }

  function checkAndShowAnalytics(force: boolean = false) {
    const state = stateRef.current;
    const allOrders = Object.values(state.orders);

    // Strict guard: NEVER show analytics if ANY orders exist on the board (Just Came In, Cooking, or Packed)
    if (!force && allOrders.length > 0) {
      return;
    }

    const elapsedRush = (state.currentSimSecs || 0) - (state.rushStartSimSecs || 0);
    const rushDone = elapsedRush >= CFG.RUSH_SESSION_SECS;

    if (force || (rushDone && allOrders.length === 0 && state.completedRush >= CFG.ANALYTICS_MIN_ORDERS)) {
      const s = state.shiftStats;
      const onTimeRate = s.totalCompleted > 0
        ? Math.round((s.onTimeCount / s.totalCompleted) * 100) : 0;
      const avgVel = s.velocities.length > 0
        ? `${(s.velocities.reduce((a, b) => a + b, 0) / s.velocities.length).toFixed(1)} min` : '—';
      const sortedStations = Object.entries(s.peakLoad).sort((a, b) => b[1] - a[1]);
      const peakStation = sortedStations[0] as [string, number] | undefined;

      state.analyticsSnapshot = {
        onTimeRate,
        avgVel,
        peakStation: peakStation ?? null,
        coldLog: s.coldLog,
        rejectedCount: s.rejectedCount,
        totalCompleted: s.totalCompleted,
        onTimeCount: s.onTimeCount,
      };
      state.showAnalyticsModal = true;
      update();
    }
  }

  function closeAnalytics() {
    const state = stateRef.current;
    state.showAnalyticsModal = false;
    // Reset rush timer and stats for the next incoming session
    state.completedRush = 0;
    state.rushStartSimSecs = state.currentSimSecs || 0;
    state.shiftStats = {
      onTimeCount: 0, totalCompleted: 0, velocities: [],
      peakLoad: { 'Hot': 0, 'Grill': 0, 'Assembly': 0 },
      coldLog: 0, rejectedCount: 0,
    };
    update();
  }

  // ── Tick Loop ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const state = stateRef.current;

      // First order: guaranteed within ~3 seconds of opening
      if (state.isOpen && !state.firstOrderSent) {
        if (state.firstOrderCountdown > 0) {
          state.firstOrderCountdown--;
        } else {
          state.firstOrderSent = true;
          generateSimulatedOrder();
        }
      }

      // Subsequent orders: natural flow during rush session
      // When rush session ends (elapsedRush >= CFG.RUSH_SESSION_SECS), orders naturally STOP coming so manager can clear all existing orders
      const elapsedRush = (state.currentSimSecs || 0) - (state.rushStartSimSecs || 0);
      const isRushActive = elapsedRush < CFG.RUSH_SESSION_SECS;
      const allChannelsPaused = Object.values(state.pausedChannels).every(v => v);
      if (state.isOpen && state.firstOrderSent && isRushActive && !allChannelsPaused && !state.throttleActive) {
        generateSimulatedOrder();
      }

      // Natural customer cancellation events during rush session (populates Up for Grabs with prepped items)
      // Faster early cancellation trigger on first prepped order, then regular periodic rate
      const cancelCandidates = Object.values(state.orders).filter(
        o => o.status === 'active' && o.items.some(i => i.state === 'Cooking' || i.state === 'Ready')
      );
      const isEarlyGrabsNeeded = state.canceledStock.length === 0 && cancelCandidates.length >= 1 && (state.currentSimSecs || 0) >= 15;
      if (state.isOpen && (isEarlyGrabsNeeded || Math.random() < 0.05)) {
        if (cancelCandidates.length > 0) {
          const toCancel = cancelCandidates[Math.floor(Math.random() * cancelCandidates.length)];
          cancelOrderByCustomer(toCancel.id);
        }
      }

      // Simulated time advances 3s per real second (40% slower)
      if (state.isOpen) {
        state.currentSimSecs = (state.currentSimSecs || 0) + 3;

        // Decay canceled stock after 30 sim minutes
        state.canceledStock = state.canceledStock.filter(
          item => (state.currentSimSecs - item.createdAtSimSecs) < 1800
        );

        // Auto-clear pauses
        if (state.pausedUntil && state.currentSimSecs >= state.pausedUntil) {
          state.pausedChannels = { Swiggy: false, Zomato: false, DirectApp: false };
          state.pausedBrands   = { 'All Brands': true };
          state.pausedUntil    = null;
        }
      }

      // Process each order
      Object.values(state.orders).forEach(order => {
        if (order.status === 'new') {
          order.autoCancelSecs = Math.max(0, order.autoCancelSecs - 3);
          if (order.autoCancelSecs === 0) {
            order.status = 'rejected';
            state.rejected.push(deepClone(order));
            delete state.orders[order.id];
            state.shiftStats.rejectedCount++;
          }
        }

        if ((order.status === 'active' || order.status === 'packed') && order.acceptedAt) {
          order.slaSecsRemaining   = Math.max(-999, order.slaSecsRemaining - 3);
          order.elapsedPrepSimSecs = (order.elapsedPrepSimSecs || 0) + 3;

          if (order.slaSecsRemaining <= CFG.SLA_WARN_SECS && !state.slaAlerted.has(order.id)) {
            state.slaAlerted.add(order.id);
            playSound('slaWarn', state.soundEnabled);
          }
        }

        if (order.status === 'active') {
          order.items.forEach(item => {
            if (item.state === 'Cooking') {
              item.cookingElapsedSimSecs = (item.cookingElapsedSimSecs || 0) + 3;
              // Auto-complete item when cooking time is done
              if (item.cookingElapsedSimSecs >= item.prepSecs) {
                item.state = 'Ready';
              }
            }
          });

          // Check if ALL items in the order are ready
          const allReady = order.items.every(i => i.state === 'Ready');
          if (allReady) {
            if (order.riderStatus === 'arrived') {
              // Rider is already here! Deliver automatically with celebration animation!
              const rider = state.riders.find(r => r.orderId === order.id);
              order.status = 'packed';
              order.packedAt = Date.now();
              const onTime = order.slaSecsRemaining >= 0;
              order.completedAt = Date.now();
              const systemPrepMins = Math.max(1, Math.round(((order.elapsedPrepSimSecs || 0) + (order.sittingSecs || 0)) / 60 * 10) / 10);
              state.shiftStats.velocities.push(systemPrepMins);
              if (onTime) state.shiftStats.onTimeCount++;
              state.shiftStats.totalCompleted++;
              state.completedRush++;
              if (rider) { rider.orderId = null; rider.status = 'transit'; rider.eta = 0; }
              state.slaAlerted.delete(order.id);
              state.completed.push(deepClone(order));
              delete state.orders[order.id];
              setUndoLabel(`🎉 Order #${ordNum(order.id)} Picked Up & Delivered!`);
              playSound('handover', state.soundEnabled);
            } else {
              // Rider not here yet — automatically transition to Packed & Waiting in Col 4!
              order.status = 'packed';
              order.packedAt = Date.now();
              order.sittingSecs = 0;
            }
          }
        }

        if (order.status === 'packed') {
          order.sittingSecs = (order.sittingSecs || 0) + 3;
          if (order.sittingSecs! >= CFG.COLD_ORDER_SECS && !order._coldLogged) {
            order._coldLogged = true;
            state.shiftStats.coldLog++;
          }
          if (order.riderStatus === 'arrived') {
            // Auto-handover immediately when rider arrives for packed order!
            const rider = state.riders.find(r => r.orderId === order.id);
            const onTime = order.slaSecsRemaining >= 0;
            order.completedAt = Date.now();
            const systemPrepMins = Math.max(1, Math.round(((order.elapsedPrepSimSecs || 0) + (order.sittingSecs || 0)) / 60 * 10) / 10);
            state.shiftStats.velocities.push(systemPrepMins);
            if (onTime) state.shiftStats.onTimeCount++;
            state.shiftStats.totalCompleted++;
            state.completedRush++;
            if (rider) { rider.orderId = null; rider.status = 'transit'; rider.eta = 0; }
            state.slaAlerted.delete(order.id);
            state.completed.push(deepClone(order));
            delete state.orders[order.id];
            setUndoLabel(`🎉 Order #${ordNum(order.id)} Picked Up & Delivered!`);
            playSound('handover', state.soundEnabled);
          }
        }
      });

      // Rider ETAs
      state.riders.forEach(rider => {
        if (rider.status === 'transit' && rider.eta > 0) {
          rider.eta = Math.max(0, rider.eta - 3);
          if (rider.eta === 0) {
            rider.status   = 'arrived';
            rider.waitSecs = 0;
            playSound('riderHere', state.soundEnabled);
            const order = Object.values(state.orders).find(o => o.id === rider.orderId);
            if (order) order.riderStatus = 'arrived';
          }
        }
        if (rider.status === 'arrived') rider.waitSecs = (rider.waitSecs || 0) + 3;
      });

      updateCapacity(state);
      checkAndShowAnalytics();
      setVersion(v => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []); // stable — tick reads from ref

  // ── Simulated Order Generator ─────────────────────────────────
  function generateSimulatedOrder() {
    const state = stateRef.current;

    // Enforce real-time rate limiting:
    // Max 15 orders per 2 minutes (120,000 ms) real time, spaced out by at least 6 real seconds
    const now = Date.now();
    orderArrivalRealTimestampsRef.current = orderArrivalRealTimestampsRef.current.filter(
      t => now - t < 120000
    );
    if (orderArrivalRealTimestampsRef.current.length >= 15) {
      return; // Density limit reached: no more than 15 orders in a 2-minute real-time window
    }
    const lastArrival = orderArrivalRealTimestampsRef.current[orderArrivalRealTimestampsRef.current.length - 1] || 0;
    if (now - lastArrival < 6000) {
      return; // Minimum interval: at least 6 real seconds between incoming orders
    }

    const brandNames = Object.keys(BRANDS);
    const selectedBrand = brandNames[Math.floor(Math.random() * brandNames.length)];
    const brandData = BRANDS[selectedBrand];

    // Check currently active queue items for this brand to create Prep Together opportunities
    const activeQueueItems = Object.values(state.orders)
      .filter(o => o.status === 'active')
      .flatMap(o => o.items)
      .filter(i => (i.state === 'Queued' || i.state === 'Hold') && brandData.items.some(b => b.name === i.name));

    // Check Up for Grabs stock matching this brand to create Up for Grabs match opportunities
    const grabsMatches = state.canceledStock.filter(c => brandData.items.some(b => b.name === c.name));

    const n = Math.floor(Math.random() * 3) + 2;
    const items: Item[] = [];
    for (let i = 0; i < n; i++) {
      let sel: { name: string; prepSecs: number };

      // High likelihood of overlapping with active kitchen queue (Prep Together) or Up for Grabs
      if (i === 0 && activeQueueItems.length > 0 && Math.random() < 0.65) {
        const queueChoice = activeQueueItems[Math.floor(Math.random() * activeQueueItems.length)];
        sel = brandData.items.find(b => b.name === queueChoice.name) || brandData.items[0];
      } else if (i === 0 && grabsMatches.length > 0 && Math.random() < 0.70) {
        const grabChoice = grabsMatches[Math.floor(Math.random() * grabsMatches.length)];
        sel = brandData.items.find(b => b.name === grabChoice.name) || brandData.items[0];
      } else {
        sel = brandData.items[Math.floor(Math.random() * brandData.items.length)];
      }

      const modifier = Math.random() < 0.30 ? pickNote() : '';
      const existing = items.find(x => x.name === sel.name);
      if (existing) { existing.qty++; if (!existing.modifier && modifier) existing.modifier = modifier; }
      else items.push(makeItem(sel.name, 1, modifier));
    }
    const brand  = selectedBrand;
    const sources: Array<'Swiggy' | 'Zomato' | 'DirectApp'> = ['Swiggy', 'Zomato', 'DirectApp'];
    const source = sources[Math.floor(Math.random() * sources.length)];

    // Check if channel is paused or store is throttled
    if (state.throttleActive) return;
    if (state.pausedChannels[source]) {
      if (state.pausedBrands?.['All Brands'] || state.pausedBrands?.[brand]) return;
    }

    const id    = nextOrderId();
    const order = makeOrder({
      id, brand, source, customer: pickCustomer(), items,
      notes: Math.random() < 0.25 ? pickNote() : '',
    });
    state.orders[id] = order;
    orderArrivalRealTimestampsRef.current.push(now);

    if (state.autoAccept) {
      acceptOrderCore(id, state);
    } else {
      playSound('newOrder', state.soundEnabled);
    }
  }

  // ── Clock ─────────────────────────────────────────────────────
  const formatClock = () => {
    try {
      return new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      });
    } catch {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
  };

  const [clock, setClock] = useState(formatClock);
  useEffect(() => {
    const t = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Computed Values ───────────────────────────────────────────
  const orders       = Object.values(s.orders);
  const newOrders    = orders.filter(o => o.status === 'new').sort((a, b) => a.autoCancelSecs - b.autoCancelSecs);
  const activeOrders = orders.filter(o => o.status === 'active').sort((a, b) => a.slaSecsRemaining - b.slaSecsRemaining);
  const packedOrders = orders.filter(o => o.status === 'packed').sort((a, b) => a.slaSecsRemaining - b.slaSecsRemaining);

  const showPauseBanner   = !!(s.pausedUntil && s.currentSimSecs < s.pausedUntil);
  const pausedRemaining   = Math.max(0, (s.pausedUntil ?? 0) - s.currentSimSecs);
  const pausedList        = Object.entries(s.pausedChannels).filter(([, p]) => p).map(([c]) => c === 'DirectApp' ? 'App' : c);


  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="wk-root"
      style={{ background: 'var(--wk-vellum)', color: 'var(--wk-ink)', height: '100dvh', overflow: 'hidden', fontFamily: 'var(--wk-font-ui)' }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <DashboardHeader
        isOpen={s.isOpen}
        autoAccept={s.autoAccept}
        soundEnabled={s.soundEnabled}
        cookingCount={activeOrders.length}
        waitingCount={newOrders.length}
        doneCount={s.completed.length}
        stationLoads={s.stationLoads}
        clock={clock}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onAutoAcceptOn={() => setAutoAccept(true)}
        onAutoAcceptOff={() => setAutoAccept(false)}
        onToggleSound={toggleSound}
        onOpenNewOrder={() => setShowNewOrder(true)}
        onOpenPause={() => setShowPause(true)}
        onOpenMenu={() => setShowMenu(true)}
      />

      {/* ── System Banners ──────────────────────────────────── */}
      <SystemBanners
        isOpen={s.isOpen}
        throttleActive={s.throttleActive}
        showPause={showPauseBanner}
        pausedList={pausedList}
        pausedBrands={s.pausedBrands}
        pausedRemaining={pausedRemaining}
        onReopen={() => setOpen(true)}
        onResumeApps={resumeApps}
      />

      {/* ── Main 3-Column Grid ──────────────────────────────── */}
      <MainGrid
        isOpen={s.isOpen}
        throttleActive={s.throttleActive}
        showPause={showPauseBanner}
      >
        {/* Col 1: New Orders */}
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: 'var(--wk-b)', background: 'var(--wk-vellum)' }}>
          <div style={{ flexShrink: 0, height: 'var(--wk-ch)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>Just Came In</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 18, padding: '0 4px', background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', borderRadius: 'var(--wk-r)', fontSize: 10, fontWeight: 700 }}>{newOrders.length}</span>
          </div>
          <div className="wk-scroll" style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {newOrders.length === 0 ? (
              <EmptyState icon="◎" text="No new orders" />
            ) : newOrders.map(order => (
              <NewOrderCard
                key={order.id}
                order={order}
                oosItems={s.oosItems}
                stationLoads={s.stationLoads}
                orders={s.orders}
                canceledStock={s.canceledStock}
                currentSimSecs={s.currentSimSecs}
                onAccept={() => acceptOrder(order.id)}
                onReject={() => openRejectOverlay(order.id)}
              />
            ))}
          </div>
        </section>

        {/* Col 2: Cooking Now */}
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: 'var(--wk-b)', background: 'var(--wk-vellum)' }}>
          <div style={{ flexShrink: 0, height: 'var(--wk-ch)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wk-graphite)', lineHeight: 1 }}>Cooking Now</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 18, padding: '0 4px', background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', borderRadius: 'var(--wk-r)', fontSize: 10, fontWeight: 700 }}>{activeOrders.length}</span>
          </div>
          <div
            className="wk-scroll"
            style={activeOrders.length === 0
              ? { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              : { flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gridAutoRows: 'min-content', alignContent: 'start', alignItems: 'start', gap: 10 }
            }
          >
            {activeOrders.length === 0 && <EmptyState icon="◎" text="Kitchen is clear" />}
            {activeOrders.map(order => (
              <ActiveOrderCard
                key={order.id}
                order={order}
                riders={s.riders}
                canceledStock={s.canceledStock}
                currentSimSecs={s.currentSimSecs}
                stationLoads={s.stationLoads}
                orders={s.orders}
                onToggleItem={toggleItemState}
                onStartItem={startItem}
                onHoldItem={holdItem}
                onPackOrder={() => packOrder(order.id)}
                onHandover={() => confirmHandover(order.id)}
                onCallRider={() => callRider(order.id)}
                onCancel={() => cancelOrder(order.id)}
                onConsumeCanceled={consumeCanceledStock}
              />
            ))}
          </div>
        </section>

        {/* Col 3: Station Queues */}
        <Column3
          orders={s.orders}
          stationLoads={s.stationLoads}
          onStartItem={startItem}
          onHoldItem={holdItem}
          onGroupPrep={prepareInBulk}
          onMoveUp={(oId, iId) => moveQueueItem(oId, iId, 'up')}
          onMoveDown={(oId, iId) => moveQueueItem(oId, iId, 'down')}
          onReorder={reorderQueue}
          getGroupPrepCandidates={(stn) => getGroupPrepCandidates(stn, s.orders)}
        />

        {/* Col 4: Packed & Ready + Riders Waiting + Ready Items Pool */}
        <Column4
          canceledStock={s.canceledStock}
          currentSimSecs={s.currentSimSecs}
          orders={s.orders}
          packedOrders={packedOrders}
          riders={s.riders}
          onRiderHandover={(riderId) => {
            const rider = s.riders.find(r => r.id === riderId);
            if (rider?.orderId) confirmHandover(rider.orderId);
          }}
          onCallRider={callRider}
        />
      </MainGrid>

      {/* ── Modals ──────────────────────────────────────────── */}
      <DashboardModals
        showNewOrder={showNewOrder}
        showPause={showPause}
        showMenu={showMenu}
        showReject={!!s.rejectingOrderId}
        showAnalytics={s.showAnalyticsModal}
        showPoolConfirm={showPoolConfirm}
        poolConfirmItems={poolConfirmItems}
        rejectReason={s.rejectReason}
        analyticsSnapshot={s.analyticsSnapshot}
        oosItems={s.oosItems}
        rejectingOrderId={s.rejectingOrderId}
        orders={s.orders}
        onCloseNewOrder={() => setShowNewOrder(false)}
        onClosePause={() => setShowPause(false)}
        onCloseMenu={() => setShowMenu(false)}
        onCloseReject={closeRejectOverlay}
        onCloseAnalytics={closeAnalytics}
        onClosePoolConfirm={() => { setShowPoolConfirm(false); pendingAcceptOrderId.current = null; }}
        onSelectRejectReason={selectRejectReason}
        onFinalizeReject={finalizeReject}
        onApplyPause={applyPause}
        onSaveOos={saveOosItems}
        onSubmitManualOrder={submitManualOrder}
        onPoolAcceptUseItems={handlePoolAcceptUseItems}
        onPoolAcceptCookFresh={handlePoolAcceptCookFresh}
      />

      {/* ── Undo Toast ──────────────────────────────────────── */}
      <UndoToast
        visible={!!s.undoEntry}
        label={undoLabel}
        windowMs={CFG.UNDO_WINDOW_MS}
        onUndo={executeUndo}
      />
    </div>
  );
}

// ── System Banners ─────────────────────────────────────────────
function SystemBanners({ isOpen, throttleActive, showPause, pausedList, pausedBrands, pausedRemaining, onReopen, onResumeApps }: {
  isOpen: boolean; throttleActive: boolean; showPause: boolean;
  pausedList: string[]; pausedBrands: Record<string, boolean>; pausedRemaining: number;
  onReopen: () => void; onResumeApps: () => void;
}) {
  const banners: React.ReactNode[] = [];
  let top = 56; // --wk-hh

  if (!isOpen) {
    banners.push(
      <div key="closed" role="alert" style={{ position: 'fixed', left: 0, right: 0, zIndex: 190, top, height: 44, boxSizing: 'border-box', padding: '0 16px', background: 'var(--wk-gold)', color: 'var(--wk-ink)', borderBottom: 'var(--wk-b)', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 13 }}>
        <span style={{ fontSize: 18 }}>⛔</span>
        <span style={{ flex: 1 }}>Kitchen is CLOSED — not taking new orders right now</span>
        <GhostBtn onClick={onReopen} style={{ fontSize: 11, padding: '4px 10px' }}>Re-open Kitchen</GhostBtn>
      </div>
    );
    top += 44;
  }

  if (throttleActive) {
    banners.push(
      <div key="throttle" role="alert" style={{ position: 'fixed', left: 0, right: 0, zIndex: 190, top, height: 44, boxSizing: 'border-box', padding: '0 16px', background: 'var(--wk-oxblood)', color: 'var(--wk-vellum)', borderBottom: 'var(--wk-b)', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 13 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span>Kitchen is very busy — delivery apps slowed down by 5 min</span>
      </div>
    );
    top += 44;
  }

  if (showPause) {
    const pausedKeys = Object.keys(pausedBrands || {}).filter(k => k !== 'All Brands' && pausedBrands[k]);
    const brandTxt = !pausedBrands?.['All Brands'] && pausedKeys.length > 0 ? ` [${pausedKeys.join(', ')}]` : '';
    banners.push(
      <div key="pause" role="alert" style={{ position: 'fixed', left: 0, right: 0, zIndex: 190, top, height: 44, boxSizing: 'border-box', padding: '0 16px', background: 'var(--wk-gold)', color: 'var(--wk-ink)', borderBottom: 'var(--wk-b)', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 13 }}>
        <span style={{ fontSize: 18 }}>⏸</span>
        <span>Apps paused: {pausedList.join(', ')}{brandTxt} ({fmtMSS(pausedRemaining)} remaining)</span>
        <GhostBtn onClick={onResumeApps} style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>Resume Apps</GhostBtn>
      </div>
    );
  }

  return <>{banners}</>;
}

// ── Main Grid ──────────────────────────────────────────────────
function MainGrid({ children, isOpen, throttleActive, showPause }: {
  children: React.ReactNode; isOpen: boolean; throttleActive: boolean; showPause: boolean;
}) {
  const bannerCount = (!isOpen ? 1 : 0) + (throttleActive ? 1 : 0) + (showPause ? 1 : 0);
  return (
    <main
      className="wk-main-grid"
      style={{
        position: 'fixed',
        top: `calc(var(--wk-hh) + ${bannerCount * 44}px)`,
        left: 0, right: 0, bottom: 0,
      }}
    >
      {children}
    </main>
  );
}

// ── Shared Primitives ──────────────────────────────────────────
export function GhostBtn({ children, onClick, style, disabled, className }: {
  children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties;
  disabled?: boolean; className?: string;
}) {
  return (
    <button
      className={`wk-interactive ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '7px 13px',
        background: 'var(--wk-vellum)', border: 'var(--wk-b)', borderRadius: 'var(--wk-r)',
        color: 'var(--wk-oxblood)',
        fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 11,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function OxBtn({ children, onClick, style, disabled }: {
  children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean;
}) {
  return (
    <button
      className="wk-interactive"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 16px',
        background: 'var(--wk-oxblood)', border: '1px solid var(--wk-oxblood)', borderRadius: 'var(--wk-r)',
        color: 'var(--wk-vellum)',
        fontFamily: 'var(--wk-font-ui)', fontWeight: 700, fontSize: 11,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ChannelBadge({ source }: { source: string }) {
  const map: Record<string, {bg: string; label: string}> = {
    Swiggy:    { bg: '#FC8019', label: 'Swiggy' },
    Zomato:    { bg: '#CB202D', label: 'Zomato' },
    Phone:     { bg: '#2c5282', label: 'Phone' },
    DirectApp: { bg: '#6d28d9', label: 'App' },
  };
  const cfg = map[source] ?? { bg: '#374151', label: source };
  return (
    <span style={{ padding: '2px 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3, color: '#fff', background: cfg.bg, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', gap: 8, color: 'var(--wk-graphite)', opacity: 0.45 }}>
      <div style={{ fontSize: 34, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{text}</div>
    </div>
  );
}

