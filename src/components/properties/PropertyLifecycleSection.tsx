import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PauseCircle, Archive, RotateCcw, Loader2 } from "lucide-react";

/** Suspend (reversible — pulls a property out of operations, keeps it in
 *  management) and Archive (hide everywhere, keep history, recoverable). */
export function PropertyLifecycleSection({
  listingId, suspended, archived, onChanged,
}: { listingId: string; suspended: boolean; archived: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const patch = async (p: Record<string, any>, msg: string) => {
    setBusy(true);
    const { error } = await (supabase.from("listings") as any).update(p).eq("id", listingId);
    setBusy(false);
    if (error) { toast({ title: "Could not update", description: error.message, variant: "destructive" }); return; }
    toast({ title: msg });
    onChanged();
  };

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <Label className="text-xs font-semibold">Property status</Label>

      {archived ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">This property is <b>archived</b> — hidden across the app. Its history (reservations, cleans, revenue) is kept.</p>
          <Button type="button" size="sm" variant="outline" disabled={busy} className="gap-1.5"
            onClick={() => patch({ is_archived: false, archived_at: null }, "Property restored")}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore from archive
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium flex items-center gap-1.5"><PauseCircle className="h-3.5 w-3.5" /> Suspend</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Out of cleaning &amp; cleaner views, still visible in management. For e.g. a winter student let.</p>
            </div>
            <Switch checked={suspended} disabled={busy} onCheckedChange={(v) => patch({ is_suspended: v }, v ? "Property suspended" : "Property resumed")} />
          </div>

          <div className="pt-2 border-t border-border/20">
            {!confirmArchive ? (
              <button type="button" onClick={() => setConfirmArchive(true)}
                className="text-xs font-medium text-destructive inline-flex items-center gap-1.5 hover:opacity-80">
                <Archive className="h-3.5 w-3.5" /> Archive this property…
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1">Hide it everywhere (history kept, recoverable). Sure?</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmArchive(false)}>Cancel</Button>
                <Button type="button" size="sm" variant="destructive" disabled={busy} className="gap-1.5"
                  onClick={() => { setConfirmArchive(false); patch({ is_archived: true, archived_at: new Date().toISOString(), is_suspended: false }, "Property archived"); }}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
