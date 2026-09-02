import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Info } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AREAS, LEVELS, defaultLevel, type PermLevel, type AppRole } from "@/lib/permissions";

interface MUser { id: string; email: string; role: AppRole | null; display_name: string | null; }

const LEVEL_META: Record<PermLevel, { label: string; on: string }> = {
  none: { label: "None", on: "bg-muted text-foreground" },
  view: { label: "View", on: "bg-blue-500 text-white" },
  edit: { label: "Edit", on: "bg-amber-500 text-white" },
  manage: { label: "Manage", on: "bg-emerald-600 text-white" },
};

// Roles whose access is governed here (client/cleaner use their own portals).
const STAFF_ROLES: AppRole[] = ["super", "senior", "admin", "maintenance"];

export default function PermissionsMatrix() {
  const { toast } = useToast();
  const [users, setUsers] = useState<MUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, PermLevel>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "list" } });
      setLoading(false);
      if (error || data?.error) {
        toast({ title: "Failed to load users", description: error?.message || data?.error, variant: "destructive" });
        return;
      }
      const staff = (data.users ?? []).filter((u: MUser) => u.role && STAFF_ROLES.includes(u.role));
      setUsers(staff);
    })();
  }, [toast]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) { setOverrides({}); return; }
    (async () => {
      const { data } = await supabase
        .from("user_area_permissions" as any)
        .select("area_key, level")
        .eq("user_id", selectedId);
      const map: Record<string, PermLevel> = {};
      for (const r of (data as any[]) || []) map[r.area_key] = r.level;
      setOverrides(map);
    })();
  }, [selectedId]);

  const effective = (areaKey: string): PermLevel =>
    overrides[areaKey] ?? defaultLevel(selected?.role ?? null, areaKey);

  const sections = useMemo(() => {
    const order: string[] = [];
    const grouped: Record<string, typeof AREAS> = {};
    for (const a of AREAS) {
      if (!grouped[a.section]) { grouped[a.section] = []; order.push(a.section); }
      grouped[a.section].push(a);
    }
    return order.map((s) => ({ section: s, areas: grouped[s] }));
  }, []);

  const setLevel = async (areaKey: string, lvl: PermLevel) => {
    if (!selected) return;
    const def = defaultLevel(selected.role, areaKey);
    setSavingKey(areaKey);
    // Optimistic
    setOverrides((prev) => {
      const next = { ...prev };
      if (lvl === def) delete next[areaKey];
      else next[areaKey] = lvl;
      return next;
    });
    try {
      if (lvl === def) {
        await supabase.from("user_area_permissions" as any).delete()
          .eq("user_id", selected.id).eq("area_key", areaKey);
      } else {
        await supabase.from("user_area_permissions" as any)
          .upsert({ user_id: selected.id, area_key: areaKey, level: lvl } as any,
            { onConflict: "user_id,area_key" });
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Permissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Set each user's access per area. Levels shown match the user's role default until you change one;
            an <span className="font-medium">override</span> is marked with a dot.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>Phase 1: <b>None</b> hides an area and blocks the page. View / Edit / Manage all grant access for now — read-only “View” and elevated “Manage” are being enforced area-by-area next.</span>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <>
            <div className="max-w-xs">
              <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Choose a user…" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name || u.email} · {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selected ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Pick a user to view and edit their permissions.</p>
            ) : (
              <div className="space-y-6">
                {sections.map(({ section, areas }) => (
                  <div key={section}>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{section}</h2>
                    <div className="rounded-lg border border-border/50 divide-y divide-border/40">
                      {areas.map((a) => {
                        const eff = effective(a.key);
                        const isOverride = overrides[a.key] !== undefined;
                        return (
                          <div key={a.key} className="flex items-center gap-3 px-3 py-2">
                            <div className="flex-1 min-w-0 text-sm font-medium flex items-center gap-1.5">
                              {a.label}
                              {isOverride && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Overrides role default" />}
                            </div>
                            <div className="flex items-center gap-1">
                              {LEVELS.map((lvl) => {
                                const active = eff === lvl;
                                return (
                                  <button
                                    key={lvl}
                                    onClick={() => setLevel(a.key, lvl)}
                                    disabled={savingKey === a.key}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                      active ? LEVEL_META[lvl].on : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                    }`}
                                  >
                                    {LEVEL_META[lvl].label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
