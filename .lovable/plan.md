

# Plan: Branding and Typography Update

## Overview

Five targeted changes: swap heading font to Space Grotesk, replace sidebar logo with the uploaded images, handle collapsed state with icon-only version, update favicon, and add full logo to the Auth page.

## 1. Typography — Space Grotesk

**Files**: `src/index.css`, `tailwind.config.ts`

- Update the Google Fonts import in `index.css`: replace `Outfit` with `Space+Grotesk` (weights 400–700)
- In `tailwind.config.ts`, change `fontFamily.display` from `["Outfit", ...]` to `["Space Grotesk", ...]`
- In `index.css` base layer, update the `h1–h6` rule from `font-family: 'Outfit'` to `font-family: 'Space Grotesk'`
- Body text stays `Inter` — no change needed there

## 2. Copy Logo Assets to Public

Copy uploaded files into the project:
- `user-uploads://eg_logo_full.png` → `public/images/eg_logo_full.png` (sidebar expanded + auth page)
- `user-uploads://eg_icon_64.png` → `public/images/eg_icon_64.png` (sidebar collapsed)
- `user-uploads://eg_icon_32.png` → `public/favicon.png` (favicon)

## 3. Sidebar Logo Update

**File**: `src/components/layout/AppSidebar.tsx`

- **Expanded state** (lines 52–60): Replace the text-based "E" icon + "Escape Grids / Analytics" block with an `<img>` tag referencing `/images/eg_logo_full.png`, height ~36px, with `object-contain`
- **Collapsed state** (lines 61–65): Replace the "E" rounded square with an `<img>` tag referencing `/images/eg_icon_64.png`, height ~32px

## 4. Favicon

**File**: `index.html`

- Add `<link rel="icon" href="/favicon.png" type="image/png">` in the `<head>`
- Remove any existing favicon reference if present

## 5. Auth Page Logo

**File**: `src/pages/Auth.tsx`

- Replace the current logo block (lines 95–105) — the "E" icon + "Escape Grids" text — with a single centered `<img src="/images/eg_logo_full.png">` at ~48px height, with appropriate margin below

## File Summary

| File | Action |
|------|--------|
| `src/index.css` | Swap Outfit → Space Grotesk in Google Fonts import |
| `tailwind.config.ts` | Update `fontFamily.display` |
| `public/images/eg_logo_full.png` | Copy from uploads |
| `public/images/eg_icon_64.png` | Copy from uploads |
| `public/favicon.png` | Copy from uploads |
| `src/components/layout/AppSidebar.tsx` | Replace logo header (expanded + collapsed) |
| `src/pages/Auth.tsx` | Replace logo with full image |
| `index.html` | Add favicon link |

