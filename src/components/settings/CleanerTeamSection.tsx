import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Users } from "lucide-react";

interface Member { id: string; name: string; sort_order: number; }

/** Team cleaners share one login; several named people work under it. When they
 *  open the app they pick who they are, and each action is stamped with that name. */
export function CleanerTeamSection({ cleanerId, cleanerName }: { cleanerId: string; cleanerName: string }) {
  const { toast } = useToast();
  const [isTeam, setIsTeam] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [clRes, mRes] = await Promise.all([
      (supabase.from("cleaners" as any) as any).select("is_team").eq("id", cleanerId).single(),
      (supabase.from("cleaner_members" as any) as any).select("id, name, sort_order").eq("cleaner_id", cleanerId).order("sort_order"),
    ]);
    setIsTeam(!!(clRes.data as any)?.is_team);
    setMembers(((mRes.data || []) as Member[]));
    setLoading(false);
  };
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [cleanerId]);

  const toggleTeam = async (v: boolean) => {
    setIsTeam(v);
    const { error } = await (supabase.from("cleaners" as any) as any).update({ is_team: v }).eq("id", cleanerId);
    if (error) { setIsTeam(!v); toast({ title: "Could not update", description: error.message, variant: "destructive" }); }
  };

  const addMember = async () => {
    const name = newName.trim();
    if (!name) return;
    const sort_order = members.length ? Math.max(...members.map((m) => m.sort_order)) + 1 : 0;
    const { error } = await (supabase.from("cleaner_members" as any) as any).insert({ cleaner_id: cleanerId, name, sort_order });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); fetchAll();
  };
  const rename = async (id: string, name: string) => {
    if (!name.trim()) return;
    await (supabase.from("cleaner_members" as any) as any).update({ name: name.trim() }).eq("id", id);
    fetchAll();
  };
  const remove = async (id: string) => {
    await (supabase.from("cleaner_members" as any) as any).delete().eq("id", id);
    fetchAll();
  };

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Team (shared login)</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">On = several people share this one login and pick who they are when they open the app. Off = a single cleaner.</p>
        </div>
        <Switch checked={isTeam} onCheckedChange={toggleTeam} disabled={loading} />
      </div>

      {isTeam && (
        <div className="space-y-2 pt-1">
          <Label className="text-[11px] text-muted-foreground">Team members — these are the names they'll pick from</Label>
          {members.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No members yet — add each person below.</p>
          ) : (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Input defaultValue={m.name} onBlur={(e) => e.target.value !== m.name && rename(m.id, e.target.value)}
                    className="h-8 text-xs flex-1 bg-secondary/50 border-border/40" />
                  <button onClick={() => remove(m.id)} className="h-8 w-8 shrink-0 rounded-md border border-border/30 flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMember(); }}
              placeholder="Add a member (e.g. Sarah)…" className="h-8 text-xs bg-secondary/50 border-border/40" />
            <Button size="sm" onClick={addMember} className="gap-1.5 shrink-0"><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
