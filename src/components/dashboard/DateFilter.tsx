import { useState } from "react";
import { Calendar } from "lucide-react";

const filters = ["Year", "Quarter", "Month", "Week"] as const;
type Filter = (typeof filters)[number];

export function DateFilter() {
  const [active, setActive] = useState<Filter>("Year");

  return (
    <div className="flex items-center gap-3 opacity-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              active === f
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-2">2025</span>
    </div>
  );
}
