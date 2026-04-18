import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PropertyYoY {
  listingId: string;
  name: string;
  city: string | null;
  currentRevenue: number;
  previousRevenue: number;
  currentAdr: number;
  previousAdr: number;
  currentOccupancy: number;
  previousOccupancy: number;
  revenueChange: number | null;
  adrChange: number | null;
  occupancyChange: number | null;
  isNew: boolean;
}

interface Props {
  data: PropertyYoY[];
  currentYear: number;
  previousYear: number;
  filenamePrefix: string; // e.g. "yoy-2025-vs-2026"
}

type SortKey =
  | "name" | "city"
  | "currentRevenue" | "previousRevenue" | "revenueChange"
  | "currentOccupancy" | "previousOccupancy" | "occupancyChange"
  | "currentAdr" | "previousAdr" | "adrChange";

type SortDir = "asc" | "desc";

const fmtMoney = (n: number) =>
  `£${Math.round(n).toLocaleString("en-GB")}`;
const fmtPct = (n: number) => `${n.toFixed(0)}%`;

function changeClass(v: number | null) {
  if (v === null) return "text-muted-foreground";
  if (Math.abs(v) <= 2) return "text-amber-500";
  if (v > 0) return "text-emerald-500";
  return "text-red-500";
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cn("text-xs font-semibold tabular-nums", changeClass(value))}>
      {sign}{value.toFixed(1)}%
    </span>
  );
}

function SortHeader({
  label, k, sortKey, sortDir, onSort, align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        align === "right" && "ml-auto"
      )}
    >
      <span>{label}</span>
      <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
    </button>
  );
}

function toCsv(rows: PropertyYoY[], currentYear: number, previousYear: number) {
  const header = [
    "Property", "Location",
    `${previousYear} Revenue`, `${currentYear} Revenue`, "Revenue Change %",
    `${previousYear} Occupancy %`, `${currentYear} Occupancy %`, "Occupancy Change %",
    `${previousYear} ADR`, `${currentYear} ADR`, "ADR Change %",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) => [
    r.name,
    r.city ?? "",
    Math.round(r.previousRevenue),
    Math.round(r.currentRevenue),
    r.revenueChange === null ? "" : r.revenueChange.toFixed(1),
    r.previousOccupancy.toFixed(1),
    r.currentOccupancy.toFixed(1),
    r.occupancyChange === null ? "" : r.occupancyChange.toFixed(1),
    Math.round(r.previousAdr),
    Math.round(r.currentAdr),
    r.adrChange === null ? "" : r.adrChange.toFixed(1),
  ].map(escape).join(","));
  return [header.map(escape).join(","), ...lines].join("\n");
}

export function YoYTable({ data, currentYear, previousYear, filenamePrefix }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenueChange");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" || k === "city" ? "asc" : "desc"); }
  };

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      const aN = av === null ? -Infinity : typeof av === "string" ? av.toLowerCase() : av;
      const bN = bv === null ? -Infinity : typeof bv === "string" ? bv.toLowerCase() : bv;
      if (aN < bN) return sortDir === "asc" ? -1 : 1;
      if (aN > bN) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totals = useMemo(() => {
    const sum = (k: keyof PropertyYoY) =>
      sorted.reduce((acc, r) => acc + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
    const n = sorted.length || 1;
    const curRev = sum("currentRevenue");
    const prevRev = sum("previousRevenue");
    const curOcc = sum("currentOccupancy") / n;
    const prevOcc = sum("previousOccupancy") / n;
    const curAdr = sum("currentAdr") / n;
    const prevAdr = sum("previousAdr") / n;
    const pct = (c: number, p: number) => (p === 0 ? null : ((c - p) / p) * 100);
    return {
      curRev, prevRev, revChange: pct(curRev, prevRev),
      curOcc, prevOcc, occChange: pct(curOcc, prevOcc),
      curAdr, prevAdr, adrChange: pct(curAdr, prevAdr),
    };
  }, [sorted]);

  const handleExport = () => {
    const csv = toCsv(sorted, currentYear, previousYear);
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenamePrefix}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <SortHeader label="Property" k="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-left">
                  <SortHeader label="Location" k="city" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${previousYear} Rev`} k="previousRevenue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${currentYear} Rev`} k="currentRevenue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label="Δ" k="revenueChange" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${previousYear} Occ`} k="previousOccupancy" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${currentYear} Occ`} k="currentOccupancy" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label="Δ" k="occupancyChange" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${previousYear} ADR`} k="previousAdr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label={`${currentYear} ADR`} k="currentAdr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <SortHeader label="Δ" k="adrChange" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground text-sm">
                    No reservation data for this period.
                  </td>
                </tr>
              ) : sorted.map((r, i) => {
                const decline = r.revenueChange !== null && r.revenueChange < 0;
                const strongUp = r.revenueChange !== null && r.revenueChange > 20;
                return (
                  <tr
                    key={r.listingId}
                    className={cn(
                      "border-b border-border/20 transition-colors hover:bg-secondary/30",
                      i % 2 === 1 && "bg-secondary/10",
                      decline && "border-l-2 border-l-red-500/40",
                      strongUp && "border-l-2 border-l-emerald-500/40",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground truncate max-w-[220px]" title={r.name}>
                        {r.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.city ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground font-normal">
                          {r.city}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtMoney(r.previousRevenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">{fmtMoney(r.currentRevenue)}</td>
                    <td className="px-3 py-2.5 text-right"><ChangeCell value={r.revenueChange} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtPct(r.previousOccupancy)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">{fmtPct(r.currentOccupancy)}</td>
                    <td className="px-3 py-2.5 text-right"><ChangeCell value={r.occupancyChange} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtMoney(r.previousAdr)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">{fmtMoney(r.currentAdr)}</td>
                    <td className="px-3 py-2.5 text-right"><ChangeCell value={r.adrChange} /></td>
                  </tr>
                );
              })}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-secondary/40 border-t-2 border-border/40">
                <tr>
                  <td className="px-3 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Portfolio Total</td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">{sorted.length} props</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-muted-foreground">{fmtMoney(totals.prevRev)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-foreground">{fmtMoney(totals.curRev)}</td>
                  <td className="px-3 py-3 text-right"><ChangeCell value={totals.revChange} /></td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-muted-foreground">{fmtPct(totals.prevOcc)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-foreground">{fmtPct(totals.curOcc)}</td>
                  <td className="px-3 py-3 text-right"><ChangeCell value={totals.occChange} /></td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-muted-foreground">{fmtMoney(totals.prevAdr)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-foreground">{fmtMoney(totals.curAdr)}</td>
                  <td className="px-3 py-3 text-right"><ChangeCell value={totals.adrChange} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
