import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOccupancyHeatmap, type ListingOccupancy, type MonthCell } from "@/hooks/useOccupancyHeatmap";
import { AppLayout } from "@/components/layout/AppLayout";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ScaleBand {
  test: (pct: number) => boolean;
  bg: string;
  text: string;
  label: string;
  range: string;
}

const SCALE: ScaleBand[] = [
  { test: (p) => p <= 0,            bg: "hsl(var(--heat-empty))",     text: "text-muted-foreground", label: "Empty",     range: "0%" },
  { test: (p) => p > 0 && p <= 30,  bg: "hsl(var(--heat-low))",       text: "text-white",            label: "Low",       range: "1–30%" },
  { test: (p) => p > 30 && p <= 60, bg: "hsl(var(--heat-mid))",       text: "text-foreground",       label: "Moderate",  range: "31–60%" },
  { test: (p) => p > 60 && p <= 80, bg: "hsl(var(--heat-high))",      text: "text-foreground",       label: "Good",      range: "61–80%" },
  { test: (p) => p > 80,            bg: "hsl(var(--heat-excellent))", text: "text-white",            label: "Excellent", range: "81–100%" },
];

function getBand(pct: number): ScaleBand {
  return SCALE.find((s) => s.test(pct)) ?? SCALE[0];
}

export default function OccupancyHeatmap() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [locationFilter, setLocationFilter] = useState("all");
  const { data, isLoading } = useOccupancyHeatmap(year);

  const grouped = useMemo(() => {
    if (!data?.listings) return [];
    const filtered = locationFilter === "all"
      ? data.listings
      : data.listings.filter((l) => l.locationGroup === locationFilter);

    const groups = new Map<string, ListingOccupancy[]>();
    filtered.forEach((l) => {
      const arr = groups.get(l.locationGroup) || [];
      arr.push(l);
      groups.set(l.locationGroup, arr);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, locationFilter]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Occupancy Heatmap
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Visual occupancy density across your portfolio</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-bold text-foreground min-w-[4rem] text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {year}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/40 h-9 text-sm">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {data?.locationGroups?.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Legend */}
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            {SCALE.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.bg }} />
                <span className="text-[11px] text-muted-foreground">
                  {s.range}
                  {s.label !== "Empty" && <span className="ml-1 text-foreground/70">{s.label}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  {/* Month header */}
                  <div className="flex border-b border-border/20">
                    <div className="w-48 shrink-0 px-4 py-2.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Property
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-12">
                      {MONTHS.map((m) => (
                        <div key={m} className="text-center py-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            {m}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rows grouped by location */}
                  {grouped.map(([group, listings], gi) => (
                    <div key={group}>
                      {/* Group divider */}
                      {(locationFilter === "all" || grouped.length > 1) && (
                        <div className="flex items-center px-4 py-1.5 bg-secondary/20 border-b border-border/10">
                          <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            {group}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50 ml-2">{listings.length}</span>
                        </div>
                      )}

                      {listings.map((listing) => (
                        <div key={listing.id} className="flex border-b border-border/10 hover:bg-secondary/10 transition-colors">
                          {/* Property name */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-48 shrink-0 px-4 flex items-center">
                                <span
                                  className="text-xs text-foreground/80 truncate block max-w-[11rem]"
                                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                                >
                                  {listing.name}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-popover border-border/40 text-xs">
                              {listing.name}
                            </TooltipContent>
                          </Tooltip>

                          {/* Cells */}
                          <div className="flex-1 grid grid-cols-12">
                            {listing.months.map((cell, mi) => (
                              <HeatmapCell key={mi} cell={cell} propertyName={listing.name} month={MONTHS[mi]} year={year} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {grouped.length === 0 && (
                    <div className="text-center py-12 text-sm text-muted-foreground">No properties found</div>
                  )}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
      </div>
    </AppLayout>
  );
}

function HeatmapCell({ cell, propertyName, month, year }: { cell: MonthCell; propertyName: string; month: string; year: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="p-[2px]">
          <div
            className="w-full rounded-[3px] transition-all duration-150 hover:scale-110 hover:z-10 cursor-default"
            style={{ backgroundColor: getCellColor(cell?.occupancy ?? 0), minHeight: "32px" }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover border-border/40 p-3 space-y-1">
        <p className="font-semibold text-foreground text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{propertyName}</p>
        <p className="text-muted-foreground text-[11px]">{month} {year}</p>
        <div className="h-px bg-border/30 my-1" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          <span className="text-muted-foreground">Occupancy</span>
          <span className="text-foreground font-medium text-right">{cell?.occupancy ?? 0}%</span>
          <span className="text-muted-foreground">Nights</span>
          <span className="text-foreground font-medium text-right">{cell?.nightsBooked ?? 0} / {cell?.nightsAvailable ?? 0}</span>
          <span className="text-muted-foreground">Revenue</span>
          <span className="text-foreground font-medium text-right">£{(cell?.revenue ?? 0).toLocaleString()}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
