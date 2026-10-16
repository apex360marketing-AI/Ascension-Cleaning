---
name: ascension-ui
description: The Ascension Cleaning design system (matte black, chrome gold, glass panels, Cormorant caps). Use before building or restyling any page, component, email or dashboard screen for this site so new UI matches public/index.html and public/dashboard/.
---

# Ascension UI

The brand reads as quiet luxury: a matte-black canvas, chrome-gold hairlines and
type, glass panels, uppercase serif headings. Nothing is bright and nothing is
rounded. When in doubt, use less: one gold accent per area, lots of black.

## Where the styles live

- `public/index.html`: the marketing site. Its CSS is inline and layered in passes
  (v2, v4, v6, v9, v13…). **Later blocks win, often with `!important`.** Read the
  bottom-most rule for a selector before you assume how it looks. The final palette
  is in the `v13 — HARDENING` block, not the `:root` at the top.
- `public/dashboard/dashboard.css`: the same language, rewritten clean for the
  owner dashboard. Prefer copying from here: it has no override layers.
- `public/privacy.html`: minimal page using the same tokens.

## Tokens (the final, live values)

| Token | Value | Use |
|---|---|---|
| Canvas | `#000` plus a faint gold radial glow top-right | page background |
| Text | `#EFE9DD` (body), `#F2EADA` (button labels), `#F7F1E3` (wordmark) | |
| Muted | `#A49C8C` | secondary copy. Never the old `#78808A` (fails AA) |
| Gold deep / mid / lit / white | `#A6874A` / `#D9C089` / `#F4E7C2` / `#FFF6DA` | accents, icons, rims |
| Rim | `rgba(217,192,137,.17)` (panels), `.22` (inputs), `.40` (buttons), `.82` (hover) | 1px borders |
| Hairline | `rgba(217,192,137,.09)` | row dividers |
| Gold gradients | `--cg-h` (horizontal), `--cg-v` (vertical), `--cg-t` (text) | 2px top edges, active bars, eyebrow text |
| Dark ink on gold | `#160E00` | text on a gold fill |

The old yellow/orange ramp (`#eed050`, `#b88010`, `rgba(190,138,10,…)`) and the
violet "neon" are **retired**. Don't reintroduce them.

## Type

- Headings h1–h4: `Cormorant Garamond` 400, **UPPERCASE**, letter-spacing 1.2–2px.
- Eyebrows/section labels: `Outfit` 300, uppercase, letter-spacing .12–.24em, gold
  gradient text (`.eyebrow`).
- Body and UI: `Inter` 400/500. Small labels: 10–11px, letter-spacing 2.4px, uppercase.
- Numbers in Cormorant default to old-style figures ("13" reads like "I 3"). Always add
  `font-variant-numeric: lining-nums tabular-nums` on stats and counts.
- Fonts come from Google Fonts. The CSP allows only `fonts.googleapis.com` and `fonts.gstatic.com`.

## Components

- **Button**: one style everywhere. Clipped corners
  `clip-path: polygon(10px 0%, calc(100% - 4px) 0%, 100% 10px, 100% calc(100% - 4px), calc(100% - 10px) 100%, 4px 100%, 0% calc(100% - 10px), 0% 4px)`,
  `rgba(10,10,10,.55)` fill, 1px `rgba(217,192,137,.40)` border, 10.5–12.5px uppercase
  Inter with 2.5px tracking. Hover: border to `.82`, fill `rgba(36,31,18,.72)`, inset
  gold glow. A gold-filled variant is for the single primary action on a screen.
- **Glass panel**: transparent or 1% white fill, `backdrop-filter: blur(26px) saturate(1.45)`,
  rim border, `inset 0 1px 0 rgba(255,250,235,.13)` top light, deep black drop shadow.
  A featured panel gets a 2px `--cg-h` line on its top edge. Don't nest glass inside glass.
- **Inputs**: square corners, dark fill, `.22` rim, gold focus ring `0 0 0 3px rgba(217,192,137,.08)`.
- **Segmented picker** (`.seg`): a row of tabs; the active one is filled with `--cg-h` and dark ink.
  Pickers are not buttons and don't use the button style.
- **Nav item** (drawer and dashboard sidebar): a number (`01`), then the label. Hover/active
  sweeps a gold gradient in from the left and lights a 2px vertical gold bar.
- **Logo**: the merkaba (two overlapping triangles) in gold gradient stroke, next to
  "ASCENSION" in Cormorant with wide tracking and a gold Inter tagline below.
  The dashboard keeps a simplified copy as `<symbol id="i-mk">` in `public/dashboard/index.html`.
- **Diamond bullet**: a 6–7px square rotated 45° in gold. Use it for list bullets, unread dots and status pills.
- **Toast**: bottom-centre, dark, gold rim.
- **Grain**: fixed `.grain` overlay at 3% opacity. Never put it on a scrolling element.

## Motion

Ease `cubic-bezier(.16,1,.3,1)`. Content rises 18–64px and fades in, staggered 60ms.
Hover lifts are small (`translateY(-3px…-7px)`). Animate only transform and opacity.
Always honour `prefers-reduced-motion`.

## Rules

- Status and meaning are never colour alone. Pair colour with a text label (pills) or an icon.
- Everything a visitor typed is untrusted. In plain-JS templates, run it through `esc()`
  (see `public/dashboard/app.js`) before it goes into `innerHTML`.
- The CSP is strict: scripts and styles from `'self'` (inline is allowed) and fonts from
  Google. Don't use CDN scripts or images: bundle them, or put them in `public/`.
- Mobile: single column below 900px. The dashboard swaps its sidebar for a top bar and a
  bottom tab bar. Respect `env(safe-area-inset-*)`.
- Copy is plain and specific, written for Kayla and her customers. No marketing filler, no emoji.

## Checking your work

Render the page and look at it. With a headless browser you can stub the dashboard's
sign-in by intercepting `/dashboard/auth.js` with a fake `window.AscAuth`, and
`/api/leads` with sample rows. Include a hostile name like `<img src=x onerror=alert(1)>`
in the sample data: it must show up as plain text.
