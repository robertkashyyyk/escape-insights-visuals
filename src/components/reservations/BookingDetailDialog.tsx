import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StickyNote, MessageSquare, ConciergeBell, KeyRound, ExternalLink } from "lucide-react";
import { parseCustomFields } from "@/lib/customFields";

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
  const { requests, access } = parseCustomFields(customFields);
  const hasAny = data && (data.host_note || data.guest_note || requests.length > 0 || access.length > 0);

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
            {requests.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ConciergeBell className="h-3.5 w-3.5" /> Guest Requests</div>
                <div className="flex flex-wrap gap-1.5">
                  {requests.map((r, i) => (
                    <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {r.label}{/^\d+$/.test(r.value) && Number(r.value) > 1 ? ` ×${r.value}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {access.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> Access &amp; Info</div>
                <div className="rounded-md border border-border/30 divide-y divide-border/20">
                  {access.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground min-w-32 shrink-0">{a.name}</span>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 break-all text-primary hover:underline inline-flex items-center gap-1">
                          {a.value} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="flex-1 break-words whitespace-pre-wrap">{a.value}</span>
                      )}
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
