import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export interface ReassignPending {
  taskId: string;
  fromCleanerName: string;
  toCleanerName: string;
  toCleanerId: string | null;
  propertyName: string;
  locationGroup: string;
  date: Date;
  outsideArea: boolean;
}

interface Props {
  pending: ReassignPending | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ReassignConfirmDialog({ pending, onCancel, onConfirm }: Props) {
  const [stage, setStage] = useState<"primary" | "warn">("primary");

  useEffect(() => {
    if (pending) setStage("primary");
  }, [pending]);

  const handleFirstConfirm = async (e: React.MouseEvent) => {
    if (pending?.outsideArea && pending.toCleanerId) {
      e.preventDefault();
      setStage("warn");
    } else {
      await onConfirm();
    }
  };

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <AlertDialogContent>
        {pending && stage === "primary" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Reassign clean?</AlertDialogTitle>
              <AlertDialogDescription>Confirm the reassignment below.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="text-sm space-y-1.5">
              <Row label="Original cleaner" value={pending.fromCleanerName} />
              <Row label="New cleaner" value={pending.toCleanerName} />
              <Row label="Property" value={pending.propertyName} />
              <Row label="Location group" value={pending.locationGroup} />
              <Row label="Date" value={format(pending.date, "EEE d MMM yyyy")} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleFirstConfirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
        {pending && stage === "warn" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Outside cleaner's area</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{pending.toCleanerName}</strong> doesn't cover{" "}
                <strong>"{pending.locationGroup}"</strong>. This is outside their normal patch — are
                you really sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await onConfirm();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirm anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/30 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
