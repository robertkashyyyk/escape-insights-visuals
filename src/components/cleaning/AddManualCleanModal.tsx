import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { MatrixCleaner, MatrixListing, CleanerHolidayRow } from "@/hooks/useMatrixSchedule";
import { format } from "date-fns";
import { getUnavailabilityReason } from "@/lib/cleanerAvailability";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: MatrixListing | null;
  date: Date | null;
  cleaners: MatrixCleaner[];
  holidays?: CleanerHolidayRow[];
  onSubmit: (input: {
    listing_id: string;
    scheduled_date: string;
    task_type: "clean" | "interim" | "maintenance";
    assigned_cleaner_id: string | null;
    notes: string | null;
  }) => Promise<boolean>;
}

export function AddManualCleanModal({ open, onOpenChange, listing, date, cleaners, holidays = [], onSubmit }: Props) {
  const [taskType, setTaskType] = useState<"clean" | "interim" | "maintenance">("clean");
  const [cleanerId, setCleanerId] = useState<string>("unassigned");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const unavailReason = useMemo(() => {
    if (!date || cleanerId === "unassigned") return null;
    const c = cleaners.find((x) => x.id === cleanerId);
    const hs = holidays.filter((h) => h.cleaner_id === cleanerId);
    return getUnavailabilityReason(c, date, hs);
  }, [cleanerId, date, cleaners, holidays]);

  if (!listing || !date) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = await onSubmit({
      listing_id: listing.id,
      scheduled_date: format(date, "yyyy-MM-dd"),
      task_type: taskType,
      assigned_cleaner_id: cleanerId === "unassigned" ? null : cleanerId,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
      setTaskType("clean");
      setCleanerId("unassigned");
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Clean</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Property</Label>
            <p className="text-sm font-medium text-foreground mt-1">{listing.name}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <p className="text-sm font-medium text-foreground mt-1">{format(date, "EEEE d MMMM yyyy")}</p>
          </div>

          <div>
            <Label htmlFor="task-type" className="text-xs">Type</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as any)}>
              <SelectTrigger id="task-type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="interim">Interim Clean</SelectItem>
                <SelectItem value="maintenance">Maintenance Check</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cleaner" className="text-xs">Assign to</Label>
            <Select value={cleanerId} onValueChange={setCleanerId}>
              <SelectTrigger id="cleaner" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {cleaners.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {unavailReason && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-xs text-amber-300">
                This cleaner is marked <strong>{unavailReason}</strong> on this date.
                Assigning is allowed but will be flagged as an override.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific instructions…"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Adding…" : "Add Clean"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
