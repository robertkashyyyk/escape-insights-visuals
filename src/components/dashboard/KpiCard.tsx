import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: { value: string; positive: boolean };
  icon: LucideIcon;
  accentColor?: "primary" | "accent" | "chart-3" | "chart-4" | "chart-5";
  delay?: number;
}

const accentMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", glow: "glow-amber" },
  accent: { bg: "bg-accent/10", text: "text-accent", glow: "glow-teal" },
  "chart-3": { bg: "bg-chart-3/10", text: "text-chart-3", glow: "" },
  "chart-4": { bg: "bg-chart-4/10", text: "text-chart-4", glow: "" },
  "chart-5": { bg: "bg-chart-5/10", text: "text-chart-5", glow: "" },
};

export function KpiCard({ title, value, subtitle, change, icon: Icon, accentColor = "primary", delay = 0 }: KpiCardProps) {
  const colors = accentMap[accentColor];
  
  return (
    <div
      className="glass-card-hover p-5 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            change.positive 
              ? "bg-success/10 text-success" 
              : "bg-destructive/10 text-destructive"
          }`}>
            {change.positive ? "+" : ""}{change.value}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-display font-bold text-foreground tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
