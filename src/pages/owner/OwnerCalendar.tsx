import { useEffect, useMemo, useRef, useState } from "react";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerCalendar, type CalBlock } from "@/hooks/useOwnerCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { CalendarRange, Ban, TrendingUp } from "lucide-react";

const CELL_W = 40;
const ROW_H = 44;
const LEFT_W = 184;

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

// Channel shading — one hue, varying weight (no rainbow).
function platformShade(platform: string | null): string {
  const p = (platform || "").toLowerCase();
  if (p.includes("direct")) return "bg-primary text-primary-foreground";
  if (p.includes("airbnb")) return "bg-primary/75 text-primary-foreground";
  if (p.includes("booking")) return "bg-primary/55 text-primary-foreground";
  return "bg-primary/40 text-foreground";
}
const LEGEND = [
  { label: "Direct", cls: "bg-primary" },
  { label: "Airbnb", cls: "bg-primary/75" },
  { label: "Booking.com", cls: "bg-primary/55" },
  { label: "Other", cls: "bg-primary/40" },
];

export default function OwnerCalendar() {
  const { data, isLoading } = useOwnerCalendar();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ block: CalBlock; property: string } | null>(null);
  const [gapSel, setGapSel] = useState<{ property: string; startDate: string; endDate: string; nights: number; potential: number } | null>(null);

  // Contiguous open (sellable, future) run around a clicked gap cell.
  const handleGapClick = (p: (typeof data.properties)[number], i: number) => {
    if (!data) return;
    const ok = (idx: number) => idx >= 0 && idx < data.days.length
      && !p.bookedDays.has(data.days[idx]) && !p.orphanGaps.has(data.days[idx]);
    let s = i, e = i;
    while (s - 1 >= data.todayIdx && ok(s - 1)) s--;
    while (e + 1 < data.days.length && ok(e + 1)) e++;
    const nights = e - s + 1;
    setGapSel({ property: p.name, startDate: data.days[s], endDate: data.days[e], nights, potential: Math.round(nights * p.adr) });
  };

  // Open scrolled to today.
  useEffect(() => {
    if (data && scrollRef.current && data.todayIdx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, data.todayIdx * CELL_W - CELL_W * 3);
    }
  }, [data]);

  const monthGroups = useMemo(() => {
    if (!data) return [];
    const groups: { label: string; count: number }[] = [];
    data.days.forEach((d) => {
      const label = format(parseISO(d), "MMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.count++;
      else groups.push({ label, count: 1 });
    });
    return groups;
  }, [data]);

  return (
    <OwnerLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <CalendarRange className="h-6 w-6 text-primary" /> My Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Bookings across your properties — gaps are open availability.</p>
          </div>
          {/* Summary strip */}
          {data && (
            <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 px-4 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open sellable nights</p>
                <p className="text-lg font-display font-bold text-foreground">{data.summary.sellableNights.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-border/40" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Potential</p>
                <p className="text-lg font-display font-bold text-emerald-400">{fmt(data.summary.potential)}</p>
              </div>
              <div className="h-8 w-px bg-border/40" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Occupancy ahead</p>
                <p className="text-lg font-display font-bold text-foreground">{data.summary.occPct}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5"><span className={`h-3 w-5 rounded-sm ${l.cls}`} />{l.label}</span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-destructive/20 border border-destructive/40 flex items-center justify-center"><Ban className="h-2.5 w-2.5 text-destructive" /></span>
            Unfillable gap (below min-stay)
          </span>
        </div>

        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading calendar…</div>
        ) : data.properties.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No properties to show.</div>
        ) : (
          <div ref={scrollRef} className="overflow-auto rounded-lg border border-border/30 bg-card/30" style={{ maxHeight: "70vh" }}>
            <div style={{ width: LEFT_W + data.days.length * CELL_W }}>
              {/* Month header */}
              <div className="flex sticky top-0 z-20 bg-background/95 backdrop-blur">
                <div className="sticky left-0 z-30 bg-background/95 border-b border-r border-border/40" style={{ width: LEFT_W, minWidth: LEFT_W }} />
                {monthGroups.map((m, i) => (
                  <div key={i} className="border-b border-l border-border/40 text-xs font-semibold text-foreground px-2 py-1" style={{ width: m.count * CELL_W }}>
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Day header */}
              <div className="flex sticky z-20 bg-background/95 backdrop-blur" style={{ top: 26 }}>
                <div className="sticky left-0 z-30 bg-background/95 border-b border-r border-border/40 flex items-end px-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                  Property
                </div>
                {data.days.map((d, i) => {
                  const dt = parseISO(d);
                  const dow = dt.getDay();
                  const weekend = dow === 0 || dow === 6;
                  const isToday = i === data.todayIdx;
                  return (
                    <div key={d} className={`border-b border-l border-border/20 text-center text-[10px] py-1 ${weekend ? "bg-secondary/30" : ""} ${isToday ? "bg-primary/15 text-primary font-bold" : "text-muted-foreground"}`} style={{ width: CELL_W }}>
                      {format(dt, "d")}
                    </div>
                  );
                })}
              </div>

              {/* Property rows */}
              {data.properties.map((p) => (
                <div key={p.id} className="flex border-b border-border/20" style={{ height: ROW_H }}>
                  {/* Frozen left cell */}
                  <div className="sticky left-0 z-10 bg-card/95 border-r border-border/40 px-3 flex flex-col justify-center" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.occPct}% · {fmt(p.revenue)}</p>
                  </div>
                  {/* Day grid + blocks */}
                  <div className="relative" style={{ width: data.days.length * CELL_W, height: ROW_H }}>
                    {/* background cells */}
                    {data.days.map((d, i) => {
                      const dt = parseISO(d);
                      const dow = dt.getDay();
                      const weekend = dow === 0 || dow === 6;
                      const past = d < data.todayStr;
                      const orphan = p.orphanGaps.has(d);
                      const sellableFuture = !past && !orphan && !p.bookedDays.has(d);
                      return (
                        <div
                          key={d}
                          onClick={sellableFuture ? () => handleGapClick(p, i) : undefined}
                          className={`absolute top-0 border-l border-border/10 ${weekend ? "bg-secondary/20" : ""} ${past ? "opacity-60" : ""} ${sellableFuture ? "cursor-pointer hover:bg-emerald-500/10" : ""}`}
                          style={{ left: i * CELL_W, width: CELL_W, height: ROW_H }}
                        >
                          {orphan && (
                            <div className="w-full h-full bg-destructive/15 flex items-center justify-center"
                              style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239,68,68,0.12) 4px, rgba(239,68,68,0.12) 8px)" }}>
                              <Ban className="h-3 w-3 text-destructive/70" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* today line */}
                    {data.todayIdx >= 0 && (
                      <div className="absolute top-0 z-10 bg-primary/70" style={{ left: data.todayIdx * CELL_W, width: 2, height: ROW_H }} />
                    )}
                    {/* booking blocks */}
                    {p.blocks.map((b) => (
                      <button
                        key={b.reservationId}
                        onClick={() => setSelected({ block: b, property: p.name })}
                        className={`absolute top-1 bottom-1 rounded-md ${platformShade(b.platform)} text-[10px] font-semibold flex items-center px-1.5 overflow-hidden hover:brightness-110 transition`}
                        style={{ left: b.startIdx * CELL_W + 1, width: b.span * CELL_W - 2, height: ROW_H - 8 }}
                        title={`${b.guest ?? "Booking"} · ${format(parseISO(b.start), "d MMM")}–${format(parseISO(b.end), "d MMM")} · ${b.nights}n · ${fmt(b.revenue)}`}
                      >
                        {fmt(b.revenue)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Block detail */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selected?.property}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <Row label="Guest" value={selected.block.guest ?? "—"} />
              <Row label="Check-in" value={format(parseISO(selected.block.start), "EEE d MMM yyyy")} />
              <Row label="Check-out" value={format(parseISO(selected.block.end), "EEE d MMM yyyy")} />
              <Row label="Nights" value={String(selected.block.nights)} />
              <Row label="Revenue" value={fmt(selected.block.revenue)} />
              <Row label="Channel" value={selected.block.platform ?? "—"} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gap detail */}
      <Dialog open={!!gapSel} onOpenChange={(o) => { if (!o) setGapSel(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{gapSel?.property} — open gap</DialogTitle></DialogHeader>
          {gapSel && (
            <div className="space-y-2 text-sm">
              <p className="text-lg font-display font-bold text-foreground">
                {gapSel.nights} night{gapSel.nights === 1 ? "" : "s"} open · <span className="text-emerald-400">{fmt(gapSel.potential)} potential</span>
              </p>
              <Row label="From" value={format(parseISO(gapSel.startDate), "EEE d MMM")} />
              <Row label="Until" value={format(parseISO(addOneDay(gapSel.endDate)), "EEE d MMM")} />
              <p className="text-[11px] text-muted-foreground pt-1">Potential = open nights × this property's average nightly rate.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}

function addOneDay(d: string): string {
  const dt = parseISO(d);
  dt.setDate(dt.getDate() + 1);
  return format(dt, "yyyy-MM-dd");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
