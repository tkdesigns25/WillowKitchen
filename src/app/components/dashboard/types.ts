export type ItemState = 'Queued' | 'Cooking' | 'Hold' | 'Ready';
export type OrderStatus = 'new' | 'active' | 'packed' | 'completed' | 'rejected';
export type RiderStatus = 'transit' | 'arrived';

export interface Item {
  id: string;
  name: string;
  qty: number;
  station: string;
  prepSecs: number;
  state: ItemState;
  cookingElapsedSimSecs: number;
  queuePriority: number;
  modifier: string;
}

export interface Order {
  id: string;
  brand: string;
  source: string;
  customer: string;
  items: Item[];
  notes: string;
  status: OrderStatus;
  arrivedAt: number;
  autoCancelSecs: number;
  acceptedAt: number | null;
  packedAt: number | null;
  completedAt: number | null;
  slaMinutes: number;
  slaSecsRemaining: number;
  elapsedPrepSimSecs: number;
  riderStatus: 'none' | RiderStatus;
  riderEta: number | null;
  riderId: string | null;
  riderWaitSecs: number;
  hasOOS: boolean;
  sittingSecs?: number;
  _coldLogged?: boolean;
  riderCoWaitSecs?: number;
}

export interface Rider {
  id: string;
  name: string;
  platform: string;
  orderId: string | null;
  tag: string;
  eta: number;
  status: RiderStatus;
  waitSecs: number;
}

export interface CanceledStock {
  id: string;
  name: string;
  qty: number;
  createdAtSimSecs: number;
  canceledBy?: 'Customer' | 'Kitchen';
}

export interface ShiftStats {
  onTimeCount: number;
  totalCompleted: number;
  velocities: number[];
  peakLoad: Record<string, number>;
  coldLog: number;
  rejectedCount: number;
}

export interface AnalyticsData {
  onTimeRate: number;
  avgVel: string;
  peakStation: [string, number] | null;
  coldLog: number;
  rejectedCount: number;
  totalCompleted: number;
  onTimeCount: number;
}

export interface AppState {
  orders: Record<string, Order>;
  rejected: Order[];
  completed: Order[];
  riders: Rider[];
  orderCounter: number;
  soundEnabled: boolean;
  isOpen: boolean;
  autoAccept: boolean;
  canceledStock: CanceledStock[];
  currentSimSecs: number;
  oosItems: Record<string, boolean>;
  pausedChannels: { Swiggy: boolean; Zomato: boolean; DirectApp: boolean };
  pausedBrands: Record<string, boolean>;
  pausedUntil: number | null;
  rejectingOrderId: string | null;
  rejectReason: string | null;
  undoEntry: (() => void) | null;
  undoTimer: ReturnType<typeof setTimeout> | null;
  throttleActive: boolean;
  throttleStart: number | null;
  stationLoads: Record<string, number>;
  slaAlerted: Set<string>;
  completedRush: number;
  shiftStats: ShiftStats;
  showAnalyticsModal: boolean;
  analyticsSnapshot: AnalyticsData | null;
  firstOrderSent: boolean;
  firstOrderCountdown: number;
  rushStartSimSecs: number;
}
