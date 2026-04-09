

# Plan: Restructure Sidebar Navigation

## Overview

Reorganise the flat sidebar menu into labelled, grouped sections with collapsible sub-menus. Add placeholder pages for new items that don't exist yet. Rename "Orin Intelligence" to "The Orin Brief" (same page, same route). Add a new "Today" item as the top-level home screen.

## Clarification: Orin Intelligence

The current `/orin` page already has the Monthly Brief / Quarterly Deep Dive toggle — it IS "The Orin Brief." We'll rename it in the sidebar and add sub-menu items that scroll/toggle to each view. The floating chat (already built) stays as-is.

## Existing pages (keep routes)

| Menu item | Route | Exists |
|-----------|-------|--------|
| Today | `/dashboard` | Yes (rename from "Dashboard", repurpose as command centre later) |
| The Orin Brief | `/orin` | Yes (rename from "Orin Intelligence") |
| Dashboard | `/dashboard` | Yes |
| YoY Performance | `/yoy` | Yes |
| Occupancy Heatmap | `/heatmap` | Yes |
| Pricing Strategy | `/pricing` | Yes |
| Revenue Pacing | `/pacing` | Yes |
| Revenue Forecaster | `/forecast` | Yes |
| Reservations | `/reservations` | Yes |
| Future Pipeline | `/pipeline` | Yes |
| Upload Data | `/upload` | Yes |
| Management Revenue | `/management` | Yes |
| Properties | `/properties` | Yes |
| Owner Portfolios | `/owners` | Yes |
| Settings | `/settings` | Yes |

## New placeholder pages (stub "Coming Soon")

| Menu item | Route |
|-----------|-------|
| Housekeeping (sub-items) | `/housekeeping`, `/housekeeping/week`, `/housekeeping/allocation`, `/housekeeping/invoices` |
| Property Knowledge | `/property-knowledge` |
| Owner Reports (sub-items) | `/owner-reports`, `/owner-reports/invoice` |
| Xero Sync | `/xero-sync` |
| Guest Database | `/guests` |
| Campaigns (sub-items) | `/campaigns`, `/campaigns/segments`, `/campaigns/history` |
| Mailchimp Sync | `/mailchimp-sync` |
| Leads & Enquiries | `/leads` |

## 1. Sidebar Restructure — `src/components/layout/AppSidebar.tsx`

Replace the flat `allNavItems` array with a grouped structure:

```text
type NavSection = {
  label: string;               // Section divider text ("INTELLIGENCE", "PERFORMANCE", etc.)
  items: NavItem[];
}
type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
  children?: { title: string; url: string }[];  // Sub-menu items
}
```

Sections rendered as small uppercase dividers (`text-[10px] uppercase tracking-wider text-muted-foreground`). Items with `children` get a collapsible chevron — clicking the parent toggles sub-items. Sub-items are indented and shown beneath the parent when expanded.

"Today" sits above all sections, visually distinct (slightly larger, always highlighted as home).

When collapsed (icon mode), only top-level icons show — no section labels or sub-items.

## 2. Stub "Coming Soon" Page — `src/pages/ComingSoon.tsx`

A simple shared page component that accepts a `title` prop and displays a centered "Coming Soon" message with the page title. All new placeholder routes will use this.

## 3. Routes — `src/App.tsx`

Add all new routes pointing to `ComingSoon`. Keep all existing routes unchanged. New routes use `ProtectedRoute` with appropriate roles:
- Housekeeping, Property Knowledge, Guest Database, Campaigns, Mailchimp Sync, Leads: all roles
- Owner Reports, Xero Sync: super + senior

## 4. File Summary

| File | Action |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Full rewrite — grouped sections with collapsible sub-menus |
| `src/pages/ComingSoon.tsx` | New — shared placeholder page |
| `src/App.tsx` | Add ~12 new routes for placeholder pages |

