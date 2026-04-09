

## Remove Orin Brief Sidebar Sub-Menus

### What changes
The sidebar currently has sub-menu items under "Orin Brief" (e.g. Monthly Brief, Quarterly Deep Dive). These duplicate the on-page toggle tabs that already exist on `/orin`. We'll remove the sub-menu items and keep "Orin Brief" as a single, flat sidebar link — same as Dashboard, Properties, etc.

### Files to edit

**`src/components/layout/AppSidebar.tsx`** — Find the Orin Brief menu entry and remove any `children` / sub-items array. Keep it as a simple link to `/orin`. The on-page toggle on `OrinIntelligence.tsx` already handles Monthly vs Quarterly switching, so no other changes needed.

### Scope
- One file edit, minimal change
- No routing changes — `/orin` stays as-is
- The on-page Monthly/Quarterly toggle remains untouched

