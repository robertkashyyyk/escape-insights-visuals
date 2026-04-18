import {
  ShoppingBasket, ShoppingCart, Fuel, Zap, UtensilsCrossed, Beer, Sandwich, Coffee,
  Flag, Footprints, Trees, Landmark, Waves, Activity, Pill, Hospital,
  Banknote, Camera, BedDouble, MapPin, type LucideIcon,
} from "lucide-react";

export type AmenityCategory =
  | "grocery" | "supermarket" | "petrol_station" | "ev_charging"
  | "restaurant" | "bar_pub" | "fast_food" | "cafe"
  | "golf_course" | "walkway_trail" | "park" | "castle_historic"
  | "beach" | "activity_centre" | "pharmacy" | "hospital_medical"
  | "atm_bank" | "tourist_attraction" | "accommodation" | "other";

export type AmenityColorGroup = "amber" | "green" | "blue" | "purple" | "grey";

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  group: AmenityColorGroup;
}

export const AMENITY_CATEGORIES: Record<AmenityCategory, CategoryMeta> = {
  // Amber — Food & Drink
  restaurant:        { label: "Restaurant",          icon: UtensilsCrossed, group: "amber" },
  bar_pub:           { label: "Bar / Pub",           icon: Beer,            group: "amber" },
  fast_food:         { label: "Fast Food",           icon: Sandwich,        group: "amber" },
  cafe:              { label: "Café",                icon: Coffee,          group: "amber" },
  // Green — Nature
  walkway_trail:     { label: "Walkway / Trail",     icon: Footprints,      group: "green" },
  park:              { label: "Park",                icon: Trees,           group: "green" },
  beach:             { label: "Beach",               icon: Waves,           group: "green" },
  golf_course:       { label: "Golf Course",         icon: Flag,            group: "green" },
  // Blue — Services
  grocery:           { label: "Grocery Store",       icon: ShoppingBasket,  group: "blue" },
  supermarket:       { label: "Supermarket",         icon: ShoppingCart,    group: "blue" },
  petrol_station:    { label: "Petrol Station",      icon: Fuel,            group: "blue" },
  ev_charging:       { label: "EV Charging Point",   icon: Zap,             group: "blue" },
  pharmacy:          { label: "Pharmacy",            icon: Pill,            group: "blue" },
  atm_bank:          { label: "ATM / Bank",          icon: Banknote,        group: "blue" },
  // Purple — Historic / Culture
  castle_historic:   { label: "Castle / Historic",   icon: Landmark,        group: "purple" },
  tourist_attraction:{ label: "Tourist Attraction",  icon: Camera,          group: "purple" },
  // Grey — Other
  accommodation:     { label: "Accommodation",       icon: BedDouble,       group: "grey" },
  hospital_medical:  { label: "Hospital / Medical",  icon: Hospital,        group: "grey" },
  activity_centre:   { label: "Activity Centre",     icon: Activity,        group: "grey" },
  other:             { label: "Other",               icon: MapPin,          group: "grey" },
};

export const ALL_CATEGORIES = Object.keys(AMENITY_CATEGORIES) as AmenityCategory[];

export function getCategoryMeta(c: AmenityCategory | string): CategoryMeta {
  return AMENITY_CATEGORIES[c as AmenityCategory] ?? AMENITY_CATEGORIES.other;
}

// Tailwind classes per colour group (HSL design tokens with subtle backgrounds)
export const GROUP_CLASSES: Record<AmenityColorGroup, string> = {
  amber:  "bg-amber-500/10 text-amber-400 border-amber-500/30",
  green:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  blue:   "bg-sky-500/10 text-sky-400 border-sky-500/30",
  purple: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  grey:   "bg-muted text-muted-foreground border-border/50",
};

/**
 * Build a Google Maps directions URL from amenity coordinates.
 * Falls back to a search URL when lat/lng are missing.
 */
export function buildDirectionsUrl(opts: {
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  postcode?: string | null;
}): string {
  const { latitude, longitude, name, postcode } = opts;
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }
  const q = encodeURIComponent([name, postcode].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function formatDistance(distance_km?: number | null, drive_time_mins?: number | null): string {
  const parts: string[] = [];
  if (distance_km != null) parts.push(`${distance_km.toFixed(1)} km`);
  if (drive_time_mins != null) parts.push(`${drive_time_mins} min drive`);
  return parts.join(" · ") || "—";
}
