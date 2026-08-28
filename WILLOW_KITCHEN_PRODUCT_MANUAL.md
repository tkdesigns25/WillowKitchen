# Willow Kitchen — Product Completion Brief & System Manual
**Document Version:** 1.0 (Final Production Release)  
**Target Audience:** AI Engineering Agents, Product Managers, Frontend Engineers, and System Integrators.  
**Repository:** `https://github.com/tkdesigns25/WillowKitchen.git`  
**License:** Private / Commercial  

---

## 1. Executive Summary & Brand Identity

**Willow Kitchen** is a high-density, web-and-tablet responsive multi-brand cloud kitchen management platform designed for rapid kitchen throughput, aggregated delivery dispatch, dynamic station queue prioritization, and food waste reduction.

### Brand Rules & Terminology
- **Strict Brand Naming**: The platform is strictly titled **Willow Kitchen**. Generic acronyms (such as "KDS" or "Kitchen Display System") are prohibited across all UI text, code classes, variables, and documentation.
- **Aggregator Channels**: Incoming orders originate from three primary delivery sources:
  1. `Swiggy` (Orange badge: `#FC8019`)
  2. `Zomato` (Red badge: `#CB202D`)
  3. `App` (Purple badge: `#6d28d9` — represents the kitchen's proprietary first-party mobile/web application)
  4. `Phone` (Blue badge: `#2c5282` — manual direct telephone orders)

---

## 2. Design System & Visual Tokens

The user interface follows the **Vellum & Oxblood** artisanal kitchen aesthetic, utilizing warm editorial paper tones, deep oxblood borders, and high-contrast typography.

### 2.1 Color Palette & CSS Variables
| Token | Variable | Value (Light Mode) | Purpose |
| :--- | :--- | :--- | :--- |
| **Vellum** | `--wk-vellum` | `#FFF9EB` | Global page background, column header cards |
| **Linen** | `--wk-linen` | `#F0E7D7` | Section backgrounds, card containers, stat pills |
| **Ink** | `--wk-ink` | `#000000` | High-contrast body typography, order titles |
| **Graphite** | `--wk-graphite` | `#4D4B47` | Subheaders, metadata labels, timestamps |
| **Oxblood** | `--wk-oxblood` | `#370808` | Primary brand accent, button backgrounds, borders |
| **Gold / Amber** | `--wk-gold` | `#F8E47D` | SLA urgent alerts, system warning banners |
| **Green** | `--wk-green` | `#1E6B3A` | Ready items, arrived riders, on-time badges |
| **Red / Breach** | `--wk-red` | `#C0392B` | Station overload, SLA breaches, stock shortages |
| **Buttered Gold** | `--wk-buttered-gold` | `#FFF8D6` | Ready-to-pack order highlight tint |

### 2.2 Typography
- **Display Numerals & Order Numbers**: `'Libre Caslon Text', Georgia, serif`
- **UI & Controls**: `'Inter', 'Helvetica Neue', Arial, sans-serif`
- **Tabular Figures**: Numeric counters, live clocks, and countdown timers use `font-variant-numeric: tabular-nums` with fixed-width CSS containers to prevent layout shifting/jitter.

### 2.3 Layout Dimensions
- **Header Height (`--wk-hh`)**: `56px`
- **System Banner Height (`--wk-bh`)**: `44px`
- **Column Subheader Height (`--wk-ch`)**: `44px` (with `16px` padding and `17px` vertical headspace)
- **Border**: `1px solid var(--wk-oxblood)`
- **Corner Radius (`--wk-r`)**: `5px`

---

## 3. System Architecture & Tech Stack

- **Core Framework**: React 18 + TypeScript (Strict Mode)
- **Bundler**: Vite 6
- **State Management**: Centralized single-source-of-truth mutable state architecture with reactive version ticking and zero external state library overhead.
- **Audio Engine**: Web Audio API synthesized tones (chimes for new orders, SLA alerts, rider arrivals, and handovers).
- **Dual Build Deployment**:
  1. **Web / Cloud Target (`dist/index.html`)**: Standard Vite module output for Vercel and GitHub Pages.
  2. **Offline Standalone Target (`index.html` & `standalone.html`)**: Post-build inlining script (`post-build.mjs`) embeds all CSS/JS assets directly into a single self-contained HTML file for zero-dependency offline local execution.

---

## 4. Comprehensive Layout Breakdown

The interface consists of a fixed top bar and a 4-column widescreen Kanban grid (`18% | 32% | 30% | 20%`).

```
+---------------------------------------------------------------------------------------------------------------------------------------+
| TOP HEADER (56px): [Logo] WILLOW KITCHEN | [✓ Open | ⛔ Close] [Auto-Accept: ON/OFF] | Stats | Station Loads | Clock 🔔 [OOS][Stop][+New] |
+-------------------------------+-----------------------------------+-----------------------------------+-------------------------------+
|   COLUMN 1: JUST CAME IN      |       COLUMN 2: COOKING NOW       |     COLUMN 3: STATION QUEUES      |  COLUMN 4: DISPATCH & POOL    |
|            (18%)              |               (32%)               |               (30%)               |             (20%)             |
+-------------------------------+-----------------------------------+-----------------------------------+-------------------------------+
| • Inbound new orders          | • Active cooking orders           | • HOT Station (1/3 height)        | TOP 50%:                      |
| • Auto-cancel SLA timer (150s)| • Order cards with SLA countdown  |   - Cooking on top                | ├─ Packed & Waiting (2-col)   |
| • Opportunity badges:         | • Station item checklist          |   - Queued below                  | └─ Riders Waiting (2-col)     |
|   - Prep Together             | • Item states:                    | • GRILL Station (1/3 height)      |                               |
|   - Up for Grabs match        |   Queued -> Cooking -> Ready      | • ASSEMBLY Station (1/3 height)   | BOTTOM 50%:                   |
| • Accept & Reject controls    | • "Pack Order" action             | • Drag-and-drop reordering        | └─ Up for Grabs (Waste Pool)  |
+-------------------------------+-----------------------------------+-----------------------------------+-------------------------------+
```

---

### 4.1 Fixed Top Navigation Bar (`Header.tsx`)
- **Brand Identity**: Custom Willow tree emblem + uppercase `WILLOW KITCHEN` title.
- **Outlet Status Switch**: Segmented toggle `[ ✓ Open | ⛔ Close ]`. The application defaults to **Closed** upon startup until opened by the manager.
- **Auto-Accept Switch**: Segmented control `[ Auto-Accept: ON | Auto-Accept: OFF ]`. When ON, inbound orders bypass Column 1 and enter the active kitchen queue instantly.
- **Live Backlog Stat Pills**:
  - `Cooking [ N ]`: Count of active orders currently in preparation.
  - `Waiting [ N ]`: Count of pending unaccepted orders.
  - `Done Today [ N ]`: Cumulative total of completed orders for the active shift.
- **Station Load Segment Tracks**: Real-time load indicators for `HOT`, `GRILL`, and `ASSEMBLY` stations (0 to 10 scale) with color transitions (Green $\rightarrow$ Amber $\rightarrow$ Red overload alert).
- **System Clock & Sound Toggle**: Formatted 12-hour clock (`hh:mm:ss a`) and interactive audio bell toggle (`🔔` / `🔕`).
- **Utility Actions**:
  - `[ Out of Stock ]`: Opens modal to toggle 8-brand items in/out of stock.
  - `[ ⏸ Stop Apps ]`: Pauses channel aggregators (Swiggy, Zomato, App) for 15m, 30m, 1h, or 2h.
  - `[ + New Order ]`: Opens modal to manually place custom walk-in/phone orders.

---

### 4.2 Column 1: Just Came In (`Dashboard.tsx`, `NewOrderCard.tsx`)
- **Width**: `18%` (minimum `240px` on responsive screens).
- **Purpose**: Displays pending inbound delivery orders requiring kitchen review.
- **Key Features**:
  - **Auto-Cancel Countdown**: Prominent 150-second timer. If unaccepted within the window, the order auto-cancels.
  - **Channel & Brand Tagging**: Clear badges indicating delivery platform (`Swiggy`, `Zomato`, `App`, `Phone`) and brand (*Burger Craft*, *Grill House*, *Bowl & Salad Co.*).
  - **Smart Match Badges**:
    - `Prep Together`: Flags items that can be prepped simultaneously with items already cooking in station queues.
    - `Up for Grabs`: Flags items available in the cancelled food pool for instant fulfillment.
  - **Actions**: `[ Accept ]` (moves order to Column 2; prompts pool usage if items match) and `[ Reject ]` (triggers reject reason overlay with 6-second undo toast).

---

### 4.3 Column 2: Cooking Now (`Dashboard.tsx`, `ActiveOrderCard.tsx`)
- **Width**: `32%` (minimum `340px` on responsive screens).
- **Purpose**: Tracks all active orders currently being cooked, plated, and packed.
- **Key Features**:
  - **SLA Countdown Timer**: Real-time 15-minute target countdown with color-coded warnings (Green $\rightarrow$ Amber at $<2\text{m}$ $\rightarrow$ Red SLA breach glow).
  - **Item State Machine**: Each item inside an order card cycles through four discrete operational states:
    $$\text{Queued} \longrightarrow \text{Cooking} \longrightarrow \text{Ready} \quad (\text{or } \text{Hold})$$
  - **Ready-to-Pack Highlight**: When all items in an order hit `Ready`, the entire card transforms with a buttered gold glow (`--wk-buttered-gold`).
  - **Packing & Auto-Handover**:
    - If the assigned rider is already at the store (`status === 'arrived'`), packing triggers immediate handover and delivery celebration.
    - If the rider is still in transit, packing moves the order into Column 4 (*Packed & Waiting*).

---

### 4.4 Column 3: Station Queues (`Column3.tsx`)
- **Width**: `30%` (minimum `300px` on responsive screens).
- **Purpose**: Deconstructs multi-brand orders into station-specific preparation streams.
- **Structure**: Divided into **3 equal, fixed 1/3 height zones**:
  1. **HOT Station** (Burgers, hot mains)
  2. **GRILL Station** (Fries, skewers, wings, tikkas)
  3. **ASSEMBLY Station** (Buns, dips, salads, bowls)
- **Internal Independent Scrolling**: Each station box has its own `.wk-scroll` container, preventing one station from expanding and pushing others offscreen.
- **Queue Hierarchy & Prioritization Logic**:
  1. **🔥 Cooking Items Always on Top**: All items actively cooking occupy the top of the queue.
  2. **Sequential Priority Stacking**: When the manager clicks `[Prep]` on any queued item (even item #5), it immediately jumps to the top of the queue, **placed directly below currently cooking items**.
  3. **⏳ Queued Items Below**: Unstarted items sit below cooking items in order of arrival.
  4. **⏸ Hold Items at Bottom**: Items placed on hold sit at the bottom.
- **Prep Together Units**: Grouped batches of identical items across multiple orders display with a `Prep Together` batch action and individual item controls.
- **Full Drag-and-Drop**: Supports dragging individual items, grouped cooking batches, and Prep Together cards up and down the queue with manual `▲` / `▼` button fallbacks.

---

### 4.5 Column 4: Dispatch, Riders & Up for Grabs (`Column4.tsx`)
- **Width**: `20%` (minimum `260px` on responsive screens).
- **Structure**: Divided into **two distinct 50% halves**:

#### Top Half (50%): Divided Equally (25% / 25%)
1. **Packed & Waiting (Top 25%)**:
   - Arranged in a compact **2-column grid**.
   - Displays orders that are fully cooked and packed in bags, waiting for rider pickup.
   - Shows assigned rider name, in-transit travel countdown (`🚴 02:45 away`), and manual `[ 📢 Call Rider ]` trigger.
2. **Riders Waiting (Bottom 25%)**:
   - Arranged in a compact **2-column grid**.
   - Displays riders who have **physically arrived at the kitchen** (`🟢 Arrived`) whose assigned orders are **still cooking**.
   - Shows rider name, platform badge (`SWIGGY`, `ZOMATO`, `APP`), and assigned order number (`For #102`).
   - **Zero Duplication**: Once an order finishes cooking and is packed, the rider is displayed only in *Packed & Waiting* and removed from *Riders Waiting*.

#### Bottom Half (50%): Up for Grabs (Waste Reduction Pool)
- Dedicated 50% scrollable container.
- Holds prepared food items from cancelled orders for up to **30 minutes** (1,800 sim-seconds).
- Displays item quantity, name, station, cancellation origin (*Cancelled by Customer* / *Cancelled by Kitchen*), age, and remaining expiry countdown.
- Automatically prompts the kitchen to consume matching ready items when a new order arrives, saving prep time and preventing food waste.

---

## 5. Multi-Brand Configuration & Simulation Engine

### 5.1 Multi-Brand Menu Roster (`config.ts`)
| Brand | Station | Color | Sample Items & Prep Times |
| :--- | :--- | :--- | :--- |
| **Burger Craft** | `Hot` | `#8B1A1A` | Classic Cheese Burger (22s), Chicken Double Patty (25s), Truffle Mushroom (25s) |
| **Grill House** | `Grill` | `#2D5A2D` | Peri Peri Fries (22s), BBQ Skewers (32s), Paneer Tikka (28s), Wings (30s) |
| **Bowl & Salad Co.** | `Assembly` | `#1A4A6B` | Brioche Buns (20s), Teriyaki Protein Bowl (24s), Mediterranean Salad (22s) |

### 5.2 Real-Time Order Generation & Density Control
- **Order Density**: Rate-limited to a maximum of **15 orders per 2 minutes real time** (minimum 6-second interval between arrivals).
- **Multi-Brand Mixing**: ~20% of generated orders contain items from multiple brands in a single delivery order.

### 5.3 Rush Session & Analytics Flow
1. **Rush Session**: Runs for a defined 5-minute cycle (`RUSH_SESSION_SECS = 300`).
2. **Natural Slowdown**: When the rush session concludes, incoming simulated orders stop naturally.
3. **Strict Zero-Interruption Guard**: The Rush Summary modal will **NEVER** pop up while active orders remain on the board. Only once the kitchen completes and clears every active order (`activeOrders.length === 0`) does the summary appear.
4. **Analytics Metrics**:
   - **On-Time SLA %**: Percentage of orders completed within the promised 15-minute window.
   - **Average Time per Order**: Calculated in **system simulation minutes** (e.g. `11.4 min`).
   - **Busiest Station**: Identifies peak bottleneck station and maximum load percentage.
   - **Cold Orders**: Count of packed orders that sat waiting for riders exceeding cold threshold.
   - **Orders Turned Away**: Total rejected/declined orders.
   - **Action**: Includes `[ 📥 Download Summary ]` button and `[ Close & Start Fresh ]`.

---

## 6. Responsive Breakpoint Rules

| Breakpoint | Target Devices | Responsive Behavior |
| :--- | :--- | :--- |
| **$\ge 1200\text{px}$** | Widescreen Desktop / POS Displays | Standard 4-column fixed grid (`18% 32% 30% 20%`). |
| **$960\text{px} - 1199\text{px}$** | iPad Pro / Tablet Landscape | Kanban grid transitions to horizontal swipeable layout with min-widths (`240px minmax(340px, 1.2fr) minmax(300px, 1fr) 260px`). Station load tracks compress to `44px`. |
| **$768\text{px} - 959\text{px}$** | Tablet Portrait / iPad Mini | Station tracks compress to `32px`, button paddings scale down to `4px 6px`, clock scales to `10px`, and brand title compacts to `WILLOW`. |
| **$\le 820\text{px}$** | Mobile / Small Tablet | Header enables momentum horizontal touch scrolling (`.wk-header-bar`) to prevent button clipping. |

---

## 7. Operational Workflow Cheatsheet

```
[Inbound Order arrives via Swiggy/Zomato/App]
                     │
                     ▼
             [Just Came In]
             ├─ Auto-Accept ON? ──> Auto-accepts instantly
             └─ Manual Review   ──> Click [Accept] / [Reject]
                     │
                     ▼
               [Cooking Now]  <─── Items appear in [Station Queues] (Hot, Grill, Assembly)
                     │
                     ├─ Click [Prep] ───> Item jumps to TOP of queue (below existing cooking items)
                     ├─ Click [Hold] ───> Temporarily holds item to sync multi-item prep
                     └─ All items Ready ──> Card glows gold! Click [Pack Order]
                     │
                     ▼
             [Packed & Waiting]
                     │
                     ├─ Rider in transit ──> Countdown displayed (e.g. 2m away)
                     ├─ Rider arrived    ──> Shows [🟢 Arrived]
                     └─ Handover         ──> Click [Handover] (or auto-delivered)
```

---

## 8. Summary of File Tree & Key Modules

- [`src/app/components/dashboard/Dashboard.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/Dashboard.tsx): Main dashboard orchestrator, audio engine, state loops, system banners, and acceptance logic.
- [`src/app/components/dashboard/Header.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/Header.tsx): Fixed top navigation bar, status switches, load indicators, and utility action buttons.
- [`src/app/components/dashboard/Column3.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/Column3.tsx): Station Queues (Hot, Grill, Assembly), drag-and-drop engine, and cooking priority stacking.
- [`src/app/components/dashboard/Column4.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/Column4.tsx): 50/50 split for Packed & Waiting (2-col), Riders Waiting (2-col), and Up for Grabs pool.
- [`src/app/components/dashboard/NewOrderCard.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/NewOrderCard.tsx): Inbound order cards with auto-cancel timers and smart match indicators.
- [`src/app/components/dashboard/ActiveOrderCard.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/ActiveOrderCard.tsx): Active cooking order cards with SLA timers and item checklist toggles.
- [`src/app/components/dashboard/Modals.tsx`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/Modals.tsx): Modals for Out of Stock, Pause Channels, Add Order, Reject Reason, and Rush Summary Analytics.
- [`src/app/components/dashboard/config.ts`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/app/components/dashboard/config.ts): Multi-brand menu configuration, SLA constants, initial state defaults.
- [`src/styles/globals.css`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/src/styles/globals.css): Design tokens, responsive media queries, animations, and typography rules.
- [`post-build.mjs`](file:///c:/Users/tarun/Creative%20Zone/Willow%20Kitchen/CloudKitchen-main/post-build.mjs): Standalone single-file HTML bundler script.
