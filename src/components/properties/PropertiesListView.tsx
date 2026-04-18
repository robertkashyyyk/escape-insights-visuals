import { Link } from "react-router-dom";
import { Bed, Bath, Users, MapPin, Pencil, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PropertyFeatures } from "./PropertyFeatures";

interface ListingRow {
  id: string;
  name: string;
  city?: string | null;
  location_group?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  is_clean?: boolean;
  is_bundle?: boolean;
  has_hot_tub?: boolean;
  has_ev_charger?: boolean;
  pet_friendly?: boolean;
  self_check_in?: boolean;
  primary_cleaner?: string | null;
  property_owners?: { name: string } | null;
}

interface Props {
  rows: ListingRow[];
  onEdit: (id: string) => void;
}

export function PropertiesListView({ rows, onEdit }: Props) {
  return (
    <div className="glass-card rounded-xl border border-border/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Property</th>
              <th className="text-left font-medium px-3 py-2.5">Owner</th>
              <th className="text-left font-medium px-3 py-2.5">Location</th>
              <th className="text-center font-medium px-2 py-2.5"><Bed className="inline h-3.5 w-3.5" /></th>
              <th className="text-center font-medium px-2 py-2.5"><Bath className="inline h-3.5 w-3.5" /></th>
              <th className="text-center font-medium px-2 py-2.5"><Users className="inline h-3.5 w-3.5" /></th>
              <th className="text-left font-medium px-3 py-2.5">Amenities</th>
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-right font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const ownerName = l.property_owners?.name;
              const isClean = l.is_clean ?? true;
              return (
                <tr key={l.id} className="border-t border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground truncate max-w-[240px]">{l.name}</div>
                    {l.is_bundle && <span className="text-[9px] text-primary">Bundle</span>}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground truncate max-w-[160px]">{ownerName || "—"}</td>
                  <td className="px-3 py-3">
                    {l.location_group ? (
                      <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary">
                        {l.location_group}
                      </Badge>
                    ) : l.city ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" />{l.city}</span>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{l.bedrooms ?? "—"}</td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{l.bathrooms ?? "—"}</td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{l.max_guests ?? "—"}</td>
                  <td className="px-3 py-3">
                    <PropertyFeatures
                      hasHotTub={l.has_hot_tub}
                      hasEvCharger={l.has_ev_charger}
                      petFriendly={l.pet_friendly}
                      selfCheckIn={l.self_check_in}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {l.is_bundle ? (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    ) : isClean ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Clean
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Dirty
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onEdit(l.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        to={`/properties/${l.id}`}
                        className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
