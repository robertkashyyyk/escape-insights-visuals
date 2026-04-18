import { useState, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type FieldProps = {
  label: string;
  value: string | null | undefined;
  onChange?: (v: string) => void;
  editing: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  type?: string;
};

export function KField({ label, value, onChange, editing, multiline, sensitive, placeholder, type }: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const display = sensitive && !revealed && value ? "••••••" : value || "";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={4}
          />
        ) : (
          <Input
            type={type}
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="flex items-start gap-2 min-h-[2rem]">
          {value ? (
            <p className={`text-sm text-foreground whitespace-pre-wrap break-words ${sensitive && !revealed ? "font-mono tracking-widest" : ""}`}>
              {display}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Not set</p>
          )}
          {sensitive && value && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="p-1 -mt-0.5 text-muted-foreground hover:text-foreground"
              aria-label={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
};

export function KSection({ title, description, defaultOpen = false, children, rightSlot }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
      >
        <div>
          <h2 className="font-display font-semibold text-base">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {rightSlot}
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
      </button>
      {open && <div className="p-4 pt-0 border-t border-border/50 space-y-4">{children}</div>}
    </div>
  );
}
