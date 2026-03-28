import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOccupancyHeatmap } from "@/hooks/useOccupancyHeatmap";
import { AppLayout } from "@/components/layout/AppLayout";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getCellStyle(value: number) {
  if (value === 0) return { backgroundColor: "rgba(100, 116, 139, 0.1)" };
  if (value < 40) {
    const intensity = 0.15 + (value / 40) * 0.25;
    return { backgroundColor: `rgba(239, 68, 68, ${intensity})` };
  }
  if (value <= 75) {
    const intensity = 0.15 + ((value - 40) / 35) * 0.2;
    return { backgroundColor: `rgba(245, 158, 11, ${intensity})` };
  }
  const intensity = 0.25 + ((value - 75) / 25) * 0.35;
  return { backgroundColor: `rgba(16, 185, 129, ${intensity})` };
}

function getCellTextClass(value: number) {
  if (value === 0) return "text-muted-foreground";
  if (value < 40) return "text-red-400";
  if (value <= 75) return "text-amber-400";
  return "text-emerald-400";
}

export default function OccupancyHeatmap() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useOccupancyHeatmap(year);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Year toggle */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-display font-bold text-foreground min-w-[4rem] text-center">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.3)" }} />
            <span>&lt; 40%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded" style={{ backgroundColor: "rgba(245, 158, 11, 0.25)" }} />
            <span>40–75%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded" style={{ backgroundColor: "rgba(16, 185, 129, 0.4)" }} />
            <span>&gt; 75%</span>
          </div>
        </div>

        {/* Heatmap */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="sticky left-0 z-10 bg-card text-left text-xs font-medium text-muted-foreground px-4 py-3 w-48">
                    Property
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-center text-xs font-medium text-muted-foreground px-2 py-3 w-16">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        {Array.from({ length: 12 }).map((_, j) => (
                          <td key={j} className="px-2 py-2.5">
                            <Skeleton className="h-8 w-full rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data?.listings.map((listing) => (
                      <tr key={listing.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-sm font-medium text-foreground truncate max-w-[12rem]">
                          {listing.name}
                        </td>
                        {listing.months.map((val, i) => (
                          <td key={i} className="px-1 py-1.5">
                            <div
                              className={`flex items-center justify-center rounded-md h-9 text-xs font-semibold transition-colors ${getCellTextClass(val)}`}
                              style={getCellStyle(val)}
                            >
                              {val}%
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
