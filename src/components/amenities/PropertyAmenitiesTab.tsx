import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, ExternalLink, Star, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { LinkAmenityDialog } from "./LinkAmenityDialog";
import {
  usePropertyAmenities, useUnlinkAmenity, type PropertyAmenityRow,
} from "@/hooks/useAmenities";
import { buildDirectionsUrl, formatDistance } from "@/lib/amenityCategories";

interface Props {
  listingId: string;
}

function StaffNoteCell({ note }: { note: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-start gap-2 max-w-[280px]">
      <p className={`text-xs ${revealed ? "text-foreground" : "text-muted-foreground font-mono tracking-widest"}`}>
        {revealed ? note : "•••••• tap to reveal"}
      </p>
      <button
        type="button"
        onClick={() => setRevealed(r => !r)}
        className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
        aria-label={revealed ? "Hide note" : "Reveal note"}
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function PropertyAmenitiesTab({ listingId }: Props) {
  const { data: rows = [], isLoading } = usePropertyAmenities(listingId);
  const unlink = useUnlinkAmenity(listingId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyAmenityRow | null>(null);

  const handleAdd = () => { setEditing(null); setOpen(true); };
  const handleEdit = (r: PropertyAmenityRow) => { setEditing(r); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {rows.length} amenit{rows.length === 1 ? "y" : "ies"} linked to this property.
        </p>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Link amenity
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Staff note</TableHead>
              <TableHead className="text-right w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No amenities linked yet — link one to start.</TableCell></TableRow>
            )}
            {rows.map(r => {
              const url = r.directions_url || buildDirectionsUrl({
                latitude: r.latitude, longitude: r.longitude, name: r.name, postcode: r.postcode,
              });
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.is_featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.name}</div>
                    {r.postcode && <div className="text-xs text-muted-foreground">{r.postcode}</div>}
                  </TableCell>
                  <TableCell><CategoryBadge category={r.category} /></TableCell>
                  <TableCell className="text-sm tabular-nums whitespace-nowrap">
                    {formatDistance(r.distance_km, r.drive_time_mins)}
                  </TableCell>
                  <TableCell>
                    {r.staff_note ? <StaffNoteCell note={r.staff_note} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> Directions
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(r)} aria-label="Edit">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { if (confirm(`Unlink "${r.name}" from this property?`)) unlink.mutate(r.id); }}
                        aria-label="Unlink"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <LinkAmenityDialog open={open} onOpenChange={setOpen} listingId={listingId} initial={editing} />
    </div>
  );
}
