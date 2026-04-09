import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Bed, Bath, Users, MapPin, PoundSterling, Brush, Building2, Wrench, Key, ClipboardList } from "lucide-react";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();

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

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <Link to="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </Link>

        {/* Header */}
        <div className="glass-card rounded-xl border border-border/30 border-l-2 border-l-primary/60 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{listing.name}</h1>
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

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border/20">
            {listing.bedrooms != null && <InfoChip icon={Bed} label={`${listing.bedrooms} bedrooms`} />}
            {listing.bathrooms != null && <InfoChip icon={Bath} label={`${listing.bathrooms} bathrooms`} />}
            {listing.max_guests != null && <InfoChip icon={Users} label={`${listing.max_guests} guests max`} />}
            {listing.city && <InfoChip icon={MapPin} label={listing.city} />}
            {listing.property_type && <InfoChip icon={Building2} label={listing.property_type} />}
            {cleaner && <InfoChip icon={Brush} label={cleaner} />}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailCard title="Location" icon={MapPin}>
            <DetailRow label="Address" value={listing.address} />
            <DetailRow label="City" value={listing.city} />
            <DetailRow label="Postcode" value={listing.postcode} />
            <DetailRow label="Country" value={listing.country} />
            <DetailRow label="Location Group" value={listing.location_group} />
          </DetailCard>

          <DetailCard title="Pricing" icon={DollarSign}>
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
        </div>

        {/* Operational sections */}
        <div className="space-y-4">
          <OperationalSection
            title="Access Details"
            icon={Key}
            content={accessDetails}
            placeholder="No access details recorded. Add key safe codes, entry instructions, parking info, etc."
          />
          <OperationalSection
            title="Operational Info"
            icon={ClipboardList}
            content={operationalNotes}
            placeholder="No operational notes. Add bed sizes, boiler location, stopcock location, Wi-Fi details, etc."
          />
          <OperationalSection
            title="Troubleshooting"
            icon={Wrench}
            content={troubleshootingNotes}
            placeholder="No troubleshooting notes. Add common issues and resolutions for this property."
          />
        </div>

        {/* Listing ID footer */}
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
