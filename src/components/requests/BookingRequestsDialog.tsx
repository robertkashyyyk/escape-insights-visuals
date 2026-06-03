import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { RequestIcon } from "@/lib/requestIcon";

interface Props {
  reservationId: string | null;
  guestName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function BookingRequestsDialog({ reservationId, guestName, open, onOpenChange, onChanged }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [addId, setAddId] = useState("");

  const { data: catalogue = [] } = useQuery({
    queryKey: ["requests_catalogue"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("requests")
        .select("id, name, icon").eq("active", true).order("display_order");
      return (data ?? []) as { id: string; name: string; icon: string | null }[];
    },
  });

  const { data: items = [], refetch } = useQuery({
    queryKey: ["booking_requests", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("booking_requests")
        .select("id, quantity, request_id, requests(name, icon)")
        .eq("reservation_id", reservationId);
      return (data ?? []) as any[];
    },
  });

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["booking_requests_counts"] });
    onChanged?.();
  };

  const usedIds = new Set(items.map((i) => i.request_id));
  const available = catalogue.filter((c) => !usedIds.has(c.id));

  const addRequest = async () => {
    if (!reservationId || !addId) return;
    const { error } = await (supabase.from as any)("booking_requests")
      .insert({ reservation_id: reservationId, request_id: addId, quantity: 1, created_by: user?.id ?? null });
    if (error) { toast.error("Could not add request", { description: error.message }); return; }
    setAddId("");
    refresh();
  };

  const setQty = async (id: string, qty: number) => {
    if (qty < 1) return;
    const { error } = await (supabase.from as any)("booking_requests").update({ quantity: qty }).eq("id", id);
    if (error) { toast.error("Could not update", { description: error.message }); return; }
    refresh();
  };

  const removeItem = async (id: string) => {
    const { error } = await (supabase.from as any)("booking_requests").delete().eq("id", id);
    if (error) { toast.error("Could not remove", { description: error.message }); return; }
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Requests{guestName ? ` — ${guestName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests on this booking yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <RequestIcon icon={it.requests?.icon} className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{it.requests?.name ?? "Request"}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(it.id, it.quantity - 1)} disabled={it.quantity <= 1}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number" min={1} value={it.quantity}
                      onChange={(e) => setQty(it.id, parseInt(e.target.value) || 1)}
                      className="h-7 w-14 text-center text-sm"
                    />
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(it.id, it.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(it.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 pt-2 border-t border-border/20">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Add request</Label>
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select a request" /></SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {catalogue.length === 0 ? "No requests in catalogue — add some in Settings." : "All catalogue requests already added."}
                    </div>
                  ) : available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-9" onClick={addRequest} disabled={!addId}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
