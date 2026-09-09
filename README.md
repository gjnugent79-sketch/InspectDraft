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
2. **Jobs list** — create / open / delete jobs (address, client, date, inspector, optional company/phone/email). Edit details from a job’s Sections header.
3. **Inspection conditions** — occupancy, time of day, weather, outdoor temp (°F default / °C toggle), building type. Stored on the job; migrate old jobs with defaults; shown on Sections chips + Preview/PDF header.
4. **Seeded sample job** — Austin address with sample conditions and Roof, Electrical, Plumbing, HVAC, Exterior, Grounds, Limitations filled (location + trade on key findings)
5. **12 core sections** — Roof, Exterior, Structure, Electrical, Plumbing, HVAC, Interior, Insulation/Ventilation, Appliances, Garage, Grounds, Limitations / Not Inspected (default template)
6. **Opt-in optional systems** — Pool / Spa, Irrigation / Sprinklers, Outbuildings / Detached structures, Dock / Waterfront. Add via **＋ Add optional system** on Sections (preset picker). Not added → omitted from list and PDF. Added but empty → Not recorded (same as core). Removable with confirm. Sample job leaves optionals off.
7. **Custom optional systems** — **＋ Custom** opens a name + icon picker (house, pool, solar, tree, fence, flame, water, wrench, camera, bolt, shield, warehouse). Creates a job-only optional (id, title, iconKey in localStorage). Same omit / Not recorded / removable rules as presets. Does not alter the core 12.
8. **Per section** — text notes, photos, editable findings; **Structure notes** is the hero action
9. **Finding location + trade** — optional location text and trade/specialist select (Roofing, Concrete, Landscaping/Irrigation, Gutter, Electrical, Plumbing, HVAC, Handyman/DIY, General contractor, Other). Shown on finding cards, Punch list, Preview, and PDF.
10. **Address autocomplete** — New/Edit job address suggests OpenStreetMap Nominatim results (debounced, no API key). Free text still works. Attribution: © OpenStreetMap.
11. **Comment library** — **Library** on field notes or finding editor inserts US-inspection observation snippets by system. Save current text as a custom snippet (localStorage). Optional Safety / Major / Maintenance tags on findings.
12. **Photo markup** — tap a photo (or after a single capture) to draw circle / arrow / pen, then Undo or Done. Marked-up JPEG replaces the photo.
13. **Camera vs Photo library** — section capture has two actions so iPhone Safari is not camera-only: **Camera** (`capture="environment"`) and **Photo library** (no `capture`).
14. **Empty sections** — hint: “Walk a system, add notes, structure, export.” Empty → **Not recorded** (blank ≠ pass)
15. **Structure notes (stub AI)** — client-side heuristics split notes into `{observation, recommendation}`; labeled as stub AI; confirms before replacing findings
16. **Edit / delete findings** before export
17. **Punch list (snagging)** — cross-job repair summary (not a 13th building system). Auto-includes Safety / Major / Maintenance findings; **Add to punch list** for others (`onPunchList`). Bottom nav + Sections card + Preview entry. Preview/PDF section **Punch list / Repair summary** before Limitations.
18. **Preview + Export** — branded print-friendly HTML report (navy/green header, conditions strip, severity + trade badges, professional footer); browser Print → Save as PDF
19. **Disclaimer footer** — *“Draft for professional review. AI-assisted structuring — verify all findings.”*
20. **Light field UI** (navy chrome) with optional dark toggle; large tap targets, mobile-first layout

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

Deep links (for demos): `/?view=landing`, `/?view=jobs`, `/?view=sections`, `/?view=section&section=roof`, `/?view=punchlist`, `/?view=preview`, `/?view=export`.

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
