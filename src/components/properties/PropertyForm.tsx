import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing?: Tables<"listings">;
  onSuccess: () => void;
}

const emptyForm = {
  name: "",
  owner_id: "",
  hostaway_listing_id: "",
  address: "",
  city: "",
  postcode: "",
  country: "",
  location_group: "",
  property_type: "",
  bedrooms: "",
  bathrooms: "",
  max_guests: "",
  nightly_rate: "",
  min_rate: "",
  base_rate: "",
  tags: "",
  status: "active",
  is_bundle: false,
  bundle_components: "" as string,
};

export function PropertyForm({ open, onOpenChange, listing, onSuccess }: PropertyFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = !!listing;

  const { data: owners } = useQuery({
    queryKey: ["property_owners_select"],
    queryFn: async () => {
      const { data } = await supabase.from("property_owners").select("id, name").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (listing) {
      setForm({
        name: listing.name,
        owner_id: listing.owner_id,
        hostaway_listing_id: listing.hostaway_listing_id?.toString() ?? "",
        address: listing.address ?? "",
        city: listing.city ?? "",
        postcode: listing.postcode ?? "",
        country: listing.country ?? "",
        location_group: listing.location_group ?? "",
        property_type: listing.property_type ?? "",
        bedrooms: listing.bedrooms?.toString() ?? "",
        bathrooms: listing.bathrooms?.toString() ?? "",
        max_guests: listing.max_guests?.toString() ?? "",
        nightly_rate: listing.nightly_rate?.toString() ?? "",
        min_rate: listing.min_rate?.toString() ?? "",
        base_rate: listing.base_rate?.toString() ?? "",
        tags: listing.tags ?? "",
        status: listing.status,
        is_bundle: (listing as any).is_bundle ?? false,
        bundle_components: (listing as any).bundle_components ? JSON.stringify((listing as any).bundle_components, null, 2) : "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [listing, open]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name || !form.owner_id) {
      toast({ title: "Name and Owner are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      owner_id: form.owner_id,
      hostaway_listing_id: form.hostaway_listing_id ? parseInt(form.hostaway_listing_id) : null,
      address: form.address || null,
      city: form.city || null,
      postcode: form.postcode || null,
      country: form.country || null,
      location_group: form.location_group || null,
      property_type: form.property_type || null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
      max_guests: form.max_guests ? parseInt(form.max_guests) : null,
      nightly_rate: form.nightly_rate ? parseFloat(form.nightly_rate) : null,
      min_rate: form.min_rate ? parseFloat(form.min_rate) : null,
      base_rate: form.base_rate ? parseFloat(form.base_rate) : null,
      tags: form.tags || null,
      status: form.status,
      is_bundle: form.is_bundle,
      bundle_components: form.bundle_components ? JSON.parse(form.bundle_components) : null,
    };

    const { error } = isEdit
      ? await supabase.from("listings").update(payload).eq("id", listing!.id)
      : await supabase.from("listings").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving property", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Property updated" : "Property added" });
      onOpenChange(false);
      onSuccess();
    }
  };

  const field = (label: string, key: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Property" : "Add Property"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {field("Name *", "name")}
          <div className="space-y-1.5">
            <Label className="text-xs">Owner *</Label>
            <Select value={form.owner_id} onValueChange={(v) => set("owner_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                {owners?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("Hostaway Listing ID", "hostaway_listing_id", "number")}
          {field("Address", "address")}
          <div className="grid grid-cols-2 gap-3">
            {field("City", "city")}
            {field("Postcode", "postcode")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Country", "country")}
            {field("Location Group", "location_group")}
          </div>
          {field("Property Type", "property_type")}
          <div className="grid grid-cols-3 gap-3">
            {field("Bedrooms", "bedrooms", "number")}
            {field("Bathrooms", "bathrooms", "number")}
            {field("Max Guests", "max_guests", "number")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {field("Nightly Rate", "nightly_rate", "number")}
            {field("Min Rate", "min_rate", "number")}
            {field("Base Rate", "base_rate", "number")}
          </div>
          {field("Tags", "tags")}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Bundle / Dual Listing</Label>
              <Switch
                checked={form.is_bundle}
                onCheckedChange={(v) => set("is_bundle", v as any)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Mark this listing as a bundle of two or more component listings.</p>
          </div>
          {form.is_bundle && (
            <div className="space-y-1.5">
              <Label className="text-xs">Bundle Components (JSON)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[80px]"
                placeholder={`[{"listing_id": "uuid", "split_pct": 55}, {"listing_id": "uuid", "split_pct": 45}]`}
                value={form.bundle_components}
                onChange={(e) => set("bundle_components", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Define component listings and their revenue/night split percentages.</p>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "Saving..." : isEdit ? "Update Property" : "Add Property"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
