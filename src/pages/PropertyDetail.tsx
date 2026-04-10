import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bed, Bath, Users, MapPin, PoundSterling, Brush, Building2, Wrench, Key, ClipboardList, Clock, SprayCan } from "lucide-react";

const DURATION_OPTIONS = [60, 90, 120, 150, 180];

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customDuration, setCustomDuration] = useState<string>("");

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, property_owners(name, email, phone, company, management_rate_pct)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!listing) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Property not found.</div>
      </AppLayout>
    );
  }

  const owner = listing.property_owners as any;
  const cleaner = (listing as any).primary_cleaner;
  const operationalNotes = (listing as any).operational_notes;
  const troubleshootingNotes = (listing as any).troubleshooting_notes;
  const accessDetails = (listing as any).access_details;
  const isClean = (listing as any).is_clean ?? true;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link to="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </Link>

        <div className="glass-card rounded-xl border border-border/30 border-l-2 border-l-primary/60 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-foreground">{listing.name}</h1>
                {isClean ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    <SprayCan className="h-3 w-3 mr-1" /> Clean
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                    <SprayCan className="h-3 w-3 mr-1" /> Needs Cleaning
                  </Badge>
                )}
              </div>
              {owner?.name && <p className="text-sm text-muted-foreground mt-1">Owned by {owner.name}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {listing.location_group && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary">
                    {listing.location_group}
                  </Badge>
                )}
                <Badge variant={listing.status === "active" ? "default" : "secondary"} className="capitalize text-[10px]">
                  {listing.status}
                </Badge>
              </div>
            </div>
            {listing.nightly_rate != null && (
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-foreground">£{Number(listing.nightly_rate).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">per night</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border/20">
            {listing.bedrooms != null && <InfoChip icon={Bed} label={`${listing.bedrooms} bedrooms`} />}
            {listing.bathrooms != null && <InfoChip icon={Bath} label={`${listing.bathrooms} bathrooms`} />}
            {listing.max_guests != null && <InfoChip icon={Users} label={`${listing.max_guests} guests max`} />}
            {listing.city && <InfoChip icon={MapPin} label={listing.city} />}
            {listing.property_type && <InfoChip icon={Building2} label={listing.property_type} />}
            {cleaner && <InfoChip icon={Brush} label={cleaner} />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailCard title="Location" icon={MapPin}>
            <DetailRow label="Address" value={listing.address} />
            <DetailRow label="City" value={listing.city} />
            <DetailRow label="Postcode" value={listing.postcode} />
            <DetailRow label="Country" value={listing.country} />
            <DetailRow label="Location Group" value={listing.location_group} />
          </DetailCard>

          <DetailCard title="Pricing" icon={PoundSterling}>
            <DetailRow label="Nightly Rate" value={listing.nightly_rate != null ? `£${Number(listing.nightly_rate).toFixed(0)}` : null} />
            <DetailRow label="Base Rate" value={listing.base_rate != null ? `£${Number(listing.base_rate).toFixed(0)}` : null} />
            <DetailRow label="Min Rate" value={listing.min_rate != null ? `£${Number(listing.min_rate).toFixed(0)}` : null} />
          </DetailCard>

          <DetailCard title="Owner" icon={Users}>
            <DetailRow label="Name" value={owner?.name} />
            <DetailRow label="Company" value={owner?.company} />
            <DetailRow label="Email" value={owner?.email} />
            <DetailRow label="Phone" value={owner?.phone} />
            <DetailRow label="Mgmt Rate" value={owner?.management_rate_pct != null ? `${owner.management_rate_pct}%` : null} />
          </DetailCard>

          <DetailCard title="Integration" icon={Wrench}>
            <DetailRow label="Hostaway ID" value={listing.hostaway_listing_id?.toString()} />
            <DetailRow label="Listing ID" value={listing.id} mono />
            <DetailRow label="Tags" value={listing.tags} />
          </DetailCard>

          <DetailCard title="Settings" icon={Clock}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cleaning Duration</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={
                      DURATION_OPTIONS.includes((listing as any).cleaning_duration_minutes)
                        ? String((listing as any).cleaning_duration_minutes)
                        : "custom"
                    }
                    onValueChange={async (v) => {
                      if (v === "custom") return;
                      const mins = parseInt(v);
                      await (supabase.from("listings") as any).update({ cleaning_duration_minutes: mins }).eq("id", listing.id);
                      queryClient.invalidateQueries({ queryKey: ["listing", id] });
                      toast({ title: `Cleaning duration set to ${mins} min` });
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs bg-secondary/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(m => (
                        <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {!DURATION_OPTIONS.includes((listing as any).cleaning_duration_minutes) && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={15} max={480}
                        className="w-20 h-8 text-xs bg-secondary/50 border-border/40"
                        defaultValue={(listing as any).cleaning_duration_minutes ?? 90}
                        onBlur={async (e) => {
                          const mins = parseInt(e.target.value) || 90;
                          await (supabase.from("listings") as any).update({ cleaning_duration_minutes: mins }).eq("id", listing.id);
                          queryClient.invalidateQueries({ queryKey: ["listing", id] });
                          toast({ title: `Cleaning duration set to ${mins} min` });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DetailCard>
        </div>

        <div className="space-y-4">
          <OperationalSection
            title="Access Details"
            icon={Key}
            content={accessDetails}
            placeholder="No access details recorded."
          />
          <OperationalSection
            title="Operational Info"
            icon={ClipboardList}
            content={operationalNotes}
            placeholder="No operational notes."
          />
          <OperationalSection
            title="Troubleshooting"
            icon={Wrench}
            content={troubleshootingNotes}
            placeholder="No troubleshooting notes."
          />
        </div>

        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-4">
          {listing.id}
        </p>
      </div>
    </AppLayout>
  );
}

function InfoChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-md">
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function DetailCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl border border-border/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/15 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-foreground font-medium ${mono ? "font-mono text-[10px]" : ""} ${!value ? "text-muted-foreground/40" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function OperationalSection({ title, icon: Icon, content, placeholder }: { title: string; icon: any; content: string | null; placeholder: string }) {
  return (
    <div className="glass-card rounded-xl border border-border/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">{title}</h2>
      </div>
      <p className={`text-sm leading-relaxed ${content ? "text-foreground/80" : "text-muted-foreground/40 italic"}`}>
        {content || placeholder}
      </p>
    </div>
  );
}
