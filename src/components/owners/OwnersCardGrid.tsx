import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface OwnersCardGridProps {
  onSelectOwner: (owner: { id: string; name: string; company: string | null }) => void;
}

export function OwnersCardGrid({ onSelectOwner }: OwnersCardGridProps) {
  const { data: owners, isLoading } = useQuery({
    queryKey: ["property_owners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("property_owners").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: listingCounts } = useQuery({
    queryKey: ["listing_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("owner_id, status");
      const counts: Record<string, number> = {};
      data?.forEach((l) => {
        if (l.status === "active") counts[l.owner_id] = (counts[l.owner_id] || 0) + 1;
      });
      return counts;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {owners?.map((owner) => {
        const count = listingCounts?.[owner.id] ?? 0;
        const initials = owner.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <button
            key={owner.id}
            onClick={() => onSelectOwner({ id: owner.id, name: owner.name, company: owner.company })}
            className="glass-card-hover p-5 text-left transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {owner.name}
                </h3>
                {owner.company && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{owner.company}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {count} {count === 1 ? "listing" : "listings"}
                  </Badge>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
