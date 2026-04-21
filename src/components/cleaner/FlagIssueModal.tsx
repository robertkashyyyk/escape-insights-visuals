import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, X, Camera } from "lucide-react";

interface FlagIssueModalProps {
  open: boolean;
  onClose: () => void;
  task: {
    id: string;
    listing_id: string;
    property_name: string;
  };
  cleanerId: string;
  cleanerName: string;
}

const ISSUE_TYPES = [
  "Damage",
  "Missing items",
  "Cleanliness concern",
  "Maintenance needed",
  "Guest left belongings",
  "Access problem",
  "Other",
];

export function FlagIssueModal({ open, onClose, task, cleanerId, cleanerName }: FlagIssueModalProps) {
  const { user } = useAuth();
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "urgent">("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setIssueType(""); setDescription(""); setUrgency("medium"); setFiles([]);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, 20);
    setFiles(list);
  };

  const handleSubmit = async () => {
    if (!issueType) { toast.error("Pick an issue type"); return; }
    if (!description.trim() || description.trim().length < 5) { toast.error("Add a description (min 5 chars)"); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      // Upload photos
      const photoPaths: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${task.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("clean-issue-photos").upload(path, file);
        if (upErr) throw upErr;
        photoPaths.push(path);
      }

      // Insert issue
      const { data: issue, error: insErr } = await supabase
        .from("clean_issues")
        .insert({
          listing_id: task.listing_id,
          clean_task_id: task.id,
          reported_by_cleaner_id: cleanerId,
          reported_by_user_id: user.id,
          issue_type: issueType,
          description: description.trim(),
          urgency,
          photo_paths: photoPaths,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Trigger urgent email
      if (urgency === "urgent" && issue) {
        supabase.functions.invoke("notify-urgent-issue", {
          body: {
            issueId: issue.id,
            propertyName: task.property_name,
            issueType,
            description: description.trim(),
            reportedBy: cleanerName,
          },
        }).catch((e) => console.error("notify-urgent-issue failed", e));
      }

      toast.success(urgency === "urgent" ? "🚨 Urgent issue flagged — managers notified" : "Issue flagged");
      reset();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to flag issue");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card text-foreground w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border/30 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border/30 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg">Flag an Issue</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.property_name}</p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Issue Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIssueType(t)}
                  className={`text-xs py-2.5 px-3 rounded-lg border transition-colors ${
                    issueType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/30 border-border/30 text-foreground hover:border-primary/50"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Urgency</label>
            <div className="grid grid-cols-3 gap-2">
              {(["low","medium","urgent"] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`text-xs py-2.5 rounded-lg border font-medium capitalize transition-colors ${
                    urgency === u
                      ? u === "urgent" ? "bg-destructive text-destructive-foreground border-destructive"
                        : u === "medium" ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-border"
                      : "bg-secondary/30 border-border/30 text-muted-foreground"
                  }`}
                >{u}</button>
              ))}
            </div>
            {urgency === "urgent" && (
              <p className="text-xs text-destructive mt-2">⚡ Managers will be emailed immediately.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you found…"
              rows={4}
              className="w-full bg-secondary/30 border border-border/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Photos (optional, up to 20)</label>
            <label className="flex items-center justify-center gap-2 py-3 border border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" />
              {files.length > 0 ? `${files.length} photo${files.length > 1 ? "s" : ""} selected` : "Add photos"}
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFiles} />
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Issue
          </button>
        </div>
      </div>
    </div>
  );
}
