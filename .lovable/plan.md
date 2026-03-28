

# Fix: Dashboard Nav Link

## Problem
The sidebar "Dashboard" link points to `/` (the landing page) instead of `/dashboard`.

## Change
**`src/components/layout/AppSidebar.tsx` line 20** — change `url: "/"` to `url: "/dashboard"`.

That's it. One-line fix.

