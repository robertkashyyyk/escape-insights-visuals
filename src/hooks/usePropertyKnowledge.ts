import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Listing = {
  id: string;
  name: string;
  bedrooms: number | null;
  location_group: string | null;
  city: string | null;
};

export type PropertyKnowledge = {
  id: string;
  listing_id: string;
  property_type: string | null;
  key_features: string | null;
  general_notes: string | null;
  key_safe_location: string | null;
  key_safe_code: string | null;
  lock_type: string | null;
  spare_key_location: string | null;
  gate_code: string | null;
  alarm_code: string | null;
  access_notes: string | null;
  boiler_make_model: string | null;
  boiler_location: string | null;
  boiler_reset_procedure: string | null;
  stopcock_location: string | null;
  fusebox_location: string | null;
  electric_meter_location: string | null;
  gas_meter_location: string | null;
  water_pressure_notes: string | null;
  utility_notes: string | null;
  heating_system_type: string | null;
  thermostat_location: string | null;
  hot_water_cylinder_location: string | null;
  immersion_heater_details: string | null;
  oil_tank_location: string | null;
  oil_supplier_contact: string | null;
  heating_notes: string | null;
  has_hot_tub: boolean;
  hot_tub_make_model: string | null;
  hot_tub_chemical_schedule: string | null;
  hot_tub_target_temp: number | null;
  hot_tub_filter_frequency: string | null;
  hot_tub_supplier_contact: string | null;
  hot_tub_last_service: string | null;
  hot_tub_notes: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  router_location: string | null;
  router_reset_procedure: string | null;
  backup_network: string | null;
  wifi_notes: string | null;
  cleaning_quirks: string | null;
  cleaning_supplies_location: string | null;
  cleaning_duration_hours: number | null;
  linen_storage_location: string | null;
  bin_location: string | null;
  bin_collection_day: string | null;
  recycling_notes: string | null;
  cleaning_notes: string | null;
  completion_score: number;
  updated_at: string;
};

export type Appliance = {
  id: string;
  listing_id: string;
  name: string;
  location: string | null;
  model_number: string | null;
  instructions: string | null;
  common_issues: string | null;
  manual_url: string | null;
};

export type MaintenanceEntry = {
  id: string;
  listing_id: string;
  date: string;
  issue_description: string;
  action_taken: string | null;
  resolved_by: string | null;
  cost: number | null;
  status: "resolved" | "ongoing" | "monitoring";
};

export type KnownIssue = {
  id: string;
  listing_id: string;
  title: string;
  description: string | null;
  status: "monitoring" | "scheduled" | "waiting" | "resolved";
  priority: "low" | "medium" | "high" | "urgent";
  next_action: string | null;
  next_action_date: string | null;
};

export type Contact = {
  id: string;
  listing_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type Document = {
  id: string;
  listing_id: string;
  title: string;
  type: "document" | "link";
  url: string | null;
  expiry_date: string | null;
  notes: string | null;
};

// List all properties + their knowledge summary
export function usePropertyKnowledgeList() {
  return useQuery({
    queryKey: ["property-knowledge-list"],
    queryFn: async () => {
      const [listingsRes, knowledgeRes] = await Promise.all([
        supabase
          .from("listings")
          .select("id, name, bedrooms, location_group, city, status")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("property_knowledge")
          .select("listing_id, completion_score, updated_at"),
      ]);

      if (listingsRes.error) throw listingsRes.error;
      if (knowledgeRes.error) throw knowledgeRes.error;

      const knowledgeMap = new Map(
        (knowledgeRes.data || []).map((k) => [k.listing_id, k])
      );

      return (listingsRes.data || []).map((l) => ({
        ...l,
        completion_score: knowledgeMap.get(l.id)?.completion_score ?? 0,
        updated_at: knowledgeMap.get(l.id)?.updated_at ?? null,
      }));
    },
  });
}

// Single property knowledge — full record
export function usePropertyKnowledge(listingId: string | undefined) {
  return useQuery({
    queryKey: ["property-knowledge", listingId],
    enabled: !!listingId,
    queryFn: async () => {
      const [listingRes, kRes, applRes, maintRes, issuesRes, contactsRes, docsRes] =
        await Promise.all([
          supabase.from("listings").select("*").eq("id", listingId!).single(),
          supabase.from("property_knowledge").select("*").eq("listing_id", listingId!).maybeSingle(),
          supabase.from("property_appliances").select("*").eq("listing_id", listingId!).order("name"),
          supabase.from("property_maintenance_log").select("*").eq("listing_id", listingId!).order("date", { ascending: false }),
          supabase.from("property_known_issues").select("*").eq("listing_id", listingId!).order("priority"),
          supabase.from("property_contacts").select("*").eq("listing_id", listingId!).order("role"),
          supabase.from("property_documents").select("*").eq("listing_id", listingId!).order("title"),
        ]);

      if (listingRes.error) throw listingRes.error;

      // Auto-create knowledge if missing
      let knowledge = kRes.data as PropertyKnowledge | null;
      if (!knowledge) {
        const { data: created, error: createErr } = await supabase
          .from("property_knowledge")
          .insert({ listing_id: listingId! })
          .select()
          .single();
        if (createErr) throw createErr;
        knowledge = created as PropertyKnowledge;
      }

      return {
        listing: listingRes.data,
        knowledge: knowledge as PropertyKnowledge,
        appliances: (applRes.data || []) as Appliance[],
        maintenance: (maintRes.data || []) as MaintenanceEntry[],
        issues: (issuesRes.data || []) as KnownIssue[],
        contacts: (contactsRes.data || []) as Contact[],
        documents: (docsRes.data || []) as Document[],
      };
    },
  });
}

export function useUpdateKnowledge(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PropertyKnowledge>) => {
      const { error } = await supabase
        .from("property_knowledge")
        .update(patch)
        .eq("listing_id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["property-knowledge", listingId] });
      qc.invalidateQueries({ queryKey: ["property-knowledge-list"] });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });
}

// Generic CRUD for child tables
type ChildTable =
  | "property_appliances"
  | "property_maintenance_log"
  | "property_known_issues"
  | "property_contacts"
  | "property_documents";

export function useChildMutation(listingId: string, table: ChildTable) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["property-knowledge", listingId] });

  const insert = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from(table).insert({ ...row, listing_id: listingId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return { insert, update, remove };
}

// Global search across all properties + knowledge text
export function usePropertyKnowledgeSearch(query: string) {
  return useQuery({
    queryKey: ["property-knowledge-search", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const q = `%${query.trim()}%`;
      // Search across multiple text fields
      const fields = [
        "property_type", "key_features", "general_notes",
        "key_safe_location", "lock_type", "spare_key_location", "access_notes",
        "boiler_make_model", "boiler_location", "boiler_reset_procedure",
        "stopcock_location", "fusebox_location", "utility_notes",
        "heating_system_type", "thermostat_location", "heating_notes",
        "hot_tub_make_model", "hot_tub_chemical_schedule", "hot_tub_notes",
        "wifi_ssid", "router_location", "wifi_notes",
        "cleaning_quirks", "cleaning_supplies_location", "linen_storage_location",
        "bin_location", "bin_collection_day", "cleaning_notes",
      ];
      const orFilter = fields.map((f) => `${f}.ilike.${q}`).join(",");

      const [knowledgeRes, listingsRes, maintRes, issuesRes] = await Promise.all([
        supabase.from("property_knowledge").select("*").or(orFilter).limit(50),
        supabase.from("listings").select("id, name").ilike("name", q).eq("status", "active").limit(20),
        supabase.from("property_maintenance_log").select("*").ilike("issue_description", q).limit(20),
        supabase.from("property_known_issues").select("*").or(`title.ilike.${q},description.ilike.${q}`).limit(20),
      ]);

      // Build listings lookup for IDs we'll need
      const allListingIds = new Set<string>();
      (knowledgeRes.data || []).forEach((k: any) => allListingIds.add(k.listing_id));
      (maintRes.data || []).forEach((m: any) => allListingIds.add(m.listing_id));
      (issuesRes.data || []).forEach((i: any) => allListingIds.add(i.listing_id));
      (listingsRes.data || []).forEach((l: any) => allListingIds.add(l.id));

      const { data: listings } = await supabase
        .from("listings")
        .select("id, name")
        .in("id", Array.from(allListingIds));
      const nameMap = new Map((listings || []).map((l: any) => [l.id, l.name]));

      type Hit = {
        listingId: string;
        propertyName: string;
        section: string;
        snippet: string;
        anchor?: string;
      };
      const hits: Hit[] = [];
      const lowerQ = query.toLowerCase();

      const sectionForField: Record<string, string> = {
        property_type: "Overview", key_features: "Overview", general_notes: "Overview",
        key_safe_location: "Access", lock_type: "Access", spare_key_location: "Access", access_notes: "Access",
        boiler_make_model: "Utilities", boiler_location: "Utilities", boiler_reset_procedure: "Utilities",
        stopcock_location: "Utilities", fusebox_location: "Utilities", utility_notes: "Utilities",
        heating_system_type: "Heating", thermostat_location: "Heating", heating_notes: "Heating",
        hot_tub_make_model: "Hot Tub", hot_tub_chemical_schedule: "Hot Tub", hot_tub_notes: "Hot Tub",
        wifi_ssid: "WiFi", router_location: "WiFi", wifi_notes: "WiFi",
        cleaning_quirks: "Cleaning", cleaning_supplies_location: "Cleaning",
        linen_storage_location: "Cleaning", bin_location: "Cleaning",
        bin_collection_day: "Cleaning", cleaning_notes: "Cleaning",
      };

      (knowledgeRes.data || []).forEach((k: any) => {
        for (const f of fields) {
          const val = k[f];
          if (typeof val === "string" && val.toLowerCase().includes(lowerQ)) {
            hits.push({
              listingId: k.listing_id,
              propertyName: nameMap.get(k.listing_id) || "Unknown",
              section: sectionForField[f] || "General",
              snippet: val.length > 160 ? val.slice(0, 160) + "…" : val,
            });
          }
        }
      });

      (maintRes.data || []).forEach((m: any) => {
        hits.push({
          listingId: m.listing_id,
          propertyName: nameMap.get(m.listing_id) || "Unknown",
          section: "Maintenance Log",
          snippet: m.issue_description,
        });
      });

      (issuesRes.data || []).forEach((i: any) => {
        hits.push({
          listingId: i.listing_id,
          propertyName: nameMap.get(i.listing_id) || "Unknown",
          section: "Known Issues",
          snippet: i.title + (i.description ? " — " + i.description : ""),
        });
      });

      (listingsRes.data || []).forEach((l: any) => {
        hits.push({
          listingId: l.id,
          propertyName: l.name,
          section: "Property name",
          snippet: l.name,
        });
      });

      return hits.slice(0, 100);
    },
  });
}
