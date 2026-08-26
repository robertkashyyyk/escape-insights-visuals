/**
 * Single source of truth for how a property is labelled in the UI.
 *
 * Hostaway carries two names: the branded guest-facing one (listings.name, e.g.
 * "Mabel's Maison by Escape Ordinary") and the operational internalListingName
 * (listings.internal_name, e.g. "Castle Hume No. 9"). Staff and owners work by
 * the operational name, so that's the PRIMARY label everywhere; the branded name
 * stays available as the "dig deeper" detail (subtitle / tooltip).
 */
export interface NamedListing {
  name?: string | null;
  internal_name?: string | null;
}

/** Primary display label — operational name, falling back to the branded name. */
export function displayName(l: NamedListing | null | undefined): string {
  if (!l) return "";
  const internal = l.internal_name?.trim();
  return internal || l.name || "";
}

/** The branded/guest-facing name, shown as secondary detail. Empty if it's the
 *  same as the primary label (nothing extra to reveal). */
export function brandedName(l: NamedListing | null | undefined): string {
  if (!l) return "";
  const branded = (l.name ?? "").trim();
  return branded && branded !== displayName(l) ? branded : "";
}
