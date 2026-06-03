import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDistanceToNow, format } from "date-fns";
import { Wrench, AlertTriangle, CheckCircle2, ArrowRightLeft, Clock, Package, Play } from "lucide-react";
import { useMaintenanceQueue, MaintenanceIssue, MaintenanceStage } from "@/hooks/useMaintenanceQueue";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES: MaintenanceStage[] = ["reported", "claimed", "in_progress", "complete"];
const STAGE_LABEL: Record<MaintenanceStage, string> = {
  reported: "Reported",
  claimed: "Claimed",
  in_progress: "In Progress",
  pending_parts: "Pending Parts",
  handoff: "Handoff",
  complete: "Complete",
};

function urgencyBadge(u: string) {
  const map: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[u] ?? ""}>{u.toUpperCase()}</Badge>;
}

function StageIndicator({ stage }: { stage: MaintenanceStage }) {
  const currentIdx = stage === "pending_parts" || stage === "handoff"
    ? STAGES.indexOf("in_progress")
    : STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-muted"}`} />
          <span className={i <= currentIdx ? "text-foreground" : "text-muted-foreground"}>
            {STAGE_LABEL[s]}
          </span>
          {i < STAGES.length - 1 && <div className="h-px w-3 bg-border" />}
        </div>
      ))}
      {(stage === "pending_parts" || stage === "handoff") && (
        <Badge variant="outline" className="ml-2 text-[10px]">{STAGE_LABEL[stage]}</Badge>
      )}
    </div>
  );
}

function useStaffUsers() {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["super", "senior", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (ids.length === 0) return;
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      setUsers((profs ?? []).map((p: any) => ({ id: p.id, name: p.display_name ?? "User" })));
    })();
  }, []);
  return users;
}

function IssueCard({ issue }: { issue: MaintenanceIssue }) {
  const { user } = useAuth();
  const { role } = useRole();
  const m = useMaintenanceQueue({ subscribe: false }); // page owns the realtime channel; cards only need mutations
  const staff = useStaffUsers();
  const isPriv = role === "super" || role === "senior";

  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [handoffTo, setHandoffTo] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [completeNote, setCompleteNote] = useState("");
  const [partsNote, setPartsNote] = useState("");
  const [reassignTo, setReassignTo] = useState("");

  const isClaimer = issue.claimed_by === user?.id;
  const isHandoffTarget = issue.handoff_to === user?.id;
  const stage = issue.maintenance_stage;

  const actions: React.ReactNode[] = [];
  if (stage === "reported") {
    actions.push(<Button key="claim" size="sm" onClick={() => m.claimTask.mutate(issue.id)}>
      <Wrench className="h-3.5 w-3.5" /> Claim Task
    </Button>);
  } else if (stage === "claimed" && isClaimer) {
    actions.push(<Button key="start" size="sm" onClick={() => m.startWork.mutate(issue.id)}>
      <Play className="h-3.5 w-3.5" /> Start Work
    </Button>);
    actions.push(<Button key="ho" size="sm" variant="outline" onClick={() => setShowHandoff(true)}>
      <ArrowRightLeft className="h-3.5 w-3.5" /> Hand Off
    </Button>);
  } else if (stage === "in_progress" && isClaimer) {
    actions.push(<Button key="done" size="sm" onClick={() => setShowComplete(true)}>
      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
    </Button>);
    actions.push(<Button key="ho" size="sm" variant="outline" onClick={() => setShowHandoff(true)}>
      <ArrowRightLeft className="h-3.5 w-3.5" /> Hand Off
    </Button>);
    actions.push(<Button key="pp" size="sm" variant="outline" onClick={() => setShowParts(true)}>
      <Package className="h-3.5 w-3.5" /> Pending Parts
    </Button>);
  } else if (stage === "pending_parts" && isClaimer) {
    actions.push(<Button key="resume" size="sm" onClick={() => m.resumeWork.mutate(issue.id)}>
      <Play className="h-3.5 w-3.5" /> Parts Arrived — Resume
    </Button>);
    actions.push(<Button key="ho" size="sm" variant="outline" onClick={() => setShowHandoff(true)}>
      <ArrowRightLeft className="h-3.5 w-3.5" /> Hand Off
    </Button>);
  } else if (stage === "handoff" && isHandoffTarget) {
    actions.push(<Button key="accept" size="sm" onClick={() => m.acceptHandoff.mutate(issue.id)}>
      Accept & Start Work
    </Button>);
  }
  if (isPriv && stage !== "complete") {
    actions.push(<Button key="re" size="sm" variant="ghost" onClick={() => setShowReassign(true)}>Reassign</Button>);
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{issue.property_name}</h3>
              <Badge variant="secondary">{issue.issue_type}</Badge>
              {urgencyBadge(issue.urgency)}
            </div>
            <div className="text-xs text-muted-foreground">
              Reported by {issue.reported_by_name ?? "—"} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
            </div>
          </div>
          {issue.claimed_by_name && stage !== "complete" && (
            <Badge variant="outline" className="text-xs">
              Claimed by {issue.claimed_by_name}
            </Badge>
          )}
        </div>

        <div>
          <p className={`text-sm text-foreground/90 whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>
            {issue.description}
          </p>
          {issue.description.length > 200 && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary mt-1">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {issue.photo_urls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {issue.photo_urls.map((url, i) => (
              <img key={i} src={url} alt="" onClick={() => setLightbox(url)}
                className="h-16 w-16 rounded object-cover cursor-pointer border border-border" />
            ))}
          </div>
        )}

        {stage === "pending_parts" && issue.handoff_note && (
          <div className="text-xs bg-muted/40 p-2 rounded border border-border">
            <span className="font-medium">Parts needed:</span> {issue.handoff_note}
          </div>
        )}
        {stage === "handoff" && issue.handoff_to_name && (
          <div className="text-xs bg-muted/40 p-2 rounded border border-border">
            Handed off to <span className="font-medium">{issue.handoff_to_name}</span>
            {issue.handoff_note && <> — {issue.handoff_note}</>}
          </div>
        )}

        <StageIndicator stage={stage} />

        {actions.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}

        {showHandoff && (
          <div className="space-y-2 border-t border-border pt-3">
            <Select value={handoffTo} onValueChange={setHandoffTo}>
              <SelectTrigger><SelectValue placeholder="Hand off to..." /></SelectTrigger>
              <SelectContent>{staff.filter(s => s.id !== user?.id).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}</SelectContent>
            </Select>
            <Textarea value={handoffNote} onChange={e => setHandoffNote(e.target.value)} placeholder="Handoff note (what's done, what's next)..." rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!handoffTo} onClick={() => {
                m.handOffTask.mutate({ id: issue.id, to: handoffTo, note: handoffNote }, {
                  onSuccess: () => { toast.success("Handed off"); setShowHandoff(false); setHandoffTo(""); setHandoffNote(""); },
                });
              }}>Confirm Handoff</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowHandoff(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {showParts && (
          <div className="space-y-2 border-t border-border pt-3">
            <Textarea value={partsNote} onChange={e => setPartsNote(e.target.value)} placeholder="What parts are needed?" rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={partsNote.length < 3} onClick={() => {
                m.setPendingParts.mutate({ id: issue.id, note: partsNote }, {
                  onSuccess: () => { toast.success("Marked pending parts"); setShowParts(false); setPartsNote(""); },
                });
              }}>Set Pending Parts</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowParts(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {showComplete && (
          <div className="space-y-2 border-t border-border pt-3">
            <Textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)} placeholder="What was done?" rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={completeNote.length < 5} onClick={() => {
                m.completeTask.mutate({ id: issue.id, note: completeNote }, {
                  onSuccess: () => { toast.success("Marked complete"); setShowComplete(false); setCompleteNote(""); },
                });
              }}>Confirm Complete</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowComplete(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {showReassign && (
          <div className="space-y-2 border-t border-border pt-3">
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue placeholder="Reassign to..." /></SelectTrigger>
              <SelectContent>{staff.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" disabled={!reassignTo} onClick={() => {
                m.reassign.mutate({ id: issue.id, to: reassignTo }, {
                  onSuccess: () => { toast.success("Reassigned"); setShowReassign(false); setReassignTo(""); },
                });
              }}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReassign(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-3xl p-0 bg-transparent border-0">
            {lightbox && <img src={lightbox} alt="" className="w-full h-auto rounded-lg" />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function MaintenanceQueue() {
  const { issues, loading } = useMaintenanceQueue();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const active = useMemo(() => issues.filter(i =>
    i.maintenance_stage !== "complete" && i.status !== "resolved"
  ), [issues]);

  const resolved = useMemo(() => issues.filter(i =>
    i.maintenance_stage === "complete" || i.status === "resolved"
  ), [issues]);

  const properties = useMemo(() => {
    const set = new Map<string, string>();
    resolved.forEach(i => set.set(i.listing_id, i.property_name));
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [resolved]);

  const filteredResolved = resolved.filter(i => propertyFilter === "all" || i.listing_id === propertyFilter);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wrench className="h-7 w-7 text-primary" />
            Maintenance Queue
          </h1>
          <p className="text-muted-foreground mt-1">Property issues flagged by cleaners — claim, work, hand off, resolve.</p>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loading && active.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No active maintenance issues.
              </CardContent></Card>
            )}
            {active.map(i => <IssueCard key={i.id} issue={i} />)}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-3 mt-4">
            <div className="flex gap-3 items-center">
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {filteredResolved.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No resolved issues yet.</CardContent></Card>
            )}
            {filteredResolved.map(i => (
              <Card key={i.id} className="border-border/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{i.property_name}</h3>
                      <Badge variant="secondary">{i.issue_type}</Badge>
                      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Resolved</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {i.completed_at ? format(new Date(i.completed_at), "dd MMM yyyy HH:mm") : "—"}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{i.description}</p>
                  {i.completion_note && (
                    <div className="text-xs bg-muted/40 p-2 rounded">
                      <span className="font-medium">Resolution:</span> {i.completion_note}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Reported by {i.reported_by_name ?? "—"} · Completed by {i.completed_by_name ?? "—"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
