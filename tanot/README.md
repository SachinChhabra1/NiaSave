# Tanot · 2 Para Ops

A working frontend MVP for Tanot, the enterprise-demand product in Para2's Ops suite alongside Polo and Bison: campaign → account → qualified demand → contract → Studio allocation → mobilisation → live.

## Included

- Demand command centre with campaign-to-live funnel
- Campaign creation, status filters, and live attribution metrics
- Enterprise account records
- Evidence-gated opportunity pipeline
- Studio demand coverage and capacity gaps
- Activation cohorts with live-member recording
- Resource-level BD executive funnels and opportunity ownership
- Deterministic insight engine for activation leakage, stage stalls, follow-up hygiene, executive conversion, and Studio demand gaps
- Evidence-backed management readout with unresolved-cause labels, owner/due/proof action register, filters, snapshots, and Markdown export
- Persistent browser state using `localStorage`
- Responsive desktop and mobile layouts

## Design system

The shell follows the existing Para2 product architecture used by Bison and Polo: a Nia mark with the Tanot name in the top header, a 260px operating rail, explicit `2 Para · Ops` sibling context, SF/system typography, a `#f6f8fb` canvas, `#0a84ff` accent controls, and border-first 16px surfaces. Tanot's header uses a restrained crop of a Longewala Post photograph to create a distinct product identity without reducing operating density.

Header photograph: [Longewala Post](https://commons.wikimedia.org/wiki/File:Longewala_Post.jpg) by Nirmal Katariya3, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The image is cropped in the interface.

All seeded records are illustrative demo data.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

The current suite checks funnel totals, activation-gap actions, evidence/cause separation, persisted action state, and report export.

## MVP boundary

This version proves the end-to-end workflow and data model in the browser. Production deployment still needs authentication, a shared database, email/calendar adapters, member-system integration, Studio-capacity integration, audit-event persistence, and role-based permissions.

## Key files

- `src/App.jsx` — application state and workflows
- `src/pages.jsx` — product surfaces
- `src/components.jsx` — shell, tables, drawer, and campaign creation
- `src/data.js` — illustrative seed data and lifecycle stages
- `src/insightEngine.js` — report metrics, rules, actions, and Markdown export
- `src/insightEngine.test.js` — deterministic insight-engine tests
- `src/styles.css` — design system and responsive behavior
- `tanot-preview-rendered.jpg` — verified desktop implementation
