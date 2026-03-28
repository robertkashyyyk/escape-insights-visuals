

# Plan: Escape Grids Premium Landing Page

## Overview

A single-page marketing site at `/` (public), with the existing dashboard moved behind `/dashboard`. The landing page uses the existing dark theme with glassmorphism, adds Framer Motion for scroll animations, and includes all five requested sections.

## Routing Change

- `/` → New landing page (public, no auth required)
- `/dashboard` → Current dashboard (protected)
- `/auth` → Login page (unchanged)
- "Sign In" button on landing page links to `/auth`
- "Start for Free" / CTA buttons are placeholder (no action) except "Sign In"

## New Dependencies

- `framer-motion` — scroll-triggered animations, parallax effects

## Page Structure (Single File: `src/pages/Landing.tsx`)

Split into component files under `src/components/landing/`:

### 1. `HeroSection.tsx`
- Full-viewport hero with radial gradient background
- Headline: "Escape the spreadsheet. Master your property data."
- Subheadline text as specified
- Two CTA buttons: "Start for Free" (scrolls to pricing), "See How It Works" (scrolls to features)
- Floating glassmorphic KPI cards (Revenue £142K, Occupancy 87%, ADR £189) with subtle glow and parallax float animation
- "Sign In" link in top-right nav bar

### 2. `Navbar.tsx`
- Sticky top nav with "Escape Grids" logo text, nav links (Features, Pricing, About), and "Sign In" button linking to `/auth`
- Glass background on scroll

### 3. `FeaturesSection.tsx`
- "Stop manually updating cells." headline
- Three alternating left/right feature blocks with icons and descriptions
- Seamless Ingestion, Anti-Grid Dashboard, Owner Portfolios
- Framer Motion stagger animations on scroll

### 4. `StorySection.tsx`
- "Built by Escape Ordinary" origin story
- Elegant quote-style layout with accent border
- Fade-in on scroll

### 5. `PricingSection.tsx`
- Four pricing cards: Starter (Free), Premium ($49), Professional ($99), Enterprise (Custom)
- Premium card highlighted with amber glow border and "Most Popular" badge
- Hover lift effects, glassmorphic card style
- All buttons are placeholders (no navigation)

### 6. `CtaFooterSection.tsx`
- "Ready to escape the ordinary?" headline
- Email input + "Join Waitlist" button (client-side only, no backend)
- Footer links: Privacy, Terms, Contact (placeholder `#` hrefs)
- Copyright: © 2026 Escape Ordinary

## Design Details
- Reuses existing CSS variables (amber primary, teal accent, deep navy background)
- `glass-card` utility class for all cards
- Outfit font for headings, Inter for body (already loaded)
- Smooth scroll behavior via `scroll-behavior: smooth` on html
- All sections get `id` attributes for anchor navigation
- Responsive: stacked layout on mobile, side-by-side on desktop for features

## File Changes Summary
| File | Change |
|------|--------|
| `package.json` | Add `framer-motion` |
| `src/App.tsx` | Add `/` → Landing, move dashboard to `/dashboard` |
| `src/pages/Landing.tsx` | New — assembles all sections |
| `src/components/landing/Navbar.tsx` | New |
| `src/components/landing/HeroSection.tsx` | New |
| `src/components/landing/FeaturesSection.tsx` | New |
| `src/components/landing/StorySection.tsx` | New |
| `src/components/landing/PricingSection.tsx` | New |
| `src/components/landing/CtaFooterSection.tsx` | New |
| `src/pages/Index.tsx` | Update route or keep as dashboard wrapper |

