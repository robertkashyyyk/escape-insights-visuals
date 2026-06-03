import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StickyNote, MessageSquare } from "lucide-react";

interface Props {
  reservationId: string | null;
  guestName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shows the Hostaway host note, guest note (incl. Booking.com special requests) and
 *  any account-wide custom fields synced for a booking. */
export function BookingDetailDialog({ reservationId, guestName, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["booking_detail", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("reservations")
        .select("host_note, guest_note, custom_fields, platform, check_in")
        .eq("id", reservationId).single();
      return data;
    },
  });

  const customFields: { name?: string; value?: any }[] = Array.isArray(data?.custom_fields) ? data!.custom_fields : [];
  const hasAny = data && (data.host_note || data.guest_note || customFields.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Booking details{guestName ? ` — ${guestName}` : ""}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !hasAny ? (
          <p className="text-sm text-muted-foreground">
            No host note, guest note or custom fields synced for this booking yet.
            <span className="block text-xs mt-1">These populate from Hostaway on the next sync (requires the notes sync).</span>
          </p>
        ) : (
          <div className="space-y-4">
            {data.host_note && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><StickyNote className="h-3.5 w-3.5" /> Host Note (internal)</div>
                <p className="text-sm whitespace-pre-wrap rounded-md bg-secondary/30 border border-border/30 p-2">{data.host_note}</p>
              </div>
            )}
            {data.guest_note && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Guest Note / Special Requests</div>
                <p className="text-sm whitespace-pre-wrap rounded-md bg-secondary/30 border border-border/30 p-2">{data.guest_note}</p>
              </div>
            )}
            {customFields.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Custom Fields</div>
                <div className="rounded-md border border-border/30 divide-y divide-border/20">
                  {customFields.map((cf, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground min-w-32">{cf.name ?? "Field"}</span>
                      <span className="flex-1 break-words">{String(cf.value ?? "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
