import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import type { OwnerProperty } from "@/hooks/useOwnerPortalData";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const d = (s: string) => format(parseISO(s), "d MMM");

interface Props {
  property: OwnerProperty | null;
  periodLabel: string;
  onClose: () => void;
}

export function OwnerReservationsDrawer({ property, periodLabel, onClose }: Props) {
  const open = !!property;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {property && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-base">{property.name}</SheetTitle>
              <SheetDescription className="text-xs">
                Every reservation that makes up the numbers for <strong>{periodLabel}</strong>.
                Nights shown are <em>nights inside this period</em>, not the full stay length.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Revenue" value={fmt(property.revenueThisYear)} />
              <Stat label="Nights" value={String(property.totalNights)} />
              <Stat label="Bookings" value={String(property.totalBookings)} />
            </div>

            <div className="mt-6 space-y-2">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Counted reservations
              </h4>
              {property.reservations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">None in this period.</p>
              ) : (
                property.reservations.map((r) => (
                  <div key={r.id + r.check_in} className="rounded-md border border-border/30 bg-secondary/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">{r.guest_name || "—"}</span>
                      <span className="font-display font-semibold text-foreground">{fmt(r.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{d(r.check_in)} → {d(r.check_out)} · {r.nights_in_period}n{r.nights_in_period !== r.nights_total && ` (of ${r.nights_total})`}</span>
                      <div className="flex items-center gap-1">
                        {r.platform && <Badge variant="outline" className="text-[9px] px-1 py-0">{r.platform}</Badge>}
                        {r.is_bundle_expansion && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary">
                            Bundle · {(r.revenue_factor * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {property.duplicatesDropped.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-[11px] font-medium uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Excluded as duplicates
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  These rows came in from Hostaway but overlap an existing booking on the same dates. Kept as a record but not counted.
                </p>
                {property.duplicatesDropped.map((r) => (
                  <div key={r.id} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">{r.guest_name || "—"}</span>
                      {r.platform && <Badge variant="outline" className="text-[9px] px-1 py-0">{r.platform}</Badge>}
                    </div>
                    <div className="text-muted-foreground">
                      {d(r.check_in)} → {d(r.check_out)} · duplicate of <strong>{r.duplicate_of || "another booking"}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/30 bg-secondary/30 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-display font-bold text-foreground">{value}</p>
    </div>
  );
}
