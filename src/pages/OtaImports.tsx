import { useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Link2, Ban, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useOtaBatches, useOtaTransactions, useOtaMutations, useListings, fetchReservationCandidates, ListingLite,
} from "@/hooks/useOtaIngestion";
import {
  OtaTransaction, OtaPlatform, ResvCandidate, scoreCandidate, fuzzyListingScore, fmtGBP, reconBadgeClass,
} from "@/lib/ota";

const d = (s: string | null) => (s ? format(new Date(s), "dd MMM") : "—");

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────
function UploadCard() {
  const { uploadCsv } = useOtaMutations();
  const [platform, setPlatform] = useState<OtaPlatform>("airbnb");
  const [summary, setSummary] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (file?: File) => {
    if (!file) return;
    uploadCsv.mutate({ platform, file }, {
      onSuccess: (s) => { setSummary(s); toast.success(`Parsed ${s.total} rows · ${s.auto_matched} auto-matched`); },
      onError: (e: any) => toast.error(e.message ?? "Upload failed"),
    });
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Platform</label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as OtaPlatform)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="bookingcom">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploadCsv.isPending}>
            <UploadCloud className="h-4 w-4" /> {uploadCsv.isPending ? "Parsing…" : "Upload CSV"}
          </Button>
        </div>
        {summary && (
          <div className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Total rows", summary.total], ["Reservations", summary.reservations],
              ["Payouts", summary.payouts], ["Resolutions", summary.resolutions],
              ["Auto-matched", summary.auto_matched], ["Needs recon", summary.needs_recon],
              ["Unmatched", summary.unmatched], ["Channel / Host", `${summary.channel} / ${summary.host}`],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded border border-border/60 p-2">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="font-semibold">{v as any}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Batches
// ─────────────────────────────────────────────────────────────────────────────
function DeleteBatchButton({ batchId, filename }: { batchId: string; filename: string }) {
  const { deleteBatch } = useOtaMutations();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="text-muted-foreground hover:text-destructive" title="Delete import">
          <Trash2 className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this import?</AlertDialogTitle>
          <AlertDialogDescription>
            “{filename}” and all of its parsed rows (matches + attribution decisions) will be removed.
            Learned property aliases are kept. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteBatch.mutate(batchId, {
            onSuccess: () => toast.success("Import deleted"),
            onError: (e: any) => toast.error(e.message ?? "Delete failed"),
          })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BatchesTab() {
  const { data: batches = [], isLoading } = useOtaBatches();
  return (
    <div className="space-y-4">
      <UploadCard />
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && batches.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No imports yet.</CardContent></Card>
      )}
      {batches.length > 0 && (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">File</th><th className="text-left p-3">Platform</th>
                <th className="text-left p-3">Period</th><th className="text-right p-3">Rows</th>
                <th className="text-left p-3">Status</th><th className="text-left p-3">Uploaded</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border/40">
                  <td className="p-3 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-muted-foreground" />{b.source_filename}</td>
                  <td className="p-3"><Badge variant="secondary">{b.platform}</Badge></td>
                  <td className="p-3">{b.inferred_period_start ? `${d(b.inferred_period_start)} – ${d(b.inferred_period_end)}` : "—"}</td>
                  <td className="p-3 text-right">{b.row_count}</td>
                  <td className="p-3">{b.status}</td>
                  <td className="p-3 text-muted-foreground">{format(new Date(b.uploaded_at), "dd MMM HH:mm")}</td>
                  <td className="p-3 text-right"><DeleteBatchButton batchId={b.id} filename={b.source_filename} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recon Queue
// ─────────────────────────────────────────────────────────────────────────────
function ReconRow({ txn, listings, m }: {
  txn: OtaTransaction; listings: ListingLite[]; m: ReturnType<typeof useOtaMutations>;
}) {
  const [candidates, setCandidates] = useState<ResvCandidate[] | null>(null);
  const [loadingCand, setLoadingCand] = useState(false);
  const [pickListing, setPickListing] = useState<string>("");

  const needsListing = !txn.resolved_listing_id;

  const rankedListings = useMemo(() => {
    if (!txn.property_name_raw) return listings;
    return [...listings]
      .map((l) => ({ l, s: fuzzyListingScore(txn.property_name_raw!, l.name) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.l);
  }, [listings, txn.property_name_raw]);

  const loadCandidates = async () => {
    if (!txn.resolved_listing_id) return;
    setLoadingCand(true);
    const c = await fetchReservationCandidates(txn.resolved_listing_id);
    c.sort((a, b) => scoreCandidate(txn, b) - scoreCandidate(txn, a));
    setCandidates(c);
    setLoadingCand(false);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{txn.property_name_raw ?? "(no property name)"}</span>
              <Badge variant="secondary">{txn.platform}</Badge>
              {txn.collection_model && <Badge variant="outline">{txn.collection_model}</Badge>}
              <Badge variant="outline" className={reconBadgeClass[txn.recon_status]}>{txn.recon_status}</Badge>
              {txn.match_confidence != null && <span className="text-xs text-muted-foreground">conf {txn.match_confidence.toFixed(2)}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {txn.guest_name ?? "—"} · {d(txn.check_in)}–{d(txn.check_out)} · {txn.nights ?? "?"}n · {fmtGBP(txn.net_amount ?? txn.gross_amount)}
              {(txn.confirmation_code || txn.reference_number) && <> · code {txn.confirmation_code ?? txn.reference_number}</>}
            </div>
          </div>
        </div>

        {needsListing ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">Resolve listing (ranked by name similarity):</div>
            <div className="flex gap-2">
              <Select value={pickListing} onValueChange={setPickListing}>
                <SelectTrigger className="w-80"><SelectValue placeholder="Pick listing…" /></SelectTrigger>
                <SelectContent>
                  {rankedListings.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!pickListing} onClick={() =>
                m.confirmListing.mutate({ txn, listingId: pickListing }, {
                  onSuccess: () => toast.success("Listing learned — alias saved"),
                })
              }><Link2 className="h-3.5 w-3.5" /> Confirm listing</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 border-t border-border pt-3">
            {!candidates && (
              <Button size="sm" variant="outline" onClick={loadCandidates} disabled={loadingCand}>
                {loadingCand ? "Loading…" : "Show reservation candidates"}
              </Button>
            )}
            {candidates && candidates.length === 0 && (
              <div className="text-xs text-muted-foreground">No confirmed reservations on this listing.</div>
            )}
            {candidates && candidates.map((c) => {
              const sc = scoreCandidate(txn, c);
              const isSuggested = txn.matched_reservation_id === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm rounded border border-border/50 p-2">
                  <div>
                    {c.guest_name ?? "—"} · {d(c.check_in)}–{d(c.check_out)} · {fmtGBP(c.host_payout ?? c.total_amount)}
                    <span className="text-xs text-muted-foreground ml-2">score {sc.toFixed(2)}{isSuggested && " · suggested"}</span>
                  </div>
                  <Button size="sm" onClick={() => m.confirmMatch.mutate(
                    { txnId: txn.id, reservationId: c.id, method: "manual" }, { onSuccess: () => toast.success("Match confirmed") })}>
                    Confirm
                  </Button>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() =>
              m.markNoReservation.mutate({ txnId: txn.id }, { onSuccess: () => toast.success("Marked: no Hostaway reservation") })
            }><Ban className="h-3.5 w-3.5" /> No Hostaway reservation</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReconTab() {
  const { data: rows = [], isLoading } = useOtaTransactions({ statuses: ["needs_recon", "unmatched"], revenueOnly: true });
  const { data: listings = [] } = useListings();
  const m = useOtaMutations();
  return (
    <div className="space-y-3">
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" /> Recon queue is clear.
        </CardContent></Card>
      )}
      {rows.map((t) => <ReconRow key={t.id} txn={t} listings={listings} m={m} />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribution Queue (non-revenue)
// ─────────────────────────────────────────────────────────────────────────────
function AttributionRow({ txn, listings, m }: {
  txn: OtaTransaction; listings: ListingLite[]; m: ReturnType<typeof useOtaMutations>;
}) {
  const [listingId, setListingId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{txn.platform}</Badge>
          <Badge variant="outline">{txn.txn_type}</Badge>
          <span className="font-medium">{fmtGBP(txn.net_amount ?? txn.gross_amount)}</span>
          <span className="text-xs text-muted-foreground">{txn.statement_descriptor ?? txn.property_name_raw ?? "—"}</span>
        </div>
        <div className="text-xs text-muted-foreground">{txn.guest_name ?? ""} {txn.check_in ? `· ${d(txn.check_in)}` : ""}</div>
        <Textarea rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Select value={listingId} onValueChange={setListingId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Allocate to listing…" /></SelectTrigger>
            <SelectContent>{listings.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" disabled={!listingId} onClick={() =>
            m.attributionDecision.mutate(
              { txnId: txn.id, outcome: "management_report", allocatedListingId: listingId, reason },
              { onSuccess: () => toast.success("Sent to Management Report") })
          }>Send to Management Report</Button>
          <Button size="sm" variant="outline" onClick={() =>
            m.attributionDecision.mutate(
              { txnId: txn.id, outcome: "company_retention", reason },
              { onSuccess: () => toast.success("Recorded as Company Retention") })
          }>Company Retention</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttributionTab() {
  const { data: rows = [], isLoading } = useOtaTransactions({ statuses: ["needs_recon"], nonRevenueOnly: true });
  const { data: listings = [] } = useListings();
  const m = useOtaMutations();
  return (
    <div className="space-y-3">
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" /> No items awaiting attribution.
        </CardContent></Card>
      )}
      {rows.map((t) => <AttributionRow key={t.id} txn={t} listings={listings} m={m} />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OtaImports() {
  const { data: recon = [] } = useOtaTransactions({ statuses: ["needs_recon", "unmatched"], revenueOnly: true });
  const { data: attrib = [] } = useOtaTransactions({ statuses: ["needs_recon"], nonRevenueOnly: true });
  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <UploadCloud className="h-7 w-7 text-primary" /> OTA Imports
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload Airbnb / Booking.com settlement reports, reconcile to Hostaway, and attribute non-revenue items.
          </p>
        </div>
        <Tabs defaultValue="batches">
          <TabsList>
            <TabsTrigger value="batches">Imports</TabsTrigger>
            <TabsTrigger value="recon">Recon Queue ({recon.length})</TabsTrigger>
            <TabsTrigger value="attribution">Attribution ({attrib.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="batches" className="mt-4"><BatchesTab /></TabsContent>
          <TabsContent value="recon" className="mt-4"><ReconTab /></TabsContent>
          <TabsContent value="attribution" className="mt-4"><AttributionTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
