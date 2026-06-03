import { Baby, Bath, Bed, Package, type LucideIcon } from "lucide-react";

// Curated map for the seeded lucide names. Admin-added requests can use an emoji
// instead (rendered directly), so we don't need to import all of lucide.
const ICON_MAP: Record<string, LucideIcon> = {
  baby: Baby,
  crib: Bed,
  cot: Bed,
  bed: Bed,
  bath: Bath,
  towels: Bath,
};

/** Renders a request's icon: a known lucide name, an emoji, or a package fallback. */
export function RequestIcon({ icon, className = "h-4 w-4" }: { icon?: string | null; className?: string }) {
  if (!icon) return <Package className={className} />;
  const key = icon.trim().toLowerCase();
  const Mapped = ICON_MAP[key];
  if (Mapped) return <Mapped className={className} />;
  // Non-alpha string → treat as emoji / literal text.
  if (!/^[a-z-]+$/.test(key)) return <span className={className} aria-hidden>{icon}</span>;
  return <Package className={className} />;
}
