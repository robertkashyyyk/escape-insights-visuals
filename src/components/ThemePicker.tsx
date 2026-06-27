import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { Sun, Moon, Sparkles, type LucideIcon } from "lucide-react";

const OPTIONS: { id: Theme; label: string; Icon: LucideIcon }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "brand", label: "Brand", Icon: Sparkles },
];

// 3-way segmented theme control (replaces the binary sun/moon toggle).
export function ThemePicker({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary/60 border border-border/40 ${className}`}>
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          title={label}
          aria-label={`${label} theme`}
          aria-pressed={theme === id}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
            theme === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
