// Stable colour palette for cleaners. Uses HSL so it works with both light/dark themes.
// Auto-assigns from the palette based on cleaner ID hash, with explicit overrides for known cleaners.

export interface CleanerColor {
  bg: string;          // tailwind-style HSL backgrounds (rgba inline for cells)
  border: string;
  text: string;
  hex: string;         // for the cleaner strip dot + drag preview
  initialBg: string;   // avatar circle bg
}

// NOTE: Green hues are reserved for "completed" (clean) status — never assign green/teal to a cleaner.
// NOTE: Red hues are reserved for "dirty" / same-day turnaround alerts — never assign red/rose to a cleaner.
const PALETTE: CleanerColor[] = [
  { hex: "#3b82f6", bg: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.45)",  text: "#93c5fd", initialBg: "#3b82f6" },  // blue
  { hex: "#8b5cf6", bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.45)",  text: "#c4b5fd", initialBg: "#8b5cf6" },  // purple
  { hex: "#ec4899", bg: "rgba(236,72,153,0.18)",  border: "rgba(236,72,153,0.45)",  text: "#f9a8d4", initialBg: "#ec4899" },  // pink
  { hex: "#6366f1", bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.45)",  text: "#a5b4fc", initialBg: "#6366f1" },  // indigo
  { hex: "#f97316", bg: "rgba(249,115,22,0.18)",  border: "rgba(249,115,22,0.45)",  text: "#fdba74", initialBg: "#f97316" },  // orange
  { hex: "#a855f7", bg: "rgba(168,85,247,0.18)",  border: "rgba(168,85,247,0.45)",  text: "#d8b4fe", initialBg: "#a855f7" },  // violet
  { hex: "#f59e0b", bg: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.45)",  text: "#fcd34d", initialBg: "#f59e0b" },  // amber
  { hex: "#64748b", bg: "rgba(100,116,139,0.20)", border: "rgba(100,116,139,0.50)", text: "#cbd5e1", initialBg: "#64748b" },  // slate
];

// Explicit overrides by lower-cased name (first names from spec)
const NAME_OVERRIDES: Record<string, number> = {
  kirstie: 1,  // purple (was teal — teal reads as green)
  andreas: 0,  // blue
};

export const UNASSIGNED_COLOR: CleanerColor = {
  hex: "#f59e0b",
  bg: "rgba(245,158,11,0.18)",
  border: "rgba(245,158,11,0.55)",
  text: "#fcd34d",
  initialBg: "#f59e0b",
};

export const COMPLETED_COLOR: CleanerColor = {
  hex: "#22c55e",
  bg: "rgba(34,197,94,0.16)",
  border: "rgba(34,197,94,0.35)",
  text: "#86efac",
  initialBg: "#22c55e",
};

export const OWNER_BLOCK_COLOR: CleanerColor = {
  hex: "#374151",
  bg: "rgba(55,65,81,0.55)",
  border: "rgba(75,85,99,0.6)",
  text: "#d1d5db",
  initialBg: "#374151",
};

export const MANUAL_CLEAN_COLOR: CleanerColor = {
  hex: "#8b5cf6",
  bg: "rgba(139,92,246,0.18)",
  border: "rgba(139,92,246,0.45)",
  text: "#c4b5fd",
  initialBg: "#8b5cf6",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Convert a hex like "#0d9488" into a full CleanerColor with translucent bg/border + lighter text.
function colorFromHex(hex: string): CleanerColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Lighter tint for text — mix toward white
  const lighten = (c: number) => Math.round(c + (255 - c) * 0.55);
  const textHex = `#${[lighten(r), lighten(g), lighten(b)].map(c => c.toString(16).padStart(2, "0")).join("")}`;
  return {
    hex,
    bg: `rgba(${r},${g},${b},0.18)`,
    border: `rgba(${r},${g},${b},0.45)`,
    text: textHex,
    initialBg: hex,
  };
}

export function getCleanerColor(
  cleanerId: string | null | undefined,
  name?: string | null,
  customHex?: string | null,
): CleanerColor {
  if (!cleanerId) return UNASSIGNED_COLOR;
  // Custom colour set on the cleaner record wins
  if (customHex && /^#[0-9a-fA-F]{6}$/.test(customHex)) return colorFromHex(customHex);
  if (name) {
    const first = name.trim().split(/\s+/)[0]?.toLowerCase();
    if (first && NAME_OVERRIDES[first] != null) return PALETTE[NAME_OVERRIDES[first]];
  }
  return PALETTE[hashString(cleanerId) % PALETTE.length];
}

// Curated palette of hex values for the cleaner colour picker.
// NOTE: Green/teal hues reserved for "completed" (clean). Red/rose hues reserved for "dirty"/STO alerts.
export const CLEANER_COLOR_SWATCHES = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1",
  "#f97316", "#a855f7", "#f59e0b", "#64748b",
  "#d946ef", "#eab308", "#0ea5e9", "#fb923c",
];
