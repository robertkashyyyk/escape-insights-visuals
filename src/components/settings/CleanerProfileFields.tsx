import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocationGroups } from "@/hooks/useLocationGroups";
import { Loader2, MapPin, Check } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface CleanerProfileValue {
  location_groups: string[];
  workload_share: Record<string, number>;
  non_working_days: string[];
  daily_working_hours: number;
  rate_per_clean: number;
  home_postcode: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
}

interface Props {
  value: CleanerProfileValue;
  onChange: (patch: Partial<CleanerProfileValue>) => void;
}

/** Shared cleaner operational fields — used by the Add-Person wizard and the
 *  per-user Manage sheet so the two never drift. Fully controlled. */
export function CleanerProfileFields({ value, onChange }: Props) {
  const { data: locationGroupsData = [] } = useLocationGroups();
  const LOCATION_GROUPS = locationGroupsData.map((g: any) => g.name);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  const toggle = (arr: string[], v: string): string[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const geocode = async () => {
    const pc = (value.home_postcode || "").trim();
    if (!pc) return;
    setGeocoding(true); setGeocodeResult(null);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      const data = await res.json();
      if (data.status === 200 && data.result) {
        onChange({ home_latitude: data.result.latitude, home_longitude: data.result.longitude });
        const parts = [data.result.admin_district, data.result.admin_county].filter(Boolean);
        setGeocodeResult(`📍 ${parts.join(", ") || "Location found"}`);
      } else {
        setGeocodeResult("❌ Postcode not found");
      }
    } catch {
      setGeocodeResult("❌ Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Regions (location groups)</Label>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_GROUPS.map((g) => (
            <Badge key={g} variant={value.location_groups.includes(g) ? "default" : "outline"}
              className="cursor-pointer" onClick={() => onChange({ location_groups: toggle(value.location_groups, g) })}>
              {value.location_groups.includes(g) && <Check className="h-3 w-3 mr-1" />}{g}
            </Badge>
          ))}
        </div>
      </div>

      {value.location_groups.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Workload share (%) per region</Label>
          {value.location_groups.map((g) => (
            <div key={g} className="flex items-center gap-2">
              <span className="text-sm w-40 truncate">{g}</span>
              <Input type="number" min={0} max={100} value={value.workload_share[g] ?? ""} placeholder="0"
                onChange={(e) => onChange({ workload_share: { ...value.workload_share, [g]: Number(e.target.value) } })}
                className="bg-secondary/50 border-border/40 h-8 w-24" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Non-working days</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <Badge key={d} variant={value.non_working_days.includes(d) ? "default" : "outline"}
              className="cursor-pointer" onClick={() => onChange({ non_working_days: toggle(value.non_working_days, d) })}>{d}</Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Daily hours</Label>
          <Input type="number" min={1} max={16} value={value.daily_working_hours}
            onChange={(e) => onChange({ daily_working_hours: Number(e.target.value) })} className="bg-secondary/50 border-border/40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rate per clean (£)</Label>
          <Input type="number" min={0} value={value.rate_per_clean}
            onChange={(e) => onChange({ rate_per_clean: Number(e.target.value) })} className="bg-secondary/50 border-border/40" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Home postcode (for routing)</Label>
        <div className="flex gap-2">
          <Input value={value.home_postcode ?? ""} onChange={(e) => onChange({ home_postcode: e.target.value })}
            placeholder="BT74 4AA" className="bg-secondary/50 border-border/40" />
          <Button type="button" variant="outline" onClick={geocode} disabled={geocoding || !(value.home_postcode || "").trim()}>
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        </div>
        {geocodeResult && <p className="text-[11px] text-muted-foreground">{geocodeResult}</p>}
      </div>
    </div>
  );
}
