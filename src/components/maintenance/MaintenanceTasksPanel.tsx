import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Wrench, Sparkles, Building2, Users, Check, Clock, RotateCcw, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import {
  useMaintenanceTasks, MaintenanceTask, MaintenanceTaskType, MaintenanceTaskScope,
} from "@/hooks/useMaintenanceTasks";

interface PropertyOpt { id: string; name: string; }

const emptyForm = {
  title: "",
  description: "",
  type: "maintenance" as MaintenanceTaskType,
  scope: "property" as MaintenanceTaskScope,
  listing_id: "",
  communal_group_id: "",
};

export function MaintenanceTasksPanel({ properties }: { properties: PropertyOpt[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useMaintenanceTasks();

  const { data: communalGroups = [] } = useQuery({
    queryKey: ["communal_groups"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("communal_groups").select("id, name").order("name");
      return (data ?? []) as PropertyOpt[];
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Completion (billable) + are-you-sure flow
  const [completing, setCompleting] = useState<MaintenanceTask | null>(null);
  const [billable, setBillable] = useState<"yes" | "no">("no");
  const [cost, setCost] = useState("");

  // Postpone flow
  const [postponing, setPostponing] = useState<MaintenanceTask | null>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [postponeUntil, setPostponeUntil] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["maintenance_tasks"] });

  const handleAdd = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.scope === "property" && !form.listing_id) { toast.error("Select a property"); return; }
    if (form.scope === "communal" && !form.communal_group_id) { toast.error("Select a communal group"); return; }
    setSaving(true);
    const { error } = await (supabase.from as any)("maintenance_tasks").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      scope: form.scope,
      status: "pending",
      listing_id: form.scope === "property" ? form.listing_id : null,
      communal_group_id: form.scope === "communal" ? form.communal_group_id : null,
      source: "manual",
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error("Could not add task", { description: error.message }); return; }
    toast.success("Task added");
    setForm(emptyForm);
    setAddOpen(false);
    invalidate();
  };

  const handleAccept = async (task: MaintenanceTask) => {
    const { error } = await (supabase.from as any)("maintenance_tasks")
      .update({ status: "accepted", accepted_by: user?.id ?? null, accepted_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) { toast.error("Failed", { description: error.message }); return; }
    invalidate();
  };

  const openComplete = (task: MaintenanceTask) => {
    setCompleting(task);
    setBillable(task.billable ? "yes" : "no");
    setCost(task.cost != null ? String(task.cost) : "");
  };

  const handleComplete = async () => {
    if (!completing) return;
    const isBillable = billable === "yes";
    const { error } = await (supabase.from as any)("maintenance_tasks")
      .update({
        status: "done",
        billable: isBillable,
        cost: isBillable && cost ? parseFloat(cost) : null,
        completed_by: user?.id ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", completing.id);
    if (error) { toast.error("Failed to complete", { description: error.message }); return; }
    toast.success("Task completed", { description: isBillable ? "Marked billable — will appear on the owner report." : "Marked non-billable." });
    setCompleting(null);
    invalidate();
  };

  const handlePostpone = async () => {
    if (!postponing) return;
    const { error } = await (supabase.from as any)("maintenance_tasks")
      .update({
        status: "postponed",
        postpone_reason: postponeReason.trim() || null,
        postponed_until: postponeUntil || null,
      })
      .eq("id", postponing.id);
    if (error) { toast.error("Failed", { description: error.message }); return; }
    toast.success("Task postponed");
    setPostponing(null);
    setPostponeReason("");
    setPostponeUntil("");
    invalidate();
  };

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Proactive maintenance &amp; setup tasks — accept, complete (billable/non-billable) or postpone.
        </p>
        <Button size="sm" onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add task
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : active.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          No open tasks.
        </CardContent></Card>
      ) : (
        active.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onAccept={() => handleAccept(task)}
            onComplete={() => openComplete(task)}
            onPostpone={() => { setPostponing(task); setPostponeReason(task.postpone_reason ?? ""); setPostponeUntil(task.postponed_until ?? ""); }}
          />
        ))
      )}

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <Label className="text-xs text-muted-foreground">Completed ({done.length})</Label>
          {done.map((task) => <TaskCard key={task.id} task={task} done />)}
        </div>
      )}

      {/* Add task dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add maintenance task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Replace hot tub filter" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="setup">Setup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Scope</Label>
                <Select value={form.scope} onValueChange={(v) => set("scope", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">By property</SelectItem>
                    <SelectItem value="communal">Communal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.scope === "property" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Property *</Label>
                <Select value={form.listing_id} onValueChange={(v) => set("listing_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Communal Group *</Label>
                <Select value={form.communal_group_id} onValueChange={(v) => set("communal_group_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select communal group" /></SelectTrigger>
                  <SelectContent>
                    {communalGroups.length === 0 ? (
                      <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No communal groups — create one in Settings.</div>
                    ) : communalGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding…" : "Add task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete: billable choice + are-you-sure */}
      <AlertDialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark <span className="font-medium text-foreground">{completing?.title}</span> as done. Choose whether it's billable to the owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <RadioGroup value={billable} onValueChange={(v) => setBillable(v as "yes" | "no")} className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="yes" id="billable-yes" /> Billable (appears on owner report)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="no" id="billable-no" /> Non-billable
              </label>
            </RadioGroup>
            {billable === "yes" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cost (£)</Label>
                <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
                {completing?.scope === "communal" && (
                  <p className="text-[10px] text-muted-foreground">
                    Communal task — this cost is split across the group by each property's Communal Share %.
                  </p>
                )}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>Yes, complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Postpone */}
      <Dialog open={!!postponing} onOpenChange={(o) => !o && setPostponing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Postpone task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} rows={2} placeholder="e.g. Waiting on parts" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Postpone until (optional)</Label>
              <Input type="date" value={postponeUntil} onChange={(e) => setPostponeUntil(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPostponing(null)}>Cancel</Button>
            <Button onClick={handlePostpone}>Postpone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({
  task, done, onAccept, onComplete, onPostpone,
}: {
  task: MaintenanceTask;
  done?: boolean;
  onAccept?: () => void;
  onComplete?: () => void;
  onPostpone?: () => void;
}) {
  const scopeLabel = task.scope === "communal"
    ? (task.communal_group_name ?? "Communal group")
    : (task.listing_name ?? "Property");
  return (
    <Card className={done ? "border-border/60 opacity-80" : "border-border/60"}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{task.title}</h3>
            <Badge variant="outline" className="gap-1">
              {task.type === "setup" ? <Sparkles className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
              {task.type === "setup" ? "Setup" : "Maintenance"}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              {task.scope === "communal" ? <Users className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {scopeLabel}
            </Badge>
            {task.source === "welcome_basket" && <Badge variant="outline">Welcome basket</Badge>}
            <StatusBadge task={task} />
          </div>
        </div>
        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
        {task.status === "postponed" && (task.postpone_reason || task.postponed_until) && (
          <p className="text-xs text-muted-foreground">
            Postponed{task.postponed_until ? ` until ${format(new Date(task.postponed_until), "dd MMM yyyy")}` : ""}
            {task.postpone_reason ? ` — ${task.postpone_reason}` : ""}
          </p>
        )}
        {done && (
          <p className="text-xs text-muted-foreground">
            {task.billable ? `Billable${task.cost != null ? ` · £${task.cost}` : ""}` : "Non-billable"}
            {task.completed_at ? ` · ${format(new Date(task.completed_at), "dd MMM yyyy HH:mm")}` : ""}
          </p>
        )}
        {!done && (
          <div className="flex items-center gap-2 pt-1">
            {(task.status === "pending" || task.status === "postponed") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAccept}>
                {task.status === "postponed" ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                {task.status === "postponed" ? "Resume" : "Accept"}
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={onComplete}>
              <CheckCircle2 className="h-3 w-3" /> Done
            </Button>
            {task.status !== "postponed" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onPostpone}>
                <Clock className="h-3 w-3" /> Postpone
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ task }: { task: MaintenanceTask }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground border-border",
    accepted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    postponed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    done: "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return <Badge variant="outline" className={map[task.status] ?? ""}>{task.status.toUpperCase()}</Badge>;
}
