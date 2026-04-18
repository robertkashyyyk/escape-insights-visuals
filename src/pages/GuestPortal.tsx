import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, MapPin } from "lucide-react";

interface ListingLite {
  id: string;
  name: string;
  image_url: string | null;
  location_group: string | null;
}

export default function GuestPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [listing, setListing] = useState<ListingLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, name, image_url, location_group")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setListing(data as ListingLite);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading your guide…
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-display font-bold text-foreground">Guide not found</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          We couldn't find a guest guide for that property. Please check the link or QR code provided by your host.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-widest text-primary font-medium mb-2">Welcome</p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">{listing.name}</h1>
            {listing.location_group && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {listing.location_group}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-12 space-y-8">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-display font-semibold">Your guest guide is coming soon</h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            We're putting the finishing touches on your personalised guide for <span className="text-foreground font-medium">{listing.name}</span>.
            <br className="hidden sm:block" />
            Check-in details, WiFi, the local area, and an AI concierge will appear here shortly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: "Check-in", body: "Codes, key safes, parking" },
            { title: "Inside", body: "WiFi, heating, appliances" },
            { title: "The Area", body: "Restaurants, shops, walks" },
          ].map(s => (
            <div key={s.title} className="rounded-xl border border-border/40 bg-card/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.title}</p>
              <p className="text-sm mt-1.5">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center pt-6 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Managed by <span className="text-foreground font-medium font-display">Escape Ordinary</span>
          </p>
        </div>
      </div>
    </div>
  );
}
