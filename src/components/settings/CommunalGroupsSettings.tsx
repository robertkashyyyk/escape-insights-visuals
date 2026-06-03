import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GroupRow {
  id: string;
  name: string;
  notes: string | null;
}
interface MemberRow {
  id: string;
  name: string;
  communal_group_id: string | null;
  communal_ratio_pct: number | null;
  is_communal: boolean;
  is_bundle: boolean;
}

/** Rounds to 3dp to compare against 100 without float noise. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function CommunalGroupsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  // Local edit buffer for member ratios, keyed by listing id.
  const [ratios, setRatios] = useState<Record<string, string>>({});
  const [addSel, setAddSel] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["communal_groups_admin"],
    queryFn: async () => {
      const [{ data: groups }, { data: listings }] = await Promise.all([
        (supabase.from as any)("communal_groups").select("id, name, notes").order("name"),
        supabase
          .from("listings")
          .select("id, name, communal_group_id, communal_ratio_pct, is_communal, is_bundle")
          .order("name"),
      ]);
      return {
        groups: (groups ?? []) as GroupRow[],
        listings: (listings ?? []) as MemberRow[],
      };
    },
  });

  const groups = data?.groups ?? [];
  const listings = data?.listings ?? [];

  // Seed the ratio edit buffer whenever fresh data arrives.
  useEffect(() => {
    if (!listings.length) return;
    setRatios((prev) => {
      const next = { ...prev };
      for (const l of listings) {
        if (l.communal_group_id && next[l.id] === undefined) {
          next[l.id] = l.communal_ratio_pct != null ? String(l.communal_ratio_pct) : "";
        }
      }
      return next;
    });
  }, [listings]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["communal_groups_admin"] });
    qc.invalidateQueries({ queryKey: ["communal_groups"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const membersOf = (groupId: string) => listings.filter((l) => l.communal_group_id === groupId);
  const unassigned = listings.filter((l) => !l.communal_group_id && !l.is_bundle);

  const groupTotal = (groupId: string) =>
    round3(
      membersOf(groupId).reduce((s, m) => s + (parseFloat(ratios[m.id] ?? "") || 0), 0),
    );

  const handleAddGroup = async () => {
    const value = newName.trim();
    if (!value) return;
    const { error } = await (supabase.from as any)("communal_groups").insert({ name: value });
    if (error) {
      toast({ title: "Could not add group", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    invalidate();
  };

  const handleRenameGroup = async (id: string) => {
    const value = editingName.trim();
    if (!value) return;
    const { error } = await (supabase.from as any)("communal_groups").update({ name: value }).eq("id", id);
    if (error) {
      toast({ title: "Could not rename", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    setEditingName("");
    invalidate();
  };

  const handleDeleteGroup = async (group: GroupRow) => {
    const members = membersOf(group.id);
    const msg =
      members.length > 0
        ? `Delete "${group.name}"? Its ${members.length} ${members.length === 1 ? "property" : "properties"} will be detached (communal share cleared).`
        : `Delete "${group.name}"?`;
    if (!window.confirm(msg)) return;
    // FK is ON DELETE SET NULL, so members detach automatically; clear their ratio too.
    if (members.length > 0) {
      await supabase
        .from("listings")
        .update({ communal_ratio_pct: null })
        .eq("communal_group_id", group.id);
    }
    const { error } = await (supabase.from as any)("communal_groups").delete().eq("id", group.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    invalidate();
  };

  const handleAddMember = async (groupId: string) => {
    const listingId = addSel[groupId];
    if (!listingId) return;
    const { error } = await supabase
      .from("listings")
      .update({ communal_group_id: groupId, is_communal: true })
      .eq("id", listingId);
    if (error) {
      toast({ title: "Could not add property", description: error.message, variant: "destructive" });
      return;
    }
    setAddSel((p) => ({ ...p, [groupId]: "" }));
    invalidate();
  };

  const handleRemoveMember = async (listingId: string) => {
    const { error } = await supabase
      .from("listings")
      .update({ communal_group_id: null, communal_ratio_pct: null })
      .eq("id", listingId);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    setRatios((p) => {
      const n = { ...p };
      delete n[listingId];
      return n;
    });
    invalidate();
  };

  // Hard-block: the group's ratios must sum to exactly 100% before saving.
  const handleSaveRatios = async (groupId: string) => {
    const members = membersOf(groupId);
    if (members.length === 0) return;
    const total = groupTotal(groupId);
    if (total !== 100) {
      toast({
        title: "Ratios must total exactly 100%",
        description: `This group currently totals ${total}%. Adjust the shares so there are no gaps or double-cover.`,
        variant: "destructive",
      });
      return;
    }
    const updates = members.map((m) =>
      supabase
        .from("listings")
        .update({ communal_ratio_pct: parseFloat(ratios[m.id] ?? "0") || 0, is_communal: true })
        .eq("id", m.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Save failed", description: failed.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Communal shares saved", description: "Group totals 100%." });
    invalidate();
  };

  const evenSplit = (groupId: string) => {
    const members = membersOf(groupId);
    if (!members.length) return;
    const share = round3(100 / members.length);
    const next: Record<string, string> = {};
    members.forEach((m, i) => {
      // Put any rounding remainder on the last member so the total lands on 100.
      next[m.id] =
        i === members.length - 1
          ? String(round3(100 - share * (members.length - 1)))
          : String(share);
    });
    setRatios((p) => ({ ...p, ...next }));
  };

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <Users className="h-4 w-4 text-primary" />
          Communal Groups
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Group properties that share communal costs. Each property's share (%) is its slice of any
          communal bill, consumable or maintenance cost. Shares within a group must total exactly 100%.
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          e.g. a £100 communal bill across 9 properties — eight at 10% and one at 20% — bills the eight
          £10 each and the ninth £20.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Add group */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Add Communal Group</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddGroup(); }}
              placeholder="e.g. Mill Courtyard"
              className="bg-secondary/50 border-border/40"
            />
          </div>
          <Button size="sm" onClick={handleAddGroup} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No communal groups yet.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const members = membersOf(group.id);
              const total = groupTotal(group.id);
              const valid = members.length === 0 || total === 100;
              return (
                <div key={group.id} className="rounded-lg border border-border/30 bg-secondary/20 overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
                    {editingId === group.id ? (
                      <>
                        <Input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameGroup(group.id); if (e.key === "Escape") setEditingId(null); }}
                          className="h-7 text-sm bg-secondary/50 border-border/40 flex-1"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRenameGroup(group.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-semibold text-foreground">{group.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {members.length} {members.length === 1 ? "property" : "properties"}
                        </span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(group.id); setEditingName(group.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGroup(group)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Members + ratios */}
                  <div className="p-3 space-y-2">
                    {members.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No properties assigned yet.</p>
                    ) : (
                      members.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-foreground truncate">{m.name}</span>
                          <div className="w-24 flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.001"
                              value={ratios[m.id] ?? ""}
                              onChange={(e) => setRatios((p) => ({ ...p, [m.id]: e.target.value }))}
                              className="h-8 text-xs text-right"
                              placeholder="0"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id)}
                            className="h-8 w-8 shrink-0 rounded-md border border-border/30 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                            title="Remove from group"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Total + actions */}
                    {members.length > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => evenSplit(group.id)}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Even split
                        </button>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium ${valid ? "text-emerald-400" : "text-destructive"}`}>
                            Total: {total}% {!valid && "(must be 100%)"}
                          </span>
                          <Button size="sm" className="h-7 text-xs" disabled={!valid} onClick={() => handleSaveRatios(group.id)}>
                            Save shares
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Add member */}
                    <div className="flex items-end gap-2 pt-2 border-t border-border/20">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Add property</Label>
                        <Select
                          value={addSel[group.id] ?? ""}
                          onValueChange={(v) => setAddSel((p) => ({ ...p, [group.id]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassigned.length === 0 ? (
                              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No unassigned properties</div>
                            ) : (
                              unassigned.map((l) => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!addSel[group.id]} onClick={() => handleAddMember(group.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
