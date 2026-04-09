import { Pencil, PoundSterling, Percent, BedDouble, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OwnerPerformanceRow } from "@/hooks/useOwnerPerformance";

interface Props {
  owner: OwnerPerformanceRow;
  year: number;
  onEdit: (id: string) => void;
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-10">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-primary/70 min-h-[2px] transition-all"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function KpiBlock({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

export function OwnerPerformanceCard({ owner, year, onEdit }: Props) {
  const rateDisplay = owner.managementRatePct != null
    ? `${owner.managementRatePct}%${owner.vatInclusive ? " incl. VAT" : ""}`
    : null;

  return (
    <div className="glass-card p-5 md:p-6 hover:translate-y-[-2px] hover:shadow-xl transition-all duration-200 group">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Left — Identity */}
        <div className="lg:w-[280px] shrink-0 space-y-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg text-foreground truncate">{owner.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{owner.company || "—"}</p>
            </div>
            <button
              onClick={() => onEdit(owner.id)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0 ml-2"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-medium">
              {owner.propertyCount} {owner.propertyCount === 1 ? "property" : "properties"}
            </Badge>
            {rateDisplay && (
              <Badge variant="secondary" className="text-[10px]">
                {rateDisplay}
              </Badge>
            )}
          </div>
          {owner.locationGroups.length > 0 && (
            <p className="text-[11px] text-muted-foreground truncate">
              {owner.locationGroups.join(" · ")}
            </p>
          )}
        </div>

        {/* Middle — KPIs */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiBlock label="Revenue" value={fmt(owner.totalRevenue)} icon={PoundSterling} />
          <KpiBlock label="Mgmt Fee" value={fmt(owner.managementFee)} icon={Receipt} />
          <KpiBlock label="Blended ADR" value={fmt(owner.blendedAdr)} icon={BedDouble} />
          <KpiBlock label="Occupancy" value={`${owner.avgOccupancy.toFixed(1)}%`} icon={Percent} />
        </div>

        {/* Right — Sparkline (hidden on mobile) */}
        <div className="hidden md:block w-[140px] shrink-0">
          <MiniSparkline data={owner.monthlyRevenue} />
          <p className="text-[9px] text-muted-foreground text-center mt-1">Jan–Dec {year}</p>
        </div>
      </div>

      {/* No data note */}
      {!owner.hasData && (
        <p className="text-[11px] text-muted-foreground/60 mt-3 italic">No data for {year}</p>
      )}
    </div>
  );
}
