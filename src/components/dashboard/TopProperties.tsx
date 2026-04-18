import { TrendingUp, Bed, Bath, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TopProperty {
  name: string;
  location: string;
  revenue: number;
  occupancy: number;
  bedrooms: number;
  bathrooms?: number;
  maxGuests?: number;
}

interface TopPropertiesProps {
  properties: TopProperty[];
  isLoading: boolean;
}

export function TopProperties({ properties, isLoading }: TopPropertiesProps) {
  return (
    <div className="glass-card p-6 h-full opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Top Properties</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ranked by revenue this period</p>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : properties.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No reservation data for this period</p>
        ) : (
          properties.map((prop, i) => (
            <div
              key={prop.name}
              className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{prop.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">{prop.location}</span>
                  {prop.bedrooms > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="text-muted-foreground/30">•</span>
                      <Bed className="h-3 w-3" /> {prop.bedrooms}
                    </span>
                  )}
                  {prop.bathrooms != null && prop.bathrooms > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Bath className="h-3 w-3" /> {prop.bathrooms}
                    </span>
                  )}
                  {prop.maxGuests != null && prop.maxGuests > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {prop.maxGuests}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-display font-semibold text-foreground">£{prop.revenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-700"
                      style={{ width: `${Math.min(prop.occupancy, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{prop.occupancy}%</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
