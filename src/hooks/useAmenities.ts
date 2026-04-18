import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildDirectionsUrl, type AmenityCategory } from "@/lib/amenityCategories";

export interface Amenity {
  id: string;
  name: string;
  category: AmenityCategory;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  google_place_id: string | null;
  opening_hours: string | null;
  notes: string | null;
  price_range: string | null;
  rating: number | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyAmenityRow {
  id: string;
  listing_id: string;
  amenity_id: string;
  distance_km: number | null;
  drive_time_mins: number | null;
  walk_time_mins: number | null;
  directions_url: string | null;
  is_featured: boolean;
  display_order: number;
  staff_note: string | null;
  // joined from view
  name: string;
  category: AmenityCategory;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  rating: number | null;
  price_range: string | null;
  is_active: boolean;
}

export function useAmenitiesList(filters?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: ["amenities", filters],
    queryFn: async () => {
      let q = supabase.from("amenities").select("*").order("name");
      if (filters?.category && filters.category !== "all") q = q.eq("category", filters.category as any);
      if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Amenity[];
    },
  });
}

export function useUpsertAmenity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Amenity> & { name: string; category: AmenityCategory }) => {
      const payload: any = { ...a };
      if (a.id) {
        const { error } = await supabase.from("amenities").update(payload).eq("id", a.id);
        if (error) throw error;
        return a.id;
      }
      const { data, error } = await supabase.from("amenities").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amenities"] });
      toast({ title: "Saved", description: "Amenity saved." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteAmenity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amenities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amenities"] });
      toast({ title: "Deleted", description: "Amenity removed." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function usePropertyAmenities(listingId?: string) {
  return useQuery({
    queryKey: ["property_amenities", listingId],
    enabled: !!listingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_property_amenities" as any)
        .select("*")
        .eq("listing_id", listingId!)
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true })
        .order("distance_km", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PropertyAmenityRow[];
    },
  });
}

export function useLinkAmenity(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      amenity_id: string;
      distance_km?: number | null;
      drive_time_mins?: number | null;
      walk_time_mins?: number | null;
      is_featured?: boolean;
      display_order?: number;
      staff_note?: string | null;
    }) => {
      // Look up the amenity for lat/lng to build the directions_url
      const { data: amenity, error: aErr } = await supabase
        .from("amenities")
        .select("latitude, longitude, name, postcode")
        .eq("id", input.amenity_id)
        .single();
      if (aErr) throw aErr;
      const directions_url = buildDirectionsUrl(amenity as any);

      const payload: any = {
        listing_id: listingId,
        amenity_id: input.amenity_id,
        distance_km: input.distance_km ?? null,
        drive_time_mins: input.drive_time_mins ?? null,
        walk_time_mins: input.walk_time_mins ?? null,
        is_featured: input.is_featured ?? false,
        display_order: input.display_order ?? 0,
        staff_note: input.staff_note ?? null,
        directions_url,
      };

      if (input.id) {
        const { error } = await supabase.from("property_amenities").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("property_amenities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property_amenities", listingId] });
      toast({ title: "Saved", description: "Amenity linked to property." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useUnlinkAmenity(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_amenities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property_amenities", listingId] });
      toast({ title: "Unlinked", description: "Amenity removed from this property." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}
