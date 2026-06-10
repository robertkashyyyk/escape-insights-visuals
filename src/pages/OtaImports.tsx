import { useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Link2, Ban, Trash2, RotateCcw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useOtaBatches, useOtaTransactions, useOtaMutations, useListings, fetchReservationCandidates, ListingLite,
  useAttributionDecisions, useSecurityDeposits,
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
                <SelectItem value="stripe">Stripe (Direct)</SelectItem>
                <SelectItem value="vrbo">Vrbo</SelectItem>
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
        <div className="text-xs text-muted-foreground">
          {txn.guest_name ?? ""} {txn.check_in ? `· ${d(txn.check_in)}` : ""}
          {(txn.reference_number || txn.confirmation_code) && (
            <> · <span className="font-mono">{txn.reference_number ?? txn.confirmation_code}</span></>
          )}
        </div>
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
  const { data: decided = [] } = useAttributionDecisions();
  const { data: listings = [] } = useListings();
  const m = useOtaMutations();
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting decision ({rows.length})</div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" /> Nothing awaiting attribution.
          </CardContent></Card>
        )}
        {rows.map((t) => <AttributionRow key={t.id} txn={t} listings={listings} m={m} />)}
      </div>

      {decided.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Decided ({decided.length}) — re-open to change</div>
          {decided.map((dd) => (
            <Card key={dd.id} className="border-border/60"><CardContent className="p-3 flex items-center justify-between gap-2 text-sm">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{dd.txn.platform}</Badge>
                  <span className="font-medium">{fmtGBP(dd.txn.net_amount ?? dd.txn.gross_amount)}</span>
                  {dd.outcome === "management_report"
                    ? <Badge variant="outline" className="bg-green-500/15 text-green-400 border-green-500/30">→ {dd.allocated_listing_name ?? "property"}</Badge>
                    : <Badge variant="outline">Company retention</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {dd.txn.statement_descriptor ?? dd.txn.property_name_raw ?? dd.txn.guest_name ?? "—"}{dd.reason ? ` · ${dd.reason}` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => m.reopenAttribution.mutate(dd.ota_transaction_id, {
                onSuccess: () => toast.success("Re-opened — re-decide above"),
              })}><RotateCcw className="h-3.5 w-3.5" /> Re-open</Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function MatchedTab() {
  const { data: rows = [], isLoading } = useOtaTransactions({ statuses: ["auto_matched", "matched"], revenueOnly: true });
  const { data: listings = [] } = useListings();
  const nameById = new Map(listings.map((l) => [l.id, l.name]));
  return (
    <div className="space-y-3">
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No matched reservations yet.</CardContent></Card>
      )}
      {rows.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="p-3 text-xs text-muted-foreground border-b border-border">{rows.length} reservations reconciled to Hostaway</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">Property</th><th className="text-left p-3">Guest</th>
                <th className="text-left p-3">Dates</th><th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Booking fee</th><th className="text-left p-3">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/40">
                  <td className="p-3">{(t.resolved_listing_id && nameById.get(t.resolved_listing_id)) || t.property_name_raw || "—"}</td>
                  <td className="p-3">{t.guest_name ?? "—"}</td>
                  <td className="p-3">{d(t.check_in)}–{d(t.check_out)}</td>
                  <td className="p-3 text-right">{fmtGBP(t.gross_amount ?? t.net_amount)}</td>
                  <td className="p-3 text-right text-muted-foreground">{fmtGBP(t.commission_amount)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={t.match_method === "code"
                      ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : "bg-blue-500/15 text-blue-400 border-blue-500/30"}>
                      {t.match_method}{t.match_confidence != null ? ` · ${t.match_confidence.toFixed(2)}` : ""}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}

function SecurityTab() {
  const { data, isLoading } = useSecurityDeposits();
  const m = useOtaMutations();
  const [month, setMonth] = useState<string>("all");
  const monthLabel = (m: string) => format(new Date(`${m}-01T00:00:00`), "MMM yyyy");
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "border-border/60 text-muted-foreground hover:border-border"}`;

  const inM = <T extends { month: string | null }>(arr: T[]) => (month === "all" ? arr : arr.filter((x) => x.month === month));
  const held = inM(data?.held ?? []);
  const refundOnly = inM(data?.refundOnly ?? []);
  const pairs = inM(data?.pairs ?? []);
  const totalHeld = Math.round(held.reduce((s, g) => s + g.net, 0) * 100) / 100;
  const returnedCount = pairs.length;
  const feeTotal = Math.round(([...held, ...refundOnly].reduce((s, g) => s + g.fee, 0) + pairs.reduce((s, p) => s + p.fee, 0)) * 100) / 100;
  const months = data?.months ?? [];

  return (
    <div className="space-y-4">
      {months.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Month:</span>
          <button onClick={() => setMonth("all")} className={chip(month === "all")}>All</button>
          {months.map((m) => <button key={m} onClick={() => setMonth(m)} className={chip(month === m)}>{monthLabel(m)}</button>)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Held (awaiting return)</div>
          <div className="text-lg font-bold">{fmtGBP(totalHeld)}</div>
          <div className="text-xs text-muted-foreground">{held.length} deposit{held.length === 1 ? "" : "s"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Returned (paired in/out)</div>
          <div className="text-lg font-bold">{returnedCount}</div>
          <div className="text-xs text-muted-foreground">net £0</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Deposit card fees</div>
          <div className="text-lg font-bold">{fmtGBP(feeTotal)}</div>
          <div className="text-xs text-muted-foreground">always charged</div>
        </CardContent></Card>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {/* Held */}
      <Card><CardContent className="p-0">
        <div className="p-3 text-sm font-semibold border-b border-border">Held deposits — carry to next month until refunded ({held.length})</div>
        {held.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No deposits held{month === "all" ? "" : " this month"}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left p-3">Taken</th><th className="text-left p-3">Stripe charge</th><th className="text-right p-3">Held</th><th className="text-right p-3">Fee</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {held.map((g) => (
                <tr key={g.ref} className="border-b border-border/40">
                  <td className="p-3">{g.date ? format(new Date(g.date), "dd MMM yyyy") : "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{g.ref}</td>
                  <td className="p-3 text-right">{fmtGBP(g.net)}</td>
                  <td className="p-3 text-right text-muted-foreground">{fmtGBP(g.fee)}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => m.sendDepositToAttribution.mutate(g.ref, {
                      onSuccess: () => toast.success("Sent to Attribution — allocate the in & out"),
                    })}>→ Attribution</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>

      {/* Refunds awaiting their charge (prior-month deposits) */}
      {refundOnly.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="p-3 text-sm font-semibold border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Refunds awaiting their charge ({refundOnly.length}) — upload the earlier month's Stripe to reconcile
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left p-3">Refunded</th><th className="text-left p-3">Stripe charge</th><th className="text-right p-3">Amount</th></tr>
            </thead>
            <tbody>
              {refundOnly.map((g) => (
                <tr key={g.ref} className="border-b border-border/40">
                  <td className="p-3">{g.date ? format(new Date(g.date), "dd MMM yyyy") : "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{g.ref}</td>
                  <td className="p-3 text-right">{fmtGBP(-g.refund)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

    </div>
  );
}

// Reconciled-deposit ledger: only deposits with BOTH an in and an out, one line
// each (Source id + both payment references + the two amounts), split by month.
function LedgerTab() {
  const { data } = useSecurityDeposits();
  const [month, setMonth] = useState<string>("all");
  const monthLabel = (m: string) => format(new Date(`${m}-01T00:00:00`), "MMM yyyy");
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "border-border/60 text-muted-foreground hover:border-border"}`;
  const months = data?.months ?? [];
  const pairs = (data?.pairs ?? []).filter((p) => month === "all" || p.month === month);

  return (
    <div className="space-y-4">
      {months.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Month:</span>
          <button onClick={() => setMonth("all")} className={chip(month === "all")}>All</button>
          {months.map((m) => <button key={m} onClick={() => setMonth(m)} className={chip(month === m)}>{monthLabel(m)}</button>)}
        </div>
      )}
      <Card><CardContent className="p-0">
        <div className="p-3 text-sm font-semibold border-b border-border">Reconciled deposits — in & out paired ({pairs.length})</div>
        {pairs.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No fully-paired deposits{month === "all" ? "" : " this month"}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Source ID</th>
                <th className="text-left p-3">Payment ref (in)</th>
                <th className="text-left p-3">Payment ref (out)</th>
                <th className="text-right p-3">In</th>
                <th className="text-right p-3">Out</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.ref} className="border-b border-border/40">
                  <td className="p-3 whitespace-nowrap">{p.date ? format(new Date(p.date), "dd MMM yyyy") : "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.ref}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.inRefs.join(", ") || "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.outRefs.join(", ") || "—"}</td>
                  <td className="p-3 text-right text-green-400">{fmtGBP(p.inTotal)}</td>
                  <td className="p-3 text-right text-red-400">{fmtGBP(-p.outTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  );
}

export default function OtaImports() {
  const { data: recon = [] } = useOtaTransactions({ statuses: ["needs_recon", "unmatched"], revenueOnly: true });
  const { data: attrib = [] } = useOtaTransactions({ statuses: ["needs_recon"], nonRevenueOnly: true });
  const { data: matched = [] } = useOtaTransactions({ statuses: ["auto_matched", "matched"], revenueOnly: true });
  const { data: sec } = useSecurityDeposits();
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
            <TabsTrigger value="matched">Matched ({matched.length})</TabsTrigger>
            <TabsTrigger value="recon">Recon Queue ({recon.length})</TabsTrigger>
            <TabsTrigger value="attribution">Attribution ({attrib.length})</TabsTrigger>
            <TabsTrigger value="security">Security ({sec?.held.length ?? 0})</TabsTrigger>
            <TabsTrigger value="ledger">Ledger ({sec?.pairs.length ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="batches" className="mt-4"><BatchesTab /></TabsContent>
          <TabsContent value="matched" className="mt-4"><MatchedTab /></TabsContent>
          <TabsContent value="recon" className="mt-4"><ReconTab /></TabsContent>
          <TabsContent value="attribution" className="mt-4"><AttributionTab /></TabsContent>
          <TabsContent value="security" className="mt-4"><SecurityTab /></TabsContent>
          <TabsContent value="ledger" className="mt-4"><LedgerTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
