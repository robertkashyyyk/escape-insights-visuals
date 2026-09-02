// Central permissions model.
//
// Access has always been role-gated (super/senior/admin/client/cleaner/maintenance)
// at the route + sidebar level. This adds a per-user, per-area permission layer on
// top, with four levels. Phase 1 enforces only NONE (area hidden + route-blocked);
// view/edit/manage all grant access for now and are tightened area-by-area later.
//
// Effective level = per-user override if set, else the role default (derived from
// each area's allowed roles), so behaviour is unchanged until an override exists.

export type AppRole = "super" | "senior" | "admin" | "client" | "cleaner" | "maintenance";
export type PermLevel = "none" | "view" | "edit" | "manage";

export const LEVELS: PermLevel[] = ["none", "view", "edit", "manage"];
export const rankOf = (l: PermLevel): number => LEVELS.indexOf(l);
/** Does `have` meet the `min` level? */
export const meets = (have: PermLevel, min: PermLevel): boolean => rankOf(have) >= rankOf(min);

export interface AreaDef {
  key: string;
  label: string;
  section: string;
  route: string;                 // primary route prefix used for gating
  roles: AppRole[];              // which roles see it today (drives role defaults)
}

// Roles used by the existing sidebar groupings.
const ALL: AppRole[] = ["super", "senior", "admin"];
const MGMT: AppRole[] = ["super", "senior"];

// One entry per navigable area. `route` is matched as a prefix for deep-link gating.
export const AREAS: AreaDef[] = [
  { key: "orin", label: "The Orin Brief", section: "Intelligence", route: "/orin", roles: ALL },

  { key: "dashboard", label: "Dashboard", section: "Performance", route: "/dashboard", roles: ALL },
  { key: "on-the-daily", label: "On The Daily", section: "Performance", route: "/on-the-daily", roles: ALL },
  { key: "yoy", label: "YoY Performance", section: "Performance", route: "/yoy", roles: ALL },
  { key: "heatmap", label: "Occupancy Heatmap", section: "Performance", route: "/heatmap", roles: ALL },
  { key: "pricing", label: "Pricing Strategy", section: "Performance", route: "/pricing", roles: ALL },
  { key: "pacing", label: "Revenue Pacing", section: "Performance", route: "/pacing", roles: ALL },
  { key: "forecast", label: "Revenue Forecaster", section: "Performance", route: "/forecast", roles: ALL },

  { key: "reservations", label: "Reservations", section: "Bookings", route: "/reservations", roles: ALL },
  { key: "pipeline", label: "Future Pipeline", section: "Bookings", route: "/pipeline", roles: ALL },

  { key: "schedule", label: "Cleaning Schedule", section: "Operations", route: "/operations/schedule", roles: ALL },
  { key: "traffic", label: "Cleaning Traffic", section: "Operations", route: "/operations/traffic", roles: ALL },
  { key: "maintenance", label: "Maintenance", section: "Operations", route: "/operations/maintenance", roles: ALL },
  { key: "numbers", label: "Cleaning Numbers", section: "Operations", route: "/operations/numbers", roles: MGMT },
  { key: "audit", label: "Cleaning Audit", section: "Operations", route: "/operations/audit", roles: ALL },
  { key: "imports", label: "OTA Imports", section: "Operations", route: "/operations/imports", roles: MGMT },
  { key: "property-knowledge", label: "Property Knowledge", section: "Operations", route: "/property-knowledge", roles: ALL },
  { key: "amenities", label: "Amenities", section: "Operations", route: "/amenities", roles: MGMT },

  { key: "management", label: "Management Revenue", section: "Finance", route: "/management", roles: MGMT },
  { key: "expenses", label: "Expenses", section: "Finance", route: "/finance/expenses", roles: MGMT },
  { key: "bills", label: "Bills on Behalf", section: "Finance", route: "/finance/bills-on-behalf", roles: MGMT },
  { key: "owner-reports", label: "Owner Reports", section: "Finance", route: "/owner-reports", roles: MGMT },
  { key: "xero", label: "Xero Sync", section: "Finance", route: "/xero-sync", roles: MGMT },

  { key: "guests", label: "Guest Database", section: "Guests & Marketing", route: "/guests", roles: ALL },
  { key: "campaigns", label: "Campaigns", section: "Guests & Marketing", route: "/campaigns", roles: ALL },
  { key: "mailchimp", label: "Mailchimp Sync", section: "Guests & Marketing", route: "/mailchimp-sync", roles: ALL },

  { key: "properties", label: "Properties", section: "Portfolio", route: "/properties", roles: ALL },
  { key: "owners", label: "Owner Portfolios", section: "Portfolio", route: "/owners", roles: MGMT },
  { key: "owner-portal", label: "Owner Portal", section: "Portfolio", route: "/owner", roles: MGMT },
  { key: "leads", label: "Leads & Enquiries", section: "Portfolio", route: "/leads", roles: ALL },

  { key: "settings", label: "Settings", section: "Admin", route: "/settings", roles: ["super"] },
  { key: "users", label: "User Management", section: "Admin", route: "/settings/team", roles: ["super"] },
];

// Explicit defaults for the maintenance role (it isn't in any area's `roles` list,
// so without this it would default to NONE everywhere).
const MAINTENANCE_DEFAULTS: Record<string, PermLevel> = {
  maintenance: "manage",
  "on-the-daily": "view",
  schedule: "view",
  properties: "view",
  "property-knowledge": "view",
};

/** Role default for an area, before any per-user override. */
export function defaultLevel(role: AppRole | null, areaKey: string): PermLevel {
  if (!role) return "none";
  if (role === "super") return "manage";
  if (role === "maintenance") return MAINTENANCE_DEFAULTS[areaKey] ?? "none";
  const area = AREAS.find((a) => a.key === areaKey);
  if (!area || !area.roles.includes(role)) return "none";
  return role === "senior" ? "manage" : "edit"; // admin → edit
}

/** Which area (if any) a pathname belongs to — for deep-link gating. Longest match wins. */
export function areaForPath(pathname: string): AreaDef | null {
  let best: AreaDef | null = null;
  for (const a of AREAS) {
    if (pathname === a.route || pathname.startsWith(a.route + "/")) {
      if (!best || a.route.length > best.route.length) best = a;
    }
  }
  return best;
}
