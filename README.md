# InspectDraft

Mobile-friendly web prototype for US home inspectors: turn field notes + photos into a system-by-system editable draft report, then print / save as PDF.

**AI structures the inspector’s own words only — it never invents defects.**

This is Milestone 1: a local-only demo (no auth, backend, or real STT API).

Brand system (Deep Navy / Green Accent / Sky Blue — see **[BRAND.md](./BRAND.md)** and `assets/brand/`). Amber-on-slate was temporary.

## Quick start

From this directory:

```bash
cd /workspace/inspectdraft
python3 -m http.server 8765
```

Then open **http://localhost:8765** in a browser (phone or desktop).

Marketing landing is the default (`/`). Use **Try sample job** or **Open app** to enter the Jobs flow.

No build step. Vanilla HTML / CSS / JS. Data persists in `localStorage`.

## What works

1. **Landing** — headline, benefits, screenshot strip, CTAs into the app
2. **Jobs list** — create / open / delete jobs (address, client, date, inspector)
3. **Seeded sample job** — Austin address with Roof, Electrical, Plumbing, HVAC, Exterior, Grounds, Limitations already filled so the demo works immediately
4. **12 core sections** — Roof, Exterior, Structure, Electrical, Plumbing, HVAC, Interior, Insulation/Ventilation, Appliances, Garage, Grounds, Limitations / Not Inspected (default template)
5. **Opt-in optional systems** — Pool / Spa, Irrigation / Sprinklers, Outbuildings / Detached structures, Dock / Waterfront. Add via **＋ Add optional system** on Sections (preset picker). Not added → omitted from list and PDF. Added but empty → Not recorded (same as core). Removable with confirm. Sample job leaves optionals off.
6. **Custom optional systems** — ☰ (**Add custom system**) opens a name + icon picker (house, pool, solar, tree, fence, flame, water, wrench, camera, bolt, shield, warehouse). Creates a job-only optional (id, title, iconKey in localStorage). Same omit / Not recorded / removable rules as presets. Does not alter the core 12.
7. **Per section** — text notes, photos (file / camera), editable findings; **Structure notes** is the hero action
8. **Empty sections** — hint: “Walk a system, add notes, structure, export.”
9. **Structure notes (stub AI)** — client-side heuristics split notes into `{observation, recommendation}`; labeled as stub AI; confirms before replacing findings
10. **Edit / delete findings** before export
11. **Preview + Export** — print-friendly HTML report; browser Print → Save as PDF
12. **Disclaimer footer** — *“Draft for professional review. AI-assisted structuring — verify all findings.”*
13. **Empty sections** → **Not recorded** (blank ≠ pass)
14. **Light field UI** (navy chrome) with optional dark toggle; large tap targets, mobile-first layout

## Out of scope (by design)

Auth, Stripe, real speech-to-text APIs, Spectora integration, backend server, GitHub push.

## Screenshots

Captured with headless Chrome (mobile + report):

- `assets/screenshots/00-landing.png` — marketing landing
- `assets/screenshots/01-jobs.png` — jobs list with sample
- `assets/screenshots/02-sections.png` — system list + progress
- `assets/screenshots/03-section-roof.png` — notes, findings, Structure notes hero
- `assets/screenshots/03b-section-empty.png` — empty section hint
- `assets/screenshots/04-preview.png` — print-style preview
- `assets/screenshots/05-export-report.png` — export / print view

Deep links (for demos): `/?view=landing`, `/?view=jobs`, `/?view=sections`, `/?view=section&section=roof`, `/?view=preview`, `/?view=export`.

## Project layout

```
inspectdraft/
  index.html
  BRAND.md
  css/styles.css           # brand tokens + UI
  js/data.js               # core + optional sections, sample job, stub AI
  js/app.js                # SPA + localStorage
  assets/brand/            # logo SVGs + brand-board.png
  assets/screenshots/
  README.md
```

## Reset demo data

In the browser console:

```js
localStorage.removeItem('inspectdraft_v1');
location.reload();
```

That restores the seeded sample job.

## Product note

InspectDraft is a **companion draft tool**, not a certified final report. Inspectors must review every finding before delivery to clients.
