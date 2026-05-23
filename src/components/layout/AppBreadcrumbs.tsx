import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  today: "Today",
  dashboard: "Dashboard",
  orin: "Orin Intelligence",
  yoy: "YoY Performance",
  heatmap: "Occupancy Heatmap",
  pricing: "Pricing Strategy",
  reservations: "Reservations",
  pipeline: "Future Pipeline",
  pacing: "Revenue Pacing",
  forecast: "Revenue Forecaster",
  properties: "Properties",
  owners: "Owners",
  management: "Management Revenue",
  settings: "Settings",
  team: "Team",
  "sync-health": "Sync Health",
  operations: "Operations",
  schedule: "Cleaning Schedule",
  cleaning: "Cleaning Schedule",
  numbers: "Cleaning Numbers",
  "property-knowledge": "Property Knowledge",
  amenities: "Amenities",
  "owner-reports": "Owner Reports",
  invoice: "Invoice Generator",
  "xero-sync": "Xero Sync",
  guests: "Guests",
  campaigns: "Campaigns",
  segments: "Segments",
  history: "History",
  "mailchimp-sync": "Mailchimp Sync",
  leads: "Leads",
  owner: "Owner Portal",
  cleaner: "Cleaner Portal",
};

const HOMES: Record<string, { href: string; label: string }> = {
  owner: { href: "/owner", label: "Owner Portal" },
  cleaner: { href: "/cleaner", label: "Cleaner Portal" },
};

function labelFor(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  // Treat ids/slugs as their raw form (truncated)
  if (seg.length > 12 && /[0-9a-f-]{20,}/.test(seg)) return seg.slice(0, 6) + "…";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const root = segments[0];
  const home = HOMES[root] ?? { href: "/today", label: "Home" };

  // Build cumulative crumbs
  const crumbs: { href: string; label: string }[] = [];
  let acc = "";
  for (const seg of segments) {
    acc += "/" + seg;
    crumbs.push({ href: acc, label: labelFor(seg) });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
      <Link to={home.href} className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{home.label}</span>
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
            {last ? (
              <span className="text-foreground font-medium truncate">{c.label}</span>
            ) : (
              <Link to={c.href} className="hover:text-foreground transition-colors truncate">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
