import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Pencil, Save, X, Plus, Trash2, MapPin, Phone, Mail } from "lucide-react";
import {
  usePropertyKnowledge, useUpdateKnowledge, useChildMutation,
  type PropertyKnowledge,
} from "@/hooks/usePropertyKnowledge";
import { KField, KSection } from "@/components/property-knowledge/KField";
import { PropertyAmenitiesTab } from "@/components/amenities/PropertyAmenitiesTab";
import { formatDistanceToNow } from "date-fns";

export default function PropertyKnowledgeDetail() {
  const { listingId } = useParams();
  const { data, isLoading } = usePropertyKnowledge(listingId);
  const update = useUpdateKnowledge(listingId!);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<PropertyKnowledge>>({});

  useEffect(() => {
    if (data?.knowledge) setDraft({});
  }, [data?.knowledge]);

  if (isLoading || !data) {
    return (
      <AppLayout>
        <div className="p-6">Loading...</div>
      </AppLayout>
    );
  }

  const k = { ...data.knowledge, ...draft } as PropertyKnowledge;
  const set = (field: keyof PropertyKnowledge) => (v: any) =>
    setDraft((d) => ({ ...d, [field]: v }));

  const handleSave = async () => {
    await update.mutateAsync(draft);
    setDraft({});
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({});
    setEditing(false);
  };

  const mapsUrl = data.listing.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.listing.address)}`
    : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link to="/property-knowledge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All properties
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-display font-bold tracking-tight">{data.listing.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {data.listing.location_group && (
                <Badge variant="outline">{data.listing.location_group}</Badge>
              )}
              {data.listing.bedrooms && (
                <span className="text-sm text-muted-foreground">{data.listing.bedrooms} bedrooms</span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3 max-w-md">
              <Progress value={k.completion_score} className="h-2 flex-1" />
              <span className="text-sm font-semibold text-primary tabular-nums">{k.completion_score}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last updated {formatDistanceToNow(new Date(k.updated_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Section 1: Overview */}
        <KSection title="Property Overview" description="Address, type, and general context" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address</Label>
              <div className="flex items-center gap-2">
                <p className="text-sm">{data.listing.address || <span className="italic text-muted-foreground">Not set</span>}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80">
                    <MapPin className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <KField label="Property type" value={k.property_type} onChange={set("property_type")} editing={editing} placeholder="Detached cottage · Lakeside" />
          </div>
          <KField label="Key features" value={k.key_features} onChange={set("key_features")} editing={editing} placeholder="Hot tub · Dog friendly · Private jetty" />
          <KField label="General notes" value={k.general_notes} onChange={set("general_notes")} editing={editing} multiline placeholder="Any general context..." />
        </KSection>

        {/* Section 2: Access */}
        <KSection title="Access & Entry" description="Codes, key safes, and entry quirks">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KField label="Key safe location" value={k.key_safe_location} onChange={set("key_safe_location")} editing={editing} placeholder="Black key safe on left gate post" />
            <KField label="Key safe code" value={k.key_safe_code} onChange={set("key_safe_code")} editing={editing} sensitive />
            <KField label="Lock type" value={k.lock_type} onChange={set("lock_type")} editing={editing} placeholder="Yale deadlock + handle lock" />
            <KField label="Spare key location" value={k.spare_key_location} onChange={set("spare_key_location")} editing={editing} />
            <KField label="Gate code" value={k.gate_code} onChange={set("gate_code")} editing={editing} sensitive />
            <KField label="Alarm code" value={k.alarm_code} onChange={set("alarm_code")} editing={editing} sensitive />
          </div>
          <KField label="Access notes" value={k.access_notes} onChange={set("access_notes")} editing={editing} multiline placeholder="The front door sticks in wet weather..." />
        </KSection>

        {/* Section 3: Utilities */}
        <KSection title="Utilities" description="Boiler, stopcock, fuses">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KField label="Boiler make & model" value={k.boiler_make_model} onChange={set("boiler_make_model")} editing={editing} placeholder="Worcester Bosch Greenstar 30i" />
            <KField label="Boiler location" value={k.boiler_location} onChange={set("boiler_location")} editing={editing} />
            <KField label="Stopcock location" value={k.stopcock_location} onChange={set("stopcock_location")} editing={editing} />
            <KField label="Fuse box location" value={k.fusebox_location} onChange={set("fusebox_location")} editing={editing} />
            <KField label="Electric meter location" value={k.electric_meter_location} onChange={set("electric_meter_location")} editing={editing} />
            <KField label="Gas meter location" value={k.gas_meter_location} onChange={set("gas_meter_location")} editing={editing} />
          </div>
          <KField label="Boiler reset procedure" value={k.boiler_reset_procedure} onChange={set("boiler_reset_procedure")} editing={editing} multiline placeholder="1. Press and hold the reset button for 3 seconds. 2. Wait 60 seconds..." />
          <KField label="Water pressure notes" value={k.water_pressure_notes} onChange={set("water_pressure_notes")} editing={editing} multiline />
          <KField label="Utility notes" value={k.utility_notes} onChange={set("utility_notes")} editing={editing} multiline />
        </KSection>

        {/* Section 4: Heating */}
        <KSection title="Heating & Hot Water">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KField label="Heating system type" value={k.heating_system_type} onChange={set("heating_system_type")} editing={editing} placeholder="Oil-fired central heating" />
            <KField label="Thermostat location" value={k.thermostat_location} onChange={set("thermostat_location")} editing={editing} />
            <KField label="Hot water cylinder location" value={k.hot_water_cylinder_location} onChange={set("hot_water_cylinder_location")} editing={editing} />
            <KField label="Immersion heater details" value={k.immersion_heater_details} onChange={set("immersion_heater_details")} editing={editing} />
            <KField label="Oil tank location" value={k.oil_tank_location} onChange={set("oil_tank_location")} editing={editing} />
            <KField label="Oil supplier contact" value={k.oil_supplier_contact} onChange={set("oil_supplier_contact")} editing={editing} />
          </div>
          <KField label="Heating notes" value={k.heating_notes} onChange={set("heating_notes")} editing={editing} multiline placeholder="Takes 45 minutes to heat from cold..." />
        </KSection>

        {/* Section 5: Hot Tub */}
        <KSection
          title="Hot Tub"
          description={k.has_hot_tub ? "Chemicals, error codes, supplier" : "Not applicable"}
          rightSlot={
            editing && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={k.has_hot_tub}
                  onChange={(e) => set("has_hot_tub")(e.target.checked)}
                  className="rounded"
                />
                Has hot tub
              </label>
            )
          }
        >
          {k.has_hot_tub ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KField label="Make & model" value={k.hot_tub_make_model} onChange={set("hot_tub_make_model")} editing={editing} />
                <KField label="Target temperature (°C)" value={k.hot_tub_target_temp?.toString() ?? ""} onChange={(v) => set("hot_tub_target_temp")(v ? Number(v) : null)} editing={editing} type="number" />
                <KField label="Filter cleaning frequency" value={k.hot_tub_filter_frequency} onChange={set("hot_tub_filter_frequency")} editing={editing} />
                <KField label="Supplier / service contact" value={k.hot_tub_supplier_contact} onChange={set("hot_tub_supplier_contact")} editing={editing} />
              </div>
              <KField label="Chemical schedule" value={k.hot_tub_chemical_schedule} onChange={set("hot_tub_chemical_schedule")} editing={editing} multiline placeholder="Shock dose Monday, chlorine granules Wed and Fri" />
              <KField label="Hot tub notes (incl. error codes)" value={k.hot_tub_notes} onChange={set("hot_tub_notes")} editing={editing} multiline placeholder="E3 — Water temperature sensor fault — Check sensor connection..." />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No hot tub at this property.</p>
          )}
        </KSection>

        {/* Section 6: Appliances */}
        <KSection title="Appliances" description={`${data.appliances.length} recorded`}>
          <ChildList
            listingId={listingId!}
            table="property_appliances"
            items={data.appliances}
            renderItem={(a) => (
              <div>
                <p className="font-medium text-sm">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[a.location, a.model_number].filter(Boolean).join(" · ")}
                </p>
                {a.instructions && <p className="text-xs text-muted-foreground mt-1">{a.instructions}</p>}
              </div>
            )}
            emptyText="No appliances recorded yet."
            addLabel="Add appliance"
            fields={[
              { key: "name", label: "Name", required: true, placeholder: "Samsung washing machine" },
              { key: "location", label: "Location" },
              { key: "model_number", label: "Model number" },
              { key: "instructions", label: "Instructions", multiline: true },
              { key: "common_issues", label: "Common issues", multiline: true },
              { key: "manual_url", label: "Manual URL" },
            ]}
          />
        </KSection>

        {/* Section 7: WiFi */}
        <KSection title="WiFi" description="Internal record only — TouchStay holds the guest version">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KField label="Network name (SSID)" value={k.wifi_ssid} onChange={set("wifi_ssid")} editing={editing} />
            <KField label="Password" value={k.wifi_password} onChange={set("wifi_password")} editing={editing} sensitive />
            <KField label="Router location" value={k.router_location} onChange={set("router_location")} editing={editing} />
            <KField label="Backup network" value={k.backup_network} onChange={set("backup_network")} editing={editing} />
          </div>
          <KField label="Router reset procedure" value={k.router_reset_procedure} onChange={set("router_reset_procedure")} editing={editing} multiline />
          <KField label="WiFi notes" value={k.wifi_notes} onChange={set("wifi_notes")} editing={editing} multiline placeholder="Signal weak in back bedroom — extender on windowsill" />
        </KSection>

        {/* Section 8: Cleaning */}
        <KSection title="Cleaning Notes" description="Property-specific quirks — critical for cleaners">
          <KField label="Cleaning quirks" value={k.cleaning_quirks} onChange={set("cleaning_quirks")} editing={editing} multiline placeholder="The shower drain in the master en-suite blocks easily — always check after each clean" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KField label="Cleaning supplies location" value={k.cleaning_supplies_location} onChange={set("cleaning_supplies_location")} editing={editing} />
            <KField label="Cleaning duration (hours)" value={k.cleaning_duration_hours?.toString() ?? ""} onChange={(v) => set("cleaning_duration_hours")(v ? Number(v) : null)} editing={editing} type="number" placeholder="3.5" />
            <KField label="Linen storage location" value={k.linen_storage_location} onChange={set("linen_storage_location")} editing={editing} />
            <KField label="Bin location" value={k.bin_location} onChange={set("bin_location")} editing={editing} />
            <KField label="Bin collection day" value={k.bin_collection_day} onChange={set("bin_collection_day")} editing={editing} placeholder="Tuesday" />
            <KField label="Recycling notes" value={k.recycling_notes} onChange={set("recycling_notes")} editing={editing} />
          </div>
          <KField label="General cleaning notes" value={k.cleaning_notes} onChange={set("cleaning_notes")} editing={editing} multiline />
        </KSection>

        {/* Section 9: Maintenance Log */}
        <KSection title="Maintenance Log" description={`${data.maintenance.length} entries`}>
          <ChildList
            listingId={listingId!}
            table="property_maintenance_log"
            items={data.maintenance}
            renderItem={(m) => (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{m.issue_description}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{m.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {m.date}
                  {m.resolved_by && ` · ${m.resolved_by}`}
                  {m.cost != null && ` · £${m.cost}`}
                </p>
                {m.action_taken && <p className="text-xs text-muted-foreground mt-1">{m.action_taken}</p>}
              </div>
            )}
            emptyText="No maintenance history yet."
            addLabel="Add entry"
            fields={[
              { key: "date", label: "Date", type: "date", required: true, default: new Date().toISOString().slice(0, 10) },
              { key: "issue_description", label: "Issue", required: true, multiline: true },
              { key: "action_taken", label: "Action taken", multiline: true },
              { key: "resolved_by", label: "Resolved by" },
              { key: "cost", label: "Cost (£)", type: "number" },
              { key: "status", label: "Status", select: ["resolved", "ongoing", "monitoring"], default: "resolved" },
            ]}
          />
        </KSection>

        {/* Section 10: Known Issues */}
        <KSection title="Known Issues & Watchlist" description={`${data.issues.length} active`}>
          <ChildList
            listingId={listingId!}
            table="property_known_issues"
            items={data.issues}
            renderItem={(i) => (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{i.title}</p>
                  <Badge className={`text-[10px] capitalize ${priorityColor(i.priority)}`}>
                    {i.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{i.status}</Badge>
                </div>
                {i.description && <p className="text-xs text-muted-foreground mt-1">{i.description}</p>}
                {i.next_action && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Next: {i.next_action}{i.next_action_date && ` (${i.next_action_date})`}
                  </p>
                )}
              </div>
            )}
            emptyText="No known issues recorded."
            addLabel="Add issue"
            fields={[
              { key: "title", label: "Title", required: true },
              { key: "description", label: "Description", multiline: true },
              { key: "status", label: "Status", select: ["monitoring", "scheduled", "waiting", "resolved"], default: "monitoring" },
              { key: "priority", label: "Priority", select: ["low", "medium", "high", "urgent"], default: "low" },
              { key: "next_action", label: "Next action" },
              { key: "next_action_date", label: "Next action date", type: "date" },
            ]}
          />
        </KSection>

        {/* Section 11: Contacts */}
        <KSection title="Contacts" description={`${data.contacts.length} recorded`}>
          <ChildList
            listingId={listingId!}
            table="property_contacts"
            items={data.contacts}
            renderItem={(c) => (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.role && <Badge variant="outline" className="text-[10px]">{c.role}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                </div>
                {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
              </div>
            )}
            emptyText="No contacts yet."
            addLabel="Add contact"
            fields={[
              { key: "name", label: "Name", required: true },
              { key: "role", label: "Role", placeholder: "Plumber, Electrician..." },
              { key: "phone", label: "Phone" },
              { key: "email", label: "Email" },
              { key: "notes", label: "Notes", multiline: true },
            ]}
          />
        </KSection>

        {/* Section 11.5: Guest Guide (TouchStay imported) */}
        <KSection title="Guest Guide" description="Welcome message, local area, checkout, parking — text imported from TouchStay, fully editable">
          <KField label="Guest welcome / overview" value={k.guest_info} onChange={set("guest_info")} editing={editing} multiline placeholder="Welcome message guests see when they open the guide..." />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Local area notes</Label>
            {editing ? (
              <Textarea
                value={k.local_area || ""}
                onChange={(e) => set("local_area")(e.target.value)}
                placeholder="Restaurants, walks, things to do nearby..."
                rows={5}
              />
            ) : (
              <div className="min-h-[2rem]">
                {k.local_area ? (
                  <p className="text-sm whitespace-pre-wrap break-words">{k.local_area}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not set</p>
                )}
              </div>
            )}
            <Link
              to={`/property-knowledge/${listingId}#linked-amenities`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("linked-amenities")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Manage linked amenities <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <KField label="Checkout instructions" value={k.checkout_instructions} onChange={set("checkout_instructions")} editing={editing} multiline placeholder="Strip beds, leave keys in lockbox, lock back door..." />
          <KField label="Parking info" value={k.parking_info} onChange={set("parking_info")} editing={editing} multiline placeholder="Parking is on the street, free after 6pm and weekends..." />
          <KField label="Emergency contacts" value={k.emergency_contacts} onChange={set("emergency_contacts")} editing={editing} multiline placeholder="Out-of-hours: 999 / 112; Local emergency contact name + number..." />
          <KField label="Appliances info (guest version)" value={k.appliances_info} onChange={set("appliances_info")} editing={editing} multiline placeholder="Quick how-to for the dishwasher, oven, washing machine..." />
          <KField label="WiFi info (guest version)" value={k.wifi_info} onChange={set("wifi_info")} editing={editing} multiline placeholder="Network name, password, troubleshooting steps for guests..." />
          <KField label="Bins & recycling" value={k.bins_recycling} onChange={set("bins_recycling")} editing={editing} multiline placeholder="Black bin out Tues, blue bin alternate weeks..." />
        </KSection>

        {/* Section 11.6: Linked Amenities */}
        <div id="linked-amenities" />
        <KSection title="Linked Amenities" description="Nearby places linked to this property — used by Orin and the guest guide">
          <PropertyAmenitiesTab listingId={listingId!} />
        </KSection>

        {/* Section 12: Documents */}
        <KSection title="Documents & Links" description={`${data.documents.length} items`}>
          <ChildList
            listingId={listingId!}
            table="property_documents"
            items={data.documents}
            renderItem={(d) => (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-sm text-primary hover:underline inline-flex items-center gap-1">
                      {d.title} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="font-medium text-sm">{d.title}</p>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">{d.type}</Badge>
                  {d.expiry_date && (
                    <Badge variant="outline" className="text-[10px]">Expires {d.expiry_date}</Badge>
                  )}
                </div>
                {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
              </div>
            )}
            emptyText="No documents linked."
            addLabel="Add document/link"
            fields={[
              { key: "title", label: "Title", required: true },
              { key: "type", label: "Type", select: ["link", "document"], default: "link" },
              { key: "url", label: "URL" },
              { key: "expiry_date", label: "Expiry date", type: "date" },
              { key: "notes", label: "Notes", multiline: true },
            ]}
          />
        </KSection>
      </div>
    </AppLayout>
  );
}

function priorityColor(p: string) {
  switch (p) {
    case "urgent": return "bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/20";
    case "high": return "bg-primary/20 text-primary border-primary/30 hover:bg-primary/20";
    case "medium": return "bg-accent text-accent-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// Generic add/list/delete component for child tables
type FieldDef = {
  key: string;
  label: string;
  type?: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  select?: string[];
  default?: string;
};

function ChildList({
  listingId,
  table,
  items,
  renderItem,
  emptyText,
  addLabel,
  fields,
}: {
  listingId: string;
  table: any;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  emptyText: string;
  addLabel: string;
  fields: FieldDef[];
}) {
  const { insert, remove } = useChildMutation(listingId, table);
  const [adding, setAdding] = useState(false);
  const initial = Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""]));
  const [form, setForm] = useState<Record<string, any>>(initial);

  const handleSubmit = async () => {
    const payload: any = {};
    for (const f of fields) {
      const v = form[f.key];
      if (f.required && (!v || v === "")) {
        return;
      }
      if (v === "" || v == null) continue;
      payload[f.key] = f.type === "number" ? Number(v) : v;
    }
    await insert.mutateAsync(payload);
    setForm(initial);
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">{emptyText}</p>
      )}
      {items.map((item) => (
        <Card key={item.id} className="p-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">{renderItem(item)}</div>
          <button
            onClick={() => remove.mutate(item.id)}
            className="text-muted-foreground hover:text-destructive p-1"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Card>
      ))}

      {adding ? (
        <Card className="p-4 space-y-3 border-primary/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.multiline ? "md:col-span-2" : ""}>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.label}{f.required && " *"}
                </Label>
                {f.select ? (
                  <Select value={form[f.key] || f.default || ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.select.map((opt) => (
                        <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.multiline ? (
                  <Textarea
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    rows={3}
                  />
                ) : (
                  <Input
                    type={f.type || "text"}
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setForm(initial); }}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={insert.isPending}>Add</Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
        </Button>
      )}
    </div>
  );
}
