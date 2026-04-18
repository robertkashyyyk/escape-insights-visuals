import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_CATEGORIES, AMENITY_CATEGORIES, type AmenityCategory } from "@/lib/amenityCategories";
import { useUpsertAmenity, type Amenity } from "@/hooks/useAmenities";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Amenity | null;
}

const empty = {
  name: "",
  category: "other" as AmenityCategory,
  address: "",
  postcode: "",
  latitude: "",
  longitude: "",
  phone: "",
  website: "",
  opening_hours: "",
  notes: "",
  price_range: "",
  rating: "",
  tags: "",
  is_active: true,
};

export function AmenityFormSheet({ open, onOpenChange, initial }: Props) {
  const upsert = useUpsertAmenity();
  const [form, setForm] = useState({ ...empty });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        category: initial.category,
        address: initial.address ?? "",
        postcode: initial.postcode ?? "",
        latitude: initial.latitude?.toString() ?? "",
        longitude: initial.longitude?.toString() ?? "",
        phone: initial.phone ?? "",
        website: initial.website ?? "",
        opening_hours: initial.opening_hours ?? "",
        notes: initial.notes ?? "",
        price_range: initial.price_range ?? "",
        rating: initial.rating?.toString() ?? "",
        tags: (initial.tags || []).join(", "),
        is_active: initial.is_active,
      });
    } else {
      setForm({ ...empty });
    }
  }, [initial, open]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      ...(initial?.id ? { id: initial.id } : {}),
      name: form.name.trim(),
      category: form.category,
      address: form.address || null,
      postcode: form.postcode || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      phone: form.phone || null,
      website: form.website || null,
      opening_hours: form.opening_hours || null,
      notes: form.notes || null,
      price_range: form.price_range || null,
      rating: form.rating ? Number(form.rating) : null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      is_active: form.is_active,
    } as any);
    onOpenChange(false);
  };

  const set = (k: keyof typeof form) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit amenity" : "Add amenity"}</SheetTitle>
          <SheetDescription>Local point of interest near one or more properties.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="Tesco Enniskillen" />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => set("category")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ALL_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{AMENITY_CATEGORIES[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price range</Label>
              <Select value={form.price_range || "none"} onValueChange={v => set("price_range")(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="£">£</SelectItem>
                  <SelectItem value="££">££</SelectItem>
                  <SelectItem value="£££">£££</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set("address")(e.target.value)} />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={e => set("postcode")(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone")(e.target.value)} />
            </div>
            <div>
              <Label>Latitude</Label>
              <Input type="number" step="any" value={form.latitude} onChange={e => set("latitude")(e.target.value)} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" step="any" value={form.longitude} onChange={e => set("longitude")(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={e => set("website")(e.target.value)} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Label>Opening hours</Label>
              <Input value={form.opening_hours} onChange={e => set("opening_hours")(e.target.value)} placeholder="Mon–Sat 8am–10pm" />
            </div>
            <div>
              <Label>Rating (1–5)</Label>
              <Input type="number" min={0} max={5} step="0.1" value={form.rating} onChange={e => set("rating")(e.target.value)} />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={e => set("tags")(e.target.value)} placeholder="dog-friendly, family" />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={e => set("notes")(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={set("is_active")} id="active" />
              <Label htmlFor="active" className="cursor-pointer">Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !form.name.trim()}>
              {initial ? "Save changes" : "Add amenity"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
