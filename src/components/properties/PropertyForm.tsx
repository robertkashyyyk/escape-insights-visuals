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
import { Minus, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useLocationGroups } from "@/hooks/useLocationGroups";
import { useCommunalGroups } from "@/hooks/useCommunalGroups";
import { AlertTriangle } from "lucide-react";
import { PropertyBedsEditor } from "@/components/properties/PropertyBedsEditor";

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing?: Tables<"listings">;
  onSuccess: () => void;
}

interface BundleComponent {
  listing_id: string;
  split_pct: number;
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
  cleaning_fee: "",
  deep_fee: "",
  is_communal: false,
  communal_group_id: "",
  communal_ratio_pct: "",
};

export function PropertyForm({ open, onOpenChange, listing, onSuccess }: PropertyFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!listing;

  const { data: owners } = useQuery({
    queryKey: ["property_owners_select"],
    queryFn: async () => {
      const { data } = await supabase.from("property_owners").select("id, name").order("name");
      return data ?? [];
    },
  });

  // Fetch sibling listings for the same owner (for bundle component selection)
  const { data: siblingListings } = useQuery({
    queryKey: ["sibling_listings", form.owner_id],
    queryFn: async () => {
      if (!form.owner_id) return [];
      const { data } = await supabase
        .from("listings")
        .select("id, name, is_bundle")
        .eq("owner_id", form.owner_id)
        .order("name");
      // Exclude the current listing and other bundles
      return (data ?? []).filter(l => l.id !== listing?.id && !(l as any).is_bundle);
    },
    enabled: !!form.owner_id && form.is_bundle,
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
        cleaning_fee: (listing as any).cleaning_fee?.toString() ?? "",
        deep_fee: (listing as any).deep_fee?.toString() ?? "",
        is_communal: (listing as any).is_communal ?? false,
        communal_group_id: (listing as any).communal_group_id ?? "",
        communal_ratio_pct: (listing as any).communal_ratio_pct?.toString() ?? "",
      });
      const comps = (listing as any).bundle_components;
      if (Array.isArray(comps)) {
        setBundleComponents(comps.map((c: any) => ({ listing_id: c.listing_id || "", split_pct: c.split_pct || 0 })));
      } else {
        setBundleComponents([]);
      }
    } else {
      setForm(emptyForm);
      setBundleComponents([]);
    }
  }, [listing, open]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const splitTotal = bundleComponents.reduce((s, c) => s + (c.split_pct || 0), 0);
  const splitValid = !form.is_bundle || bundleComponents.length === 0 || splitTotal === 100;

  const updateComponent = (idx: number, field: keyof BundleComponent, val: any) => {
    setBundleComponents(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const addComponent = () => {
    setBundleComponents(prev => [...prev, { listing_id: "", split_pct: 0 }]);
  };

  const removeComponent = (idx: number) => {
    setBundleComponents(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.name || !form.owner_id) {
      toast({ title: "Name and Owner are required", variant: "destructive" });
      return;
    }
    if (form.is_bundle && !splitValid) {
      toast({ title: "Split percentages must total 100%", variant: "destructive" });
      return;
    }
    if (form.is_bundle && bundleComponents.some(c => !c.listing_id)) {
      toast({ title: "Please select a property for each bundle component", variant: "destructive" });
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
      bundle_components: form.is_bundle && bundleComponents.length > 0 ? JSON.parse(JSON.stringify(bundleComponents)) : null,
      cleaning_fee: form.cleaning_fee ? parseFloat(form.cleaning_fee) : null,
      deep_fee: form.deep_fee ? parseFloat(form.deep_fee) : null,
      is_communal: form.is_communal,
      communal_group_id: form.is_communal && form.communal_group_id ? form.communal_group_id : null,
      communal_ratio_pct: form.is_communal && form.communal_ratio_pct ? parseFloat(form.communal_ratio_pct) : null,
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
            <LocationGroupField value={form.location_group} onChange={(v) => set("location_group", v)} />
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

          {/* Cleaning fees */}
          <div className="grid grid-cols-2 gap-3">
            {field("Cleaning Fee (£)", "cleaning_fee", "number")}
            {field("Deep Clean Fee (£)", "deep_fee", "number")}
          </div>

          {/* Communal */}
          <CommunalSection
            isCommunal={form.is_communal}
            groupId={form.communal_group_id}
            ratio={form.communal_ratio_pct}
            onToggle={(v) => {
              set("is_communal", v);
              if (!v) { set("communal_group_id", ""); set("communal_ratio_pct", ""); }
            }}
            onGroupChange={(v) => set("communal_group_id", v)}
            onRatioChange={(v) => set("communal_ratio_pct", v)}
          />

          {/* Bedrooms & Beds (drives laundry cost) — needs a saved listing id */}
          {isEdit ? (
            <PropertyBedsEditor listingId={listing!.id} />
          ) : (
            <div className="border border-dashed border-border/40 rounded-lg p-4 text-[11px] text-muted-foreground">
              Save the property first, then reopen it to set up Bedrooms &amp; Beds (laundry).
            </div>
          )}

          {/* Bundle / Dual Listing */}
          <div className="border border-border/30 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Bundle / Dual Listing</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  A bundle combines two or more properties into one listing. Bundles don't appear in cleaning schedules.
                </p>
              </div>
              <Switch
                checked={form.is_bundle}
                onCheckedChange={(v) => set("is_bundle", v)}
              />
            </div>

            {form.is_bundle && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Component Properties</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addComponent} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>

                {bundleComponents.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-3 border border-dashed border-border/40 rounded-md">
                    No components added. Click "Add" to select properties.
                  </p>
                )}

                {bundleComponents.map((comp, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Property {idx + 1}</Label>
                      <Select value={comp.listing_id} onValueChange={(v) => updateComponent(idx, "listing_id", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {siblingListings?.map((sl) => (
                            <SelectItem key={sl.id} value={sl.id}>{sl.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Split %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-8 text-xs"
                        value={comp.split_pct}
                        onChange={(e) => updateComponent(idx, "split_pct", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      className="h-8 w-8 shrink-0 rounded-md border border-border/30 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {bundleComponents.length > 0 && (
                  <div className={`text-xs font-medium text-right ${splitValid ? "text-emerald-400" : "text-destructive"}`}>
                    Total: {splitTotal}% {!splitValid && "(must be 100%)"}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving || (form.is_bundle && !splitValid)} className="mt-2">
            {saving ? "Saving..." : isEdit ? "Update Property" : "Add Property"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CommunalSection({
  isCommunal,
  groupId,
  ratio,
  onToggle,
  onGroupChange,
  onRatioChange,
}: {
  isCommunal: boolean;
  groupId: string;
  ratio: string;
  onToggle: (v: boolean) => void;
  onGroupChange: (v: string) => void;
  onRatioChange: (v: string) => void;
}) {
  const { data: groups = [] } = useCommunalGroups();
  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-semibold">Communal</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Off = Self-Contained. On = shares communal costs with a group.
          </p>
        </div>
        <Switch checked={isCommunal} onCheckedChange={onToggle} />
      </div>

      {isCommunal && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Communal Group</Label>
            <Select value={groupId || "__none__"} onValueChange={(v) => onGroupChange(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select communal group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groups.length === 0 && (
              <p className="text-[10px] text-muted-foreground">
                No communal groups yet — create one under Settings → General → Communal Groups.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Communal Share (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.001"
              value={ratio}
              onChange={(e) => onRatioChange(e.target.value)}
              placeholder="e.g. 10"
            />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Shares across the group must total exactly 100%. Set and validate them in
              Settings → Communal Groups.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationGroupField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: groups = [] } = useLocationGroups();
  const managed = groups.map(g => g.name);
  const isLegacy = !!value && !managed.includes(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Location Group</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select location group" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {isLegacy && (
            <SelectItem value={value}>
              {value} (legacy)
            </SelectItem>
          )}
          {managed.map(name => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLegacy && (
        <p className="text-[10px] text-amber-300 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Legacy value — remap to a managed group, or add it under Settings → General → Location Groups.
        </p>
      )}
    </div>
  );
}
