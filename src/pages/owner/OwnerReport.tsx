import { useMemo, useState } from "react";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerMonthlyReport, type ReportProperty } from "@/hooks/useOwnerMonthlyReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FileBarChart } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function pct(cur: number, prev: number): { label: string; up: boolean } | null {
  if (!prev) return null;
  const p = ((cur - prev) / prev) * 100;
  return { label: `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`, up: p >= 0 };
}

function PropTable({ prop, year }: { prop: ReportProperty; year: number }) {
  const totals = prop.months.reduce(
    (a, mo) => ({ n: a.n + mo.nights, r: a.r + mo.revenue, pr: a.pr + mo.prevRevenue }),
    { n: 0, r: 0, pr: 0 },
  );
  const yoy = pct(totals.r, totals.pr);
  return (
    <Card className="border-border/30 bg-card/50">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{prop.name}</CardTitle>
        <span className="text-sm text-muted-foreground">
          {fmt(totals.r)} {yoy && <span className={yoy.up ? "text-emerald-500" : "text-red-400"}>({yoy.label})</span>}
        </span>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <th className="text-left font-medium px-3 py-1.5">Month</th>
              <th className="text-right font-medium px-3 py-1.5">Nights</th>
              <th className="text-right font-medium px-3 py-1.5">Occ</th>
              <th className="text-right font-medium px-3 py-1.5">Revenue</th>
              <th className="text-right font-medium px-3 py-1.5">ADR</th>
              <th className="text-right font-medium px-3 py-1.5">vs LY</th>
            </tr>
          </thead>
          <tbody>
            {prop.months.map((mo) => {
              const y = pct(mo.revenue, mo.prevRevenue);
              const empty = mo.nights === 0 && mo.revenue === 0;
              return (
                <tr key={mo.m} className={`border-b border-border/10 ${empty ? "opacity-40" : ""}`}>
                  <td className="px-3 py-1.5 text-foreground">{MONTHS[mo.m]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{mo.nights}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{mo.occ.toFixed(0)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-foreground font-medium">{fmt(mo.revenue)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{mo.adr ? fmt(mo.adr) : "—"}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${y ? (y.up ? "text-emerald-500" : "text-red-400") : "text-muted-foreground"}`}>
                    {y ? y.label : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function OwnerReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useOwnerMonthlyReport(year);

  const portfolio = useMemo(() => {
    if (!data) return null;
    const nProps = data.properties.length || 1;
    const rows = MONTHS.map((_, m) => {
      let n = 0, r = 0, pr = 0, pn = 0;
      data.properties.forEach((p) => {
        const mo = p.months[m];
        n += mo.nights; r += mo.revenue; pr += mo.prevRevenue; pn += mo.prevNights;
      });
      const cap = daysInMonth(year, m) * nProps;
      return { m, nights: n, revenue: r, occ: cap ? (n / cap) * 100 : 0, adr: n ? r / n : 0, prevRevenue: pr };
    });
    const totR = rows.reduce((s, x) => s + x.revenue, 0);
    const totPrev = rows.reduce((s, x) => s + x.prevRevenue, 0);
    return { rows, totR, totPrev };
  }, [data, year]);

  return (
    <OwnerLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <FileBarChart className="h-6 w-6 text-primary" /> My Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Monthly performance by property, versus last year.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-lg font-display font-bold w-16 text-center">{year}</span>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} disabled={year >= new Date().getFullYear()}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading || !data || !portfolio ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading report…</div>
        ) : data.properties.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No properties to report.</div>
        ) : (
          <>
            {/* Portfolio total */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Portfolio total</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {fmt(portfolio.totR)}{(() => { const y = pct(portfolio.totR, portfolio.totPrev); return y ? <span className={y.up ? "text-emerald-500" : "text-red-400"}> ({y.label})</span> : null; })()}
                </span>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                      <th className="text-left font-medium px-3 py-1.5">Month</th>
                      <th className="text-right font-medium px-3 py-1.5">Nights</th>
                      <th className="text-right font-medium px-3 py-1.5">Occ</th>
                      <th className="text-right font-medium px-3 py-1.5">Revenue</th>
                      <th className="text-right font-medium px-3 py-1.5">ADR</th>
                      <th className="text-right font-medium px-3 py-1.5">vs LY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.rows.map((mo) => {
                      const y = pct(mo.revenue, mo.prevRevenue);
                      const empty = mo.revenue === 0;
                      return (
                        <tr key={mo.m} className={`border-b border-border/10 ${empty ? "opacity-40" : ""}`}>
                          <td className="px-3 py-1.5 text-foreground">{MONTHS[mo.m]}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mo.nights}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mo.occ.toFixed(0)}%</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-foreground font-medium">{fmt(mo.revenue)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mo.adr ? fmt(mo.adr) : "—"}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${y ? (y.up ? "text-emerald-500" : "text-red-400") : "text-muted-foreground"}`}>{y ? y.label : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {data.properties.map((p) => <PropTable key={p.id} prop={p} year={year} />)}
          </>
        )}
      </div>
    </OwnerLayout>
  );
}
