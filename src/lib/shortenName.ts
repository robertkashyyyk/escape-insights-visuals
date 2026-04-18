/**
 * Shorten long Hostaway listing titles for display in tight UI columns.
 * Strategy: take the first segment before · or |, then truncate to maxLen chars.
 */
export function shortenName(name: string | null | undefined, maxLen = 30): string {
  if (!name) return "";
  const firstSegment = name.split(/[·|]/)[0].trim();
  const base = firstSegment || name;
  return base.length > maxLen ? base.slice(0, maxLen - 1).trimEnd() + "…" : base;
}
