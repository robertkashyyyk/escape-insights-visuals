import { TrendingUp, Bed } from "lucide-react";

const properties = [
  { name: "Lakeside Lodge", location: "Castle Hume", revenue: 48200, occupancy: 82, bedrooms: 4, tags: ["lakeside", "luxury"] },
  { name: "The Penthouse", location: "Belfast", revenue: 41600, occupancy: 78, bedrooms: 3, tags: ["city", "premium"] },
  { name: "Harbour View", location: "Portrush", revenue: 36900, occupancy: 74, bedrooms: 2, tags: ["coastal", "romantic"] },
  { name: "Forest Retreat", location: "Fermanagh", revenue: 33100, occupancy: 71, bedrooms: 5, tags: ["rural", "pet-friendly"] },
  { name: "Garden Suite", location: "Enniskillen", revenue: 28400, occupancy: 68, bedrooms: 2, tags: ["garden", "couples"] },
  { name: "Mountain Escape", location: "Mourne", revenue: 25800, occupancy: 65, bedrooms: 3, tags: ["mountain", "adventure"] },
];

export function TopProperties() {
  return (
    <div className="glass-card p-6 opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Top Properties</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ranked by revenue this period</p>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {properties.map((prop, i) => (
          <div
            key={prop.name}
            className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-sm shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{prop.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">{prop.location}</span>
                <span className="text-muted-foreground/30">•</span>
                <Bed className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{prop.bedrooms}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-display font-semibold text-foreground">£{prop.revenue.toLocaleString()}</p>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-700"
                    style={{ width: `${prop.occupancy}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{prop.occupancy}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
