import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Prefs {
  notify_bookings: boolean;
  notify_orin: boolean;
  orin_frequency: "weekly" | "monthly" | "both";
}

export function OwnerSettingsDialog({ ownerId, open, onOpenChange }: { ownerId: string | null; open: boolean; onOpenChange: (o: boolean) => void; }) {
  const [prefs, setPrefs] = useState<Prefs>({ notify_bookings: false, notify_orin: false, orin_frequency: "weekly" });
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["owner_prefs", ownerId],
    enabled: !!ownerId && open,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("owner_notification_prefs")
        .select("notify_bookings, notify_orin, orin_frequency").eq("owner_id", ownerId).maybeSingle();
      return (data ?? null) as Prefs | null;
    },
  });
  useEffect(() => { if (data) setPrefs(data); }, [data]);

  const save = async () => {
    if (!ownerId) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("owner_notification_prefs")
      .upsert({ owner_id: ownerId, ...prefs }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) { toast.error("Could not save", { description: error.message }); return; }
    toast.success("Notification settings saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Notification settings</DialogTitle></DialogHeader>
        <div className="space-y-5 py-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm">Booking emails</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Email me when a new booking is confirmed or a booking is cancelled.</p>
            </div>
            <Switch checked={prefs.notify_bookings} onCheckedChange={(v) => setPrefs((p) => ({ ...p, notify_bookings: v }))} />
          </div>

          <div className="space-y-3 border-t border-border/30 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm">Orin updates</Label>
                <p className="text-xs text-muted-foreground mt-0.5">A performance digest of your portfolio from Orin, our revenue analyst.</p>
              </div>
              <Switch checked={prefs.notify_orin} onCheckedChange={(v) => setPrefs((p) => ({ ...p, notify_orin: v }))} />
            </div>
            {prefs.notify_orin && (
              <div className="space-y-1.5 pl-1">
                <Label className="text-xs text-muted-foreground">Frequency</Label>
                <Select value={prefs.orin_frequency} onValueChange={(v) => setPrefs((p) => ({ ...p, orin_frequency: v as Prefs["orin_frequency"] }))}>
                  <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (Mon 10am)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st, 11am)</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground border-t border-border/30 pt-3">
            Emails come from Escape Grids and never include exact £ revenue figures.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !ownerId}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
