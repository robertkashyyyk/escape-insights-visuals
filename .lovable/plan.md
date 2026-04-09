

## Fix Quarterly Deep Dive Date

The placeholder text says the Q1 report will be available on "1 April 2026", but today is 9 April 2026 — so it should already be "available." We need to update this to reference the next upcoming quarter instead.

### Change

**`src/pages/OrinIntelligence.tsx`** — In the `QuarterlyPlaceholder` component, update the copy to reference **Q2 2026** as the next upcoming report, with availability on **1 July 2026**. The current Q1 report should either show as "available" or the placeholder should simply point forward to the next quarter.

Proposed updated copy:
- Heading: **"Q2 2026 Quarterly Deep Dive"**
- Body: "Your Q2 2026 Quarterly Deep Dive will be available on **1 July 2026**..."
- Footer: "Next report: 1 October 2026"

This keeps the locked/coming-soon state but with correct future dates.

