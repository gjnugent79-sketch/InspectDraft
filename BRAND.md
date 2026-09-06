# InspectDraft brand system

Shared visual language for InspectDraft and future field-trust products (US home inspectors).

> **Note:** An earlier amber-on-dark-slate theme was temporary for Milestone 1 scaffolding. This document is the canonical system from Gary’s brand board (`assets/brand/brand-board.png`).

## Positioning

**Field-trust professional tool** — modern, clean, and credible.  
Deep navy chrome + light content cards + green success/CTA accents. AI is a quiet assistant that only structures *their* words.

## Name

**InspectDraft** — companion draft tool for inspectors between the driveway and the final report.

Wordmark: **Inspect** (Deep Navy or white on dark) + **Draft** (Green Accent).

## Voice

- Direct, calm, jobsite-literate; professional and modern
- Short sentences; prefer “notes → draft → verify” over hype
- Never claim AI invents findings or replaces professional judgment
- Labels: “Stub AI” / “AI-assisted structuring — verify all findings”

### Slogans & lockups

| Use | Copy |
|-----|------|
| **Primary slogan** | Smarter home inspections. Faster, easier, more accurate. |
| **Marketing** | The modern way to inspect properties. |
| **Mission** | Built for the people who keep homes safe. |
| **Tagline lockup** | `INSPECT / CAPTURE / REPORT` |
| **Alt** | Better inspections. Brighter futures. |

## Logo

| Asset | Path | Use |
|-------|------|-----|
| Mark (white house) | `assets/brand/logo-mark.svg` | Navy headers, dark surfaces |
| Mark (navy house) | `assets/brand/logo-mark-navy.svg` | Light backgrounds |
| Horizontal lockup | `assets/brand/logo-horizontal.svg` | Landing, PDF/export header |
| App icon | `assets/brand/app-icon.svg` | Favicon / PWA-style icon |

**Mark rules:** House outline with 4-pane window; green checkmark overlaps bottom-left. Do not recolour the check away from Green Accent. Do not drop the window panes.

## Type

| Role | Family | Use |
|------|--------|-----|
| **Logo + headlines** | [Montserrat](https://fonts.google.com/specimen/Montserrat) | Wordmark, H1–H2, landing hero |
| **UI / body** | [Inter](https://fonts.google.com/specimen/Inter) | Controls, meta, body copy |

Fallback stack: `system-ui, Segoe UI, sans-serif`.

## Colour tokens (board)

| Token | Hex | Role |
|-------|-----|------|
| **Deep Navy** | `#0B2D4A` | Primary branding, headers, dark chrome, tertiary buttons |
| **Green Accent** | `#00C853` | “Draft” in logo, primary CTAs, success, checkmarks |
| **Sky Blue** | `#3B82F6` | Secondary interactive (Add Note style), links |
| **Cool Grey** | `#E5E7EB` | Light backgrounds, dividers, subtle UI |
| **Charcoal** | `#1F2937` | Body text, icons, sub-headers on light |

### CSS mapping (light field UI — default)

| CSS token | Approx | Role |
|-----------|--------|------|
| `--brand-navy` | `#0B2D4A` | Header chrome, navy buttons |
| `--brand-green` / `--brand-accent` | `#00C853` | Primary CTA |
| `--brand-sky` / `--brand-secondary` | `#3B82F6` | Secondary actions |
| `--brand-bg` | `#E5E7EB` / near-white | App canvas |
| `--brand-bg-elevated` | `#0B2D4A` | Sticky header / bottom nav (navy chrome) |
| `--brand-bg-card` | `#FFFFFF` | Content cards |
| `--brand-text` | `#1F2937` | Body |
| `--brand-text-on-navy` | `#FFFFFF` | Text on navy chrome |

Dark theme (optional toggle) keeps navy surfaces + green accents; it is not the marketing default.

### Semantic badges

- **DRAFT** — Sky Blue
- **SAMPLE** — Green Accent
- **Progress** (e.g. `7/12 sections`) — Green Accent
- **Warn / stub** — amber-adjacent warn token (not a brand primary)

## Graphic accents

Diagonal stripe motif (Green / Sky Blue / Deep Navy) used **sparingly** — landing hero edge, card accent bars — never as full-bleed wallpaper.

## UI direction

- **Headers / chrome:** Deep Navy, white text/icons
- **Content:** Light Cool Grey / white cards with subtle borders/shadows
- **Primary CTA:** Green `#00C853` + white label (e.g. Download Report, Structure notes)
- **Secondary action:** Sky Blue `#3B82F6` + white (e.g. Add Note)
- **Tertiary / Take Photo style:** Deep Navy + white
- **Completed / Good:** Green checkmarks

## CSS

Expose board colours as CSS variables under a `:root` **Brand tokens** block (see `css/styles.css`). Map app aliases (`--bg`, `--accent`, …) to brand tokens so screens stay consistent.

## Do / don’t

| Do | Don’t |
|----|--------|
| Montserrat headlines + Inter UI | Soft purple “AI gradient” chrome |
| Navy chrome + light cards + green CTA | Rainbow accents or neon cyan chatbot look |
| Quiet disclaimer that AI only structures their words | “Magic report” / invent-findings language |
| Green check for success / completed sections | Revive the temporary amber/slate theme as default |
