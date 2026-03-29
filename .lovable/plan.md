

# Plan: Orin AI Intelligence Agent

## Overview

Two features: (1) a new "Orin Intelligence" sidebar page with executive newsletter-style briefs, and (2) a floating Orin chat assistant available on all authenticated pages.

## 1. Orin Intelligence Page

### `src/pages/OrinIntelligence.tsx`

- Wrapped in `AppLayout`
- Toggle at top: "Monthly Brief" / "Quarterly Deep Dive" using a custom segmented control with amber accent styling
- Single-column article layout (max-w-3xl, centered), styled like a premium newsletter
- Space Grotesk headers, Inter body text
- Subtle amber glow accents: left border on the article, amber badge "AI-Generated Brief", soft amber gradient on section dividers
- Realistic placeholder content for both views:
  - **Monthly**: "April 2026 Performance Brief" — covers revenue trends, occupancy, booking velocity, pricing observations, actionable recommendations
  - **Quarterly**: "Q1 2026 Deep Dive" — broader strategic analysis, YoY comparisons, market positioning, seasonal outlook
- Tone: analytical, crisp, executive-level
- Sections within the brief: Executive Summary, Revenue Analysis, Occupancy & Demand, Pricing Intelligence, Risk Flags, Recommended Actions

### Route & Nav

- `src/App.tsx`: Add `/orin` route with `ProtectedRoute` (all roles), after `/dashboard`
- `src/components/layout/AppSidebar.tsx`: Add "Orin Intelligence" nav item after Dashboard with `Sparkles` icon (lucide-react), amber-tinted when active

## 2. Orin Floating Chat Assistant

### `src/components/orin/OrinChatFAB.tsx`

- Fixed-position FAB in bottom-right corner (bottom-6 right-6)
- Amber glowing `Sparkles` icon with subtle pulse animation
- `z-50` to float above all content
- onClick toggles the chat panel open/closed

### `src/components/orin/OrinChatPanel.tsx`

- Slide-out panel from the right side (fixed, h-[500px], w-[380px])
- Glassmorphic styling: `backdrop-blur-xl bg-card/80 border border-border/30`
- Header: "Ask Orin" with Sparkles icon and close button
- Chat message area with custom styled bubbles:
  - User messages: right-aligned, amber/primary background
  - Orin messages: left-aligned, glass card style with subtle amber left border
  - No rounded iMessage look — use sharp-cornered cards with subtle borders for premium SaaS feel
- Input area at bottom with send button
- Suggested prompt chips above the input (shown when no messages yet):
  - "Why is revenue down this month?"
  - "Forecast my July occupancy"
  - "Which properties need pricing adjustments?"
  - "Summarize my Q1 performance"
- Static placeholder responses for now (no AI backend wired yet) — Orin responds with a realistic analytical message

### Integration in `src/components/layout/AppLayout.tsx`

- Add `OrinChatFAB` inside the layout so it appears on all authenticated pages

## Technical Details

- Primary amber color already exists as `--primary: 38 92% 50%` — will use this for Orin accents
- Add a custom `glow-amber` animation to tailwind config for the FAB pulse effect
- Chat state managed with local useState (messages array, open/closed)
- No AI backend integration in this phase — placeholder responses only

## File Summary

| File | Action |
|------|--------|
| `src/pages/OrinIntelligence.tsx` | New — executive newsletter page |
| `src/components/orin/OrinChatFAB.tsx` | New — floating action button |
| `src/components/orin/OrinChatPanel.tsx` | New — slide-out chat panel |
| `src/components/layout/AppLayout.tsx` | Add OrinChatFAB |
| `src/App.tsx` | Add `/orin` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |
| `tailwind.config.ts` | Add glow-amber keyframe |

