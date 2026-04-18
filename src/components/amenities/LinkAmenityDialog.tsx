import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmenitiesList, useLinkAmenity, type PropertyAmenityRow } from "@/hooks/useAmenities";
import { CategoryBadge } from "./CategoryBadge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  initial?: PropertyAmenityRow | null;
}

export function LinkAmenityDialog({ open, onOpenChange, listingId, initial }: Props) {
  const { data: amenities = [] } = useAmenitiesList();
  const link = useLinkAmenity(listingId);

  const [amenityId, setAmenityId] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const [distance, setDistance] = useState("");
  const [drive, setDrive] = useState("");
  const [walk, setWalk] = useState("");
  const [featured, setFeatured] = useState(false);
  const [order, setOrder] = useState("0");
  const [staffNote, setStaffNote] = useState("");

  useEffect(() => {
    if (initial) {
      setAmenityId(initial.amenity_id);
      setDistance(initial.distance_km?.toString() ?? "");
      setDrive(initial.drive_time_mins?.toString() ?? "");
      setWalk(initial.walk_time_mins?.toString() ?? "");
      setFeatured(initial.is_featured);
      setOrder(initial.display_order?.toString() ?? "0");
      setStaffNote(initial.staff_note ?? "");
    } else {
      setAmenityId(""); setDistance(""); setDrive(""); setWalk("");
      setFeatured(false); setOrder("0"); setStaffNote("");
    }
  }, [initial, open]);

  const selected = amenities.find(a => a.id === amenityId);

  const handleSave = async () => {
    if (!amenityId) return;
    await link.mutateAsync({
      ...(initial?.id ? { id: initial.id } : {}),
      amenity_id: amenityId,
      distance_km: distance ? Number(distance) : null,
      drive_time_mins: drive ? Number(drive) : null,
      walk_time_mins: walk ? Number(walk) : null,
      is_featured: featured,
      display_order: order ? Number(order) : 0,
      staff_note: staffNote || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit linked amenity" : "Link amenity to property"}</DialogTitle>
          <DialogDescription>Choose an amenity and set the distance / drive time for this property.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Amenity *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!!initial}>
                  {selected ? (
                    <span className="flex items-center gap-2 truncate">
                      <CategoryBadge category={selected.category} showIcon={false} />
                      <span className="truncate">{selected.name}</span>
                    </span>
                  ) : "Select amenity..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search amenities..." />
                  <CommandList>
                    <CommandEmpty>No amenity found.</CommandEmpty>
                    <CommandGroup>
                      {amenities.filter(a => a.is_active).map(a => (
                        <CommandItem
                          key={a.id} value={`${a.name} ${a.postcode || ""}`}
                          onSelect={() => { setAmenityId(a.id); setComboOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", amenityId === a.id ? "opacity-100" : "opacity-0")} />
                          <CategoryBadge category={a.category} showIcon={false} className="mr-2" />
                          <span className="truncate">{a.name}</span>
                          {a.postcode && <span className="ml-auto text-xs text-muted-foreground">{a.postcode}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Distance (km)</Label>
              <Input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} />
            </div>
            <div>
              <Label>Drive (mins)</Label>
              <Input type="number" value={drive} onChange={e => setDrive(e.target.value)} />
            </div>
            <div>
              <Label>Walk (mins)</Label>
              <Input type="number" value={walk} onChange={e => setWalk(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Display order</Label>
              <Input type="number" value={order} onChange={e => setOrder(e.target.value)} />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch checked={featured} onCheckedChange={setFeatured} id="featured" />
              <Label htmlFor="featured" className="cursor-pointer">Featured (pin to top)</Label>
            </div>
          </div>

          <div>
            <Label>Staff note (masked from owners & guests)</Label>
            <Textarea rows={3} value={staffNote} onChange={e => setStaffNote(e.target.value)} placeholder="Internal note — gate code, parking quirks, etc." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!amenityId || link.isPending}>
              {initial ? "Save" : "Link amenity"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
