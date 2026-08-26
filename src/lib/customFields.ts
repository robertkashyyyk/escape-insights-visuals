/**
 * Classify Hostaway reservation custom fields (reservations.custom_fields) into:
 *  - requests  — guest-requested extras (travel cot, high chair, …) with an
 *                affirmative/quantity value; the "Requests" the cleaner acts on.
 *  - access    — operational info (door code, parking, hot-tub/sauna instructions,
 *                guest-guide links, security deposit, check-in notes).
 *
 * Each raw field is `{ name, value }`. Empty values are already filtered by the
 * sync, but we guard again here.
 */

export interface RawCustomField { name?: string | null; value?: unknown; field_id?: number | null; }
export interface ParsedRequest { label: string; value: string; }
export interface AccessItem { name: string; value: string; url?: string; }

const AFFIRMATIVE = /^(yes|y|true|required|requested|✓)$/i;
const NEGATIVE = /^(no|n|false|none|n\/a|na|0)$/i;
// Names that denote a guest request rather than operational info.
const REQUEST_NAME = /\b(cot|high\s*chair|highchair|travel\s*cot|extra\s*bed|bed\s*guard|stair\s*gate|z-?bed|blackout|required\??|requested\??)\b/i;
// Access items a cleaner specifically needs on the job.
const CLEANER_ACCESS = /(door|lock|code|key\s*safe|keybox|parking|hot\s*tub|sauna|check-?in|access|gate)/i;

export const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

/** Tidy a request field name into a chip label, e.g. "Travel Cot required?" → "Travel Cot". */
function requestLabel(name: string): string {
  const cleaned = name.replace(/\s*(required|requested)\s*\??/i, "").replace(/\?+\s*$/, "").trim();
  const label = cleaned || name;
  return label.replace(/^\w/, (c) => c.toUpperCase());
}

export function parseCustomFields(cf: RawCustomField[] | null | undefined): { requests: ParsedRequest[]; access: AccessItem[] } {
  const requests: ParsedRequest[] = [];
  const access: AccessItem[] = [];
  for (const f of cf ?? []) {
    const name = (f?.name ?? "").toString().trim();
    const value = f?.value == null ? "" : String(f.value).trim();
    if (!name || !value) continue;

    const looksLikeRequest = REQUEST_NAME.test(name);
    const affirmative = AFFIRMATIVE.test(value) || /^\d+$/.test(value);
    if (looksLikeRequest && affirmative && !NEGATIVE.test(value)) {
      requests.push({ label: requestLabel(name), value });
      continue;
    }
    if (looksLikeRequest && NEGATIVE.test(value)) continue; // "Travel cot? → No" — nothing to show

    access.push({ name, value, url: isUrl(value) ? value : undefined });
  }
  return { requests, access };
}

/** The access items a cleaner needs on the job (door codes, parking, hot tub, check-in). */
export function cleanerAccess(access: AccessItem[]): AccessItem[] {
  return access.filter((a) => CLEANER_ACCESS.test(a.name));
}
