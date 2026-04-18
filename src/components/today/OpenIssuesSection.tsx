import { useState } from "react";
import { useOpenIssues, OpenIssue } from "@/hooks/useOpenIssues";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const URGENCY_STYLES = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-secondary text-muted-foreground border-border/30",
};

export function OpenIssuesSection() {
  const { issues, loading, acknowledge, resolve } = useOpenIssues();
  const [resolving, setResolving] = useState<OpenIssue | null>(null);

  if (loading) return null;
  if (issues.length === 0) return null;

  return (
    <section className="glass-card rounded-xl border border-destructive/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
          Open Issues
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">{issues.length} open</span>
      </div>
      <div className="divide-y divide-border/20">
        {issues.map(issue => (
          <div key={issue.id} className="px-5 py-4 flex gap-4 items-start">
            {issue.first_photo_url && (
              <img src={issue.first_photo_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-border/30" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm text-foreground truncate">{issue.property_name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${URGENCY_STYLES[issue.urgency]}`}>
                  {issue.urgency.toUpperCase()}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/30">
                  {issue.issue_type}
                </span>
                {issue.status === "acknowledged" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                    ACKNOWLEDGED
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/80 line-clamp-2">{issue.description}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {issue.reported_by_name ?? "Unknown"} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
              </p>
              <div className="flex gap-2 mt-3">
                {issue.status === "open" && (
                  <button
                    onClick={() => acknowledge(issue.id).then(() => toast.success("Acknowledged"))}
                    className="text-xs px-3 py-1.5 rounded-md bg-secondary border border-border/30 text-foreground hover:bg-secondary/70 flex items-center gap-1.5"
                  >
                    <Check className="h-3 w-3" /> Acknowledge
                  </button>
                )}
                <button
                  onClick={() => setResolving(issue)}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Check className="h-3 w-3" /> Resolve
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {resolving && (
        <ResolveModal
          issue={resolving}
          onClose={() => setResolving(null)}
          onConfirm={async (notes) => { await resolve(resolving.id, notes); toast.success("Issue resolved"); setResolving(null); }}
        />
      )}
    </section>
  );
}

function ResolveModal({ issue, onClose, onConfirm }: { issue: OpenIssue; onClose: () => void; onConfirm: (notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    if (notes.trim().length < 5) { toast.error("Resolution notes are required (min 5 chars)"); return; }
    setSubmitting(true);
    await onConfirm(notes.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border/30 rounded-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-base">Resolve Issue</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{issue.property_name} · {issue.issue_type}</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was done to resolve this? (required)"
          rows={4}
          className="w-full bg-secondary/30 border border-border/30 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border/30 text-sm">Cancel</button>
          <button onClick={handle} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Resolved
          </button>
        </div>
      </div>
    </div>
  );
}
