import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  BedDouble, Bath, MapPin, Clock, KeyRound, Flame, Wifi, Sparkles,
  Hammer, ExternalLink, StickyNote, Users, Hash,
} from "lucide-react";

interface Props {
  listingId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function PropertyInfoDrawer({ listingId, onOpenChange }: Props) {
  const open = !!listingId;

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["matrix-property-info", listingId],
    queryFn: async () => {
      const [{ data: listing }, { data: knowledge }] = await Promise.all([
        supabase
          .from("listings")
          .select("id, name, address, city, postcode, location_group, bedrooms, bathrooms, max_guests, default_check_in_time, default_check_out_time, min_stay_nights, cleaning_duration_minutes, has_hot_tub, pet_friendly, self_check_in, operational_notes, troubleshooting_notes, access_details")
          .eq("id", listingId!)
          .maybeSingle(),
        supabase
          .from("property_knowledge" as any)
          .select("key_safe_location, key_safe_code, lock_type, wifi_ssid, wifi_password, boiler_location, stopcock_location, fusebox_location, heating_system_type, cleaning_quirks, bin_collection_day, completion_score")
          .eq("listing_id", listingId!)
          .maybeSingle(),
      ]);
      return { listing, knowledge: knowledge as any };
    },
  });

  const listing = data?.listing as any;
  const k = data?.knowledge;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {isLoading || !listing ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="font-display text-lg leading-tight pr-6">
                {listing.name}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3 w-3" />
                {[listing.address, listing.city, listing.postcode].filter(Boolean).join(", ") || "No address on file"}
              </SheetDescription>
              {listing.location_group && (
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {listing.location_group}
                  </Badge>
                </div>
              )}
            </SheetHeader>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Stat icon={<BedDouble className="h-3.5 w-3.5" />} label="Bedrooms" value={listing.bedrooms ?? "—"} />
              <Stat icon={<Bath className="h-3.5 w-3.5" />} label="Bathrooms" value={listing.bathrooms ?? "—"} />
              <Stat icon={<Users className="h-3.5 w-3.5" />} label="Max guests" value={listing.max_guests ?? "—"} />
              <Stat icon={<Hash className="h-3.5 w-3.5" />} label="Min stay" value={`${listing.min_stay_nights ?? 2}n`} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Check-in" value={fmt(listing.default_check_in_time)} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Check-out" value={fmt(listing.default_check_out_time)} />
              <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Clean duration" value={`${listing.cleaning_duration_minutes ?? 90}m`} />
              <Stat
                icon={<Flame className="h-3.5 w-3.5" />}
                label="Features"
                value={
                  [listing.has_hot_tub && "Hot tub", listing.pet_friendly && "Pets", listing.self_check_in && "Self check-in"]
                    .filter(Boolean).join(" · ") || "—"
                }
              />
            </div>

            {/* Access */}
            <Section title="Access" icon={<KeyRound className="h-3.5 w-3.5" />}>
              <Field label="Key safe" value={[k?.key_safe_location, k?.key_safe_code].filter(Boolean).join(" · ")} />
              <Field label="Lock type" value={k?.lock_type} />
              <Field label="Access notes" value={listing.access_details} multiline />
            </Section>

            {/* Utilities */}
            <Section title="Utilities & systems" icon={<Hammer className="h-3.5 w-3.5" />}>
              <Field label="Boiler" value={k?.boiler_location} />
              <Field label="Stopcock" value={k?.stopcock_location} />
              <Field label="Fusebox" value={k?.fusebox_location} />
              <Field label="Heating" value={k?.heating_system_type} />
            </Section>

            {/* WiFi */}
            {(k?.wifi_ssid || k?.wifi_password) && (
              <Section title="Wi-Fi" icon={<Wifi className="h-3.5 w-3.5" />}>
                <Field label="Network" value={k?.wifi_ssid} />
                <Field label="Password" value={k?.wifi_password} mono />
              </Section>
            )}

            {/* Cleaning */}
            <Section title="Cleaning" icon={<Sparkles className="h-3.5 w-3.5" />}>
              <Field label="Quirks" value={k?.cleaning_quirks} multiline />
              <Field label="Bins" value={k?.bin_collection_day} />
            </Section>

            {/* Notes */}
            {(listing.operational_notes || listing.troubleshooting_notes) && (
              <Section title="Operational notes" icon={<StickyNote className="h-3.5 w-3.5" />}>
                <Field label="Operational" value={listing.operational_notes} multiline />
                <Field label="Troubleshooting" value={listing.troubleshooting_notes} multiline />
              </Section>
            )}

            <div className="mt-6 flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/property-knowledge/${listing.id}`}>
                  Full knowledge <ExternalLink className="h-3 w-3 ml-1.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/properties/${listing.id}`}>
                  Property page <ExternalLink className="h-3 w-3 ml-1.5" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function fmt(t: string | null | undefined) {
  if (!t) return "—";
  return t.slice(0, 5);
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/20 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, multiline, mono }: { label: string; value?: string | null; multiline?: boolean; mono?: boolean }) {
  if (!value) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/40">—</span>
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="text-xs">
        <div className="text-muted-foreground mb-0.5">{label}</div>
        <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{value}</div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-foreground/90 text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
