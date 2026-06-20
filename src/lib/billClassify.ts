// Bank-statement parsing + transaction classification for "Bills paid on behalf".
// Pure functions only — no React / Supabase — so they're easy to reason about and test.
// Tuned for Wise (TransferWise) CSV exports but tolerant of column order.

export interface RawTxn {
  external_id: string;
  txn_date: string | null;          // yyyy-mm-dd
  amount: number;                   // signed as in the statement (debits negative)
  direction: "credit" | "debit";
  details_type: string;             // TRANSFER / DIRECT_DEBIT / CARD / DEPOSIT …
  payer_name: string;
  payee_name: string;
  reference: string;
  description: string;
}

// Minimal RFC-4180 CSV parser — handles quoted fields, escaped quotes, embedded
// commas and newlines. (No dependency on papaparse, which isn't installed.)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignore */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toIsoDate(d: string): string | null {
  const m = d?.match(/^(\d{2})-(\d{2})-(\d{4})$/); // Wise "DD-MM-YYYY"
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

// Parse a Wise statement CSV into typed rows, resolving columns by header name.
export function parseWiseStatement(text: string): RawTxn[] {
  const grid = parseCsv(text);
  if (grid.length < 2) return [];
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const cId = col("TransferWise ID"), cDate = col("Date"), cAmt = col("Amount"),
    cDesc = col("Description"), cRef = col("Payment Reference"),
    cPayer = col("Payer Name"), cPayee = col("Payee Name"),
    cType = col("Transaction Type"), cDetails = col("Transaction Details Type");
  const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  const out: RawTxn[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length < 3) continue;
    const amount = Number(get(row, cAmt) || 0);
    const type = get(row, cType).toUpperCase();
    out.push({
      external_id: get(row, cId) || `${get(row, cDate)}|${get(row, cAmt)}|${r}`,
      txn_date: toIsoDate(get(row, cDate)),
      amount,
      direction: type === "CREDIT" || amount > 0 ? "credit" : "debit",
      details_type: get(row, cDetails),
      payer_name: get(row, cPayer),
      payee_name: get(row, cPayee),
      reference: get(row, cRef),
      description: get(row, cDesc),
    });
  }
  return out;
}

// Normalise a counterparty name to a stable key for matching + learning rules.
export function normalisePayee(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|t\/?a|trading as|and sons|services?|properties)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type Classification = "income" | "owner_settlement" | "internal" | "candidate" | "ignored";
export type RuleAction = "income" | "owner_settlement" | "internal" | "bill" | "ignore";

export interface PayeeRuleLite { payee_key: string; action: RuleAction }

// Counterparties whose CREDITs/DEBITs are platform income, never a bill.
const INCOME_HINTS = ["booking.com", "booking com", "stripe", "airbnb", "citibank", "expedia", "vrbo"];
const INTERNAL_HINTS = ["escape ordinary group"];

// Classify one parsed txn. `ownerKeys` = normalised owner names/companies;
// `ruleByKey` = learned payee rules (override the heuristics).
export function classifyTxn(
  t: RawTxn,
  ownerKeys: Set<string>,
  ruleByKey: Map<string, PayeeRuleLite>,
): { classification: Classification; matchedOwnerKey?: string } {
  const counterparty = t.direction === "credit" ? t.payer_name : t.payee_name;
  const key = normalisePayee(counterparty);

  // 1. A learned rule always wins.
  const rule = ruleByKey.get(key);
  if (rule) {
    if (rule.action === "bill") return { classification: "candidate" };
    if (rule.action === "ignore") return { classification: "ignored" };
    return { classification: rule.action };
  }

  // 2. Income = any credit, or a known income counterparty in the text.
  const hay = `${t.payer_name} ${t.description} ${t.reference}`.toLowerCase();
  if (t.direction === "credit") return { classification: "income" };
  if (INCOME_HINTS.some((h) => hay.includes(h))) return { classification: "income" };

  // 3. Internal transfers.
  if (INTERNAL_HINTS.some((h) => key.includes(normalisePayee(h)))) return { classification: "internal" };

  // 4. Owner settlement = debit to a known owner (exact or strong substring).
  if (ownerKeys.has(key)) return { classification: "owner_settlement", matchedOwnerKey: key };
  for (const ok of ownerKeys) {
    if (ok.length > 4 && (key.includes(ok) || ok.includes(key)))
      return { classification: "owner_settlement", matchedOwnerKey: ok };
  }

  // 5. Everything else is a candidate "bill on behalf" for the user to review.
  return { classification: "candidate" };
}

export const STRIP_CLASSES: Classification[] = ["income", "owner_settlement", "internal"];
