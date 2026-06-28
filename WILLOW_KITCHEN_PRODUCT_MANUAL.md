# Willow Kitchen KDS — Product Manual & Technical Specification
**Current Version**: 0.0.1 (Production Release)  
**System Type**: Multi-Brand Real-Time Kitchen Display System (KDS)  
**Target Architecture**: Cloud Kitchens & High-Throughput Delivery Hubs  

---

## 📑 Executive Summary

**Willow Kitchen** is a state-of-the-art Kitchen Display System engineered specifically for multi-brand cloud kitchens. It unifies order streams from online delivery aggregators (Swiggy, Zomato) and direct ordering channels into a synchronized, 4-column operational workflow.

### Key Capabilities:
- **Multi-Brand Routing**: Supports distinct virtual brands running under one physical kitchen roof.
- **Dynamic Load Balancing**: Real-time capacity monitoring across specialized kitchen prep stations (`Hot`, `Grill`, `Assembly`).
- **Zero-Click Logistics Sync**: Automatic handover celebrations when delivery riders arrive.
- **Inventory Recovery Pool**: 100% prepped stock recovery into an **"Up for Grabs"** holding pool upon order cancellations, eliminating food waste.
- **Automated Rush Cycles**: Built-in 5-minute rush session management with automatic screen cleanup and instant operational analytics.

---

## 🛠️ Technology Stack & System Design

- **Core Framework**: React with TypeScript & Vite bundler.
- **State Engine**: Centralized reactive state (`KDSState`) driven by a stable 1-second simulation clock advancing 3 simulated seconds per real second (~40% balanced operational speed).
- **Design System Tokens**:
  - `var(--kds-vellum)` (`#fcf8f2`) — Warm parchment background
  - `var(--kds-oxblood)` (`#370808`) — Deep primary brand accents
  - `var(--kds-linen)` (`#f4ebd7`) — High-contrast container fills
  - `var(--kds-ink)` (`#1c1917`) — Crisp legible typography

---

## 🏛️ Architecture & 4-Column Workflow

The user interface is organized into four dedicated columns representing the complete lifecycle of a cloud kitchen ticket:

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  COL 1: NEW     │  COL 2: COOKING │  COL 3: STATIONS│  COL 4: HANDOVER│
│  • Auto-accept  │  • SLA priority │  • Hot Station  │  • Packed Orders│
│  • Channel src  │  • Live progress│  • Grill Station│  • Riders (2-col│
│  • Accept/Reject│  • Auto-handover│  • Assembly Stn │  • Up for Grabs │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Column 1: New Orders (Incoming)
- Displays new incoming tickets requiring acceptance.
- Features automatic auto-accept countdown timers (`CFG.AUTO_CANCEL_SECS`).
- Prominently displays order channels (`SWIGGY`, `ZOMATO`, `OWN APP`).
- Provides instant **Start This Order** and **Decline** actions with structured rejection reason reporting.

### Column 2: Cooking Now (Active Preparation)
- **SLA Priority Sorting**: Tickets with the least remaining SLA preparation time are pinned strictly to the top of the column for immediate staff attention.
- Shows granular progress bars for every item and station assignment.
- **Zero-Click Auto-Handover**: When an order finishes cooking and its assigned rider is already waiting on-site, the order automatically hands over with a celebratory delivery notification toast (`🎉 Order #101 Picked Up & Delivered!`).

### Column 3: Station Queues & Bulk Workload Controls
- Divides active preparation items across three specialized kitchen stations:
  1. **Hot Station** (`Hot`): Fryers, sauté pans, and stovetop items.
  2. **Grill Station** (`Grill`): Griddles, charbroilers, and grilled meats/veggies.
  3. **Assembly Station** (`Assembly`): Dedicated station for assembling protein bowls, Mediterranean salads, dips, burger buns, and cold modifiers.
- **Bulk Station Controls**: Allows station chefs to execute **Prep All**, **Hold All**, or **Cook All** across their station queue in a single click.
- **Item Status Pills**: Clear status indicators (`Queued`, `Cooking`, `Hold`, `Ready`).

### Column 4: Logistics & Up for Grabs Inventory
Restructured into three clean operational sections:
1. **Section 1: Packed & Waiting**: Orders that are fully cooked and packed, waiting for rider arrival.
2. **Section 2: Riders Waiting**: Displays arriving riders in a compact, two-in-a-row grid featuring rider names, platforms, statuses (`transit` vs. `arrived`), and direct call triggers.
3. **Section 3: Up for Grabs (Inventory Pool)**: Prepped items preserved from customer or kitchen cancellations available for instant reassignment to new orders.

---

## 🍔 Virtual Brands & Menu Catalog

Willow Kitchen isolates orders by virtual brand to ensure kitchen stations operate with clean ticket boundaries.

### 1. Burger Craft (Station: Hot)
- Classic Cheese Burger (14s)
- Chicken Double Patty Burger (16s)
- Veg Patty Burger (12s)
- Paneer Fresh Burger (14s)
- BBQ Bacon Smash Burger (16s)
- Spicy Jalapeño Crispy Chicken (15s)
- Truffle Mushroom Swiss Burger (16s)
- Fiery Crispy Paneer Burger (14s)
- Double Stack Cheeseburger (16s)
- Mini Sliders Trio (12s)

### 2. Grill House (Station: Grill)
- Classic French Fries (10s)
- Peri Peri Crinkle Fries (12s)
- Loaded Cheese Fries (14s)
- Grilled Chicken Wings (6pcs) (14s)
- Smoky BBQ Chicken Skewers (15s)
- Grilled Paneer Tikka Bites (12s)
- Garlic Herb Grilled Chicken (16s)
- Crispy Golden Onion Rings (10s)
- Cheesy Loaded Potato Wedges (12s)
- Grilled Lamb Seekh Kebab (16s)

### 3. Bowl & Salad Co. (Station: Assembly)
- Brioche Burger Buns (8s)
- Extra Spicy Mayo Modifier (6s)
- Garlic Dip Portion (6s)
- Greek Mediterranean Salad (10s)
- Teriyaki Chicken Protein Bowl (12s)
- Mexican Burrito Power Bowl (12s)
- Chipotle Paneer Super Bowl (10s)
- Asian Sesame Tofu Bowl (10s)
- Classic Caesar Salad Bowl (8s)
- Creamy Ranch Dip Portion (6s)

---

## ♻️ Up for Grabs (Order Recovery & Waste Prevention)

When customers or kitchen managers cancel orders during active cooking or while waiting packed in Column 4:
- 100% of prepped items transition directly to the **Up for Grabs** inventory pool in Column 4 tagged with `canceledBy: 'Customer'` or `'Kitchen'`.
- Items remain active in the pool for 30 simulated minutes (`1800s`) with live expiration countdown progress bars.
- When a new incoming ticket matches items sitting in `Up for Grabs`, the system highlights them (`GRABS`, `↺ UP FOR GRABS`) and provides a 1-click reassignment action (`↺ Use Up for Grabs Items`) to fulfill tickets instantly without re-cooking fresh stock.

---

## ⏱️ Automated 5-Minute Rush Sessions & Shift Analytics

To keep kitchen operations running at peak efficiency, Willow Kitchen structures work into automated 5-minute rush cycles.

### Rush Session Flow:
1. **5-Minute Cycle (`300s`)**: The kitchen simulation runs active rush operations for 5 minutes.
2. **Automated Screen Cleanup**: At the 5-minute mark, active tickets across all 4 columns, waiting riders, and inventory holding pools automatically clear completely ("the whole thing becomes clean").
3. **Rush Summary Analytics Modal**: The system automatically pops open an analytics modal providing comprehensive shift metrics:
   - **On-Time Order Rate (%)**: Percentage of orders completed within SLA limits.
   - **Average Delivery Velocity**: Minutes per ticket from acceptance to handover.
   - **Busiest Station Load**: Identifies peak station bottlenecks (`Hot`, `Grill`, or `Assembly`).
   - **Cold Storage & Turn-Away Logs**: Tracks items sitting too long or rejected orders.
   - **Actionable AI Operational Tip**: Generates real-time suggestions for the next rush session.
4. **Session Reset**: Clicking *"Close & Start Fresh"* cleanly resets metrics and begins the next rush session whenever ready.

---

## 🛠️ Management & Operational Modals

- **Manual Order Entry (`+ New Order`)**: Customized specifically for cloud kitchen direct orders. Features customer name entries (`e.g. Rahul S.`), single-brand selection, and a full-height hug-content 2-column item grid (`560px` width) without internal scrollbars.
- **Channel & Brand Pausing**: Allows managers to temporarily pause Swiggy, Zomato, or specific brands during heavy rushes.
- **Out of Stock Management**: Provides quick single-click toggles (`In Stock` vs `Out of Stock`) across all menu items.

---

> *Note: This document reflects the complete product specification of the current local release.*
