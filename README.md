Willow Kitchen

A high-density, real-time multi-brand cloud kitchen order management dashboard
designed for rapid pass-through optimization, automated logistics coordination,
and food waste reduction.

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  COL 1: NEW     │  COL 2: COOKING │  COL 3: STATIONS│  COL 4: HANDOVER│
│  • Auto-accept  │  • SLA priority │  • Hot Station  │  • Packed Orders│
│  • Channel src  │  • Live progress│  • Grill Station│  • Riders (2-col│
│  • Accept/Reject│  • Auto-handover│  • Assembly Stn │  • Up for Grabs │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

📖 Project Overview

Willow Kitchen is an operational dashboard built specifically for multi-brand
cloud kitchens. In high-volume environments running up to 80 orders per hour
across multiple virtual brands, typical software interfaces introduce cognitive
overload.

This platform unifies inbound order streams from aggregators (Swiggy, Zomato),
proprietary first-party applications (App), and telephone orders (Phone) into a
synchronized 4-column kanban board. By deconstructing complex orders into
station-specific preparation streams and automating courier handovers, the
system helps kitchen managers maintain a quiet, visual, and highly efficient
workflow under pressure.

⚡ Core Capabilities & Features

1. Symmetrical 4-Column Workflow

The interface systematically maps the physical lifecycle of an order from
order reception to delivery:

  - Column 1: Just Came In: Houses incoming tickets requiring manual
    triage (when Auto-Accept is disabled) with an integrated 150-second
    auto-cancel countdown timer.
  - Column 2: Cooking Now: Pinned cards sorted dynamically by
    remaining SLA time. Tracks multi-item preparation, item-level holds, and
    auto-packing triggers.
  - Column 3: Station Queues: Splits tickets into dedicated
    horizontal lanes (Hot, Grill, and Assembly) so cooks see only their specific
    tasks, complete with parent Order ID tracking and individual queue
    prioritization.
  - Column 4: Handover & Recovery: Divided into packed orders
    waiting for couriers, arrived riders waiting for cooking tickets, and the
    canceled stock recovery pool.

2. "Up for Grabs" (Canceled-Item Reuse Loop)

Mid-prep cancellations are a primary cause of food waste and margin loss in
cloud kitchens.

  - When an active order is canceled, prepped items automatically route to a
    dedicated Up for Grabs pool in Column 4.
  - Each item is tracked with a strict 30-minute
    freshness countdown bar.
  - If a new order lands requiring a matching item, the manager is prompted with
    a 1-click reassignment trigger (↺ Fulfill from Canceled), bypassing the cook
    stations and delivering the new order instantly.

3. Symmetrical, Single-Row Responsive Header

Designed for high-contrast legibility from a distance (6–8 feet) under harsh,
reflective kitchen lights.

  - Uses a warm parchment background (--wk-vellum) and deep primary brand
    outlines (--wk-oxblood) in place of generic B2B drop shadows.
  - Organizes global state switches, active backlog metrics, station load
    tracks, clock counters, and quick actions into four perfectly centered,
    equal-width visual columns.

4. Zero-Click Logistics Sync

  - When an order finishes cooking and is marked as packed, the system checks
    the courier status.
  - If the assigned rider is already waiting at the store, the system
    automatically triggers the handover, clearing the card and playing a
    localized audio chime, bypassing manual touch-screen verification.

🛠️ Technology Stack

  - Frontend: React 18 + TypeScript (Strict Mode)
  - Build Tooling & Bundler: Vite 6
  - CSS & Layout Engine: Tailwind CSS
  - State Architecture: Centralized, single-source-of-truth mutable state engine
    with reactive tick rendering (no heavy external global state overhead).
  - Acoustic Engine: Synthesized Web Audio API tones (clean sine-wave sweeps)
    for zero-latency alert delivery without external asset dependency.

📁 Repository Structure

├── public/
├── src/
│   ├── app/
│   │   └── components/
│   │       └── dashboard/
│   │           ├── Dashboard.tsx        # Audio engine, state loops, acceptance logic
│   │           ├── Header.tsx           # Widescreen navigation & load tracking
│   │           ├── Column3.tsx          # Station Queues & priority sequencing
│   │           ├── Column4.tsx          # Packed orders, riders, & Up for Grabs pool
│   │           ├── NewOrderCard.tsx     # Inbound cards & auto-cancel triggers
│   │           ├── ActiveOrderCard.tsx  # SLA count-downs & item checklists
│   │           ├── Modals.tsx           # OOS toggles, Stop Apps, Analytics
│   │           └── config.ts            # Brand menus & initial parameters
│   └── styles/
│       └── globals.css                  # Color tokens, breakpoints, typography
├── package.json
├── post-build.mjs                       # Standalone single-file HTML bundler script
└── vite.config.ts

Thank you for reading this!!!

The original project is available [Here](https://willow-kitchen.vercel.app/).
