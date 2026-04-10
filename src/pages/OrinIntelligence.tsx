import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, Lock, ChevronLeft, RefreshCw, Loader2, AlertTriangle, TrendingUp, TrendingDown, Building2, Eye, BarChart3 } from "lucide-react";
import { useOrinBriefs, useGenerateBriefs, useRegenerateBrief, getNextPeriod, type OrinBrief } from "@/hooks/useOrinBriefs";

export default function OrinIntelligence() {
  const [view, setView] = useState<"monthly" | "quarterly">("monthly");
  const [selectedBrief, setSelectedBrief] = useState<OrinBrief | null>(null);

  return (
    <AppLayout>
      <div className="p-6 md:p-10 lg:p-12 max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              The Orin Brief
            </h1>
            <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] px-2 py-0.5 font-semibold tracking-wider">
              <Sparkles className="h-3 w-3 mr-1" />AI-Powered
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Your portfolio intelligence, delivered monthly.</p>

          {/* Tabs */}
          <div className="mt-6 flex items-center justify-between">
            <div className="inline-flex rounded-xl bg-secondary/40 p-1 border border-border/20">
              {(["monthly", "quarterly"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setSelectedBrief(null); }}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    view === v
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {v === "monthly" ? "Monthly Brief" : "Quarterly Deep Dive"}
                </button>
              ))}
            </div>
            <GenerateButton />
          </div>
        </div>

        {selectedBrief ? (
          <BriefDetail brief={selectedBrief} onBack={() => setSelectedBrief(null)} />
        ) : (
          <BriefArchive type={view} onSelect={setSelectedBrief} />
        )}
      </div>
    </AppLayout>
  );
}

function GenerateButton() {
  const generate = useGenerateBriefs();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => generate.mutate({})}
      disabled={generate.isPending}
      className="text-xs gap-1.5"
    >
      {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      Generate Historical Briefs
    </Button>
  );
}

function BriefArchive({ type, onSelect }: { type: "monthly" | "quarterly"; onSelect: (b: OrinBrief) => void }) {
  const { data: briefs, isLoading } = useOrinBriefs(type);
  const nextPeriod = getNextPeriod(type);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const generated = briefs?.filter(b => b.status === "generated") || [];

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Next upcoming period (locked) */}
      <div className="rounded-2xl border border-border/20 bg-secondary/10 p-6 text-center mb-6">
        <div className="h-10 w-10 rounded-xl bg-secondary/30 flex items-center justify-center mx-auto mb-3">
          <Lock className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {nextPeriod.label}
        </h3>
        <p className="text-xs text-muted-foreground">
          Available <span className="text-foreground font-medium">{nextPeriod.availableDate}</span>
        </p>
      </div>

      {/* Generated briefs */}
      {generated.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-3">No briefs generated yet.</p>
          <p className="text-xs text-muted-foreground/70">Click "Generate Historical Briefs" to create briefs for all completed periods with data.</p>
        </div>
      ) : (
        generated.map((brief) => (
          <BriefCard key={brief.id} brief={brief} onClick={() => onSelect(brief)} />
        ))
      )}
    </div>
  );
}

function BriefCard({ brief, onClick }: { brief: OrinBrief; onClick: () => void }) {
  const content = brief.content;
  const headline = content?.headline || content?.raw_text?.slice(0, 100) || "Brief available";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/20 bg-secondary/10 p-5 hover:bg-secondary/20 hover:border-primary/20 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {brief.period_label}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{headline}</p>
        </div>
        <div className="shrink-0">
          {brief.period_type === "quarterly" ? (
            <BarChart3 className="h-4 w-4 text-primary/50" />
          ) : (
            <Calendar className="h-4 w-4 text-primary/50" />
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/50">
        <Sparkles className="h-2.5 w-2.5" />
        Generated by Orin · {new Date(brief.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </button>
  );
}

function BriefDetail({ brief, onBack }: { brief: OrinBrief; onBack: () => void }) {
  const regenerate = useRegenerateBrief();
  const content = brief.content;

  if (brief.status === "failed") {
    return (
      <div className="animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to archive
        </button>
        <div className="text-center py-12">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">This brief failed to generate.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => regenerate.mutate(brief)} disabled={regenerate.isPending}>
            {regenerate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isQuarterly = brief.period_type === "quarterly";

  return (
    <article className="space-y-10 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to archive
        </button>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => regenerate.mutate(brief)} disabled={regenerate.isPending}>
          {regenerate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Regenerate
        </Button>
      </div>

      {/* Header */}
      <div className="border-l-2 border-primary/40 pl-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {brief.period_label} — {isQuarterly ? "Quarterly Deep Dive" : "Monthly Performance Brief"}
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-muted-foreground">
            Generated {new Date(brief.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="text-[10px] text-muted-foreground/50">•</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Prepared by Orin
          </span>
        </div>
      </div>

      {/* Headline */}
      {content?.headline && (
        <section>
          <SectionHeading icon={Sparkles} title="Headline" />
          <blockquote className="mt-4 border-l-2 border-primary/50 pl-5 py-3 bg-primary/5 rounded-r-lg">
            <p className="text-sm text-foreground/90 leading-relaxed italic">"{content.headline}"</p>
          </blockquote>
        </section>
      )}

      {/* Snapshot */}
      {content?.snapshot && (
        <section>
          <SectionHeading icon={Building2} title="Portfolio Snapshot" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <SnapshotCard label="Total Revenue" value={content.snapshot.total_revenue} />
            <SnapshotCard label="ADR" value={content.snapshot.adr} />
          </div>
          {content.snapshot.occupancy_note && (
            <p className="text-xs text-muted-foreground mt-3">{content.snapshot.occupancy_note}</p>
          )}
          {content.snapshot.vs_last_year && (
            <p className="text-xs text-muted-foreground mt-1">vs last year: {content.snapshot.vs_last_year}</p>
          )}
        </section>
      )}

      {/* Monthly Trend (quarterly only) */}
      {isQuarterly && content?.monthly_trend && (
        <section>
          <SectionHeading icon={TrendingUp} title="Monthly Revenue Trend" />
          <div className="mt-4 space-y-2">
            {content.monthly_trend.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/10 border border-border/10">
                <span className="text-sm text-foreground font-medium">{m.month}</span>
                <span className="text-sm text-foreground font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{m.revenue}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Properties */}
      {content?.top_properties && (
        <section>
          <SectionHeading icon={TrendingUp} title="Top Properties" />
          <div className="mt-4 space-y-2">
            {content.top_properties.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/10 border border-border/10">
                <div>
                  <span className="text-sm text-foreground font-medium">{p.name}</span>
                  {p.note && <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>}
                </div>
                <span className="text-sm text-foreground font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{p.revenue}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Watch List */}
      {content?.watch_list && content.watch_list.length > 0 && (
        <section>
          <SectionHeading icon={AlertTriangle} title="Watch List" />
          <div className="space-y-2 mt-4">
            {content.watch_list.map((w: any, i: number) => (
              <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-border/15 bg-secondary/10">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{w.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.issue}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Owner Rankings (quarterly) */}
      {isQuarterly && content?.owner_rankings && (
        <section>
          <SectionHeading icon={Eye} title="Owner Rankings" />
          <div className="mt-4 space-y-2">
            {content.owner_rankings.map((o: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/10 border border-border/10">
                <span className="text-sm text-foreground font-medium">{o.name}</span>
                <span className="text-sm text-foreground font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{o.revenue}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Location Performance (quarterly) */}
      {isQuarterly && content?.location_performance && (
        <section>
          <SectionHeading icon={Building2} title="Location Performance" />
          <div className="mt-4 space-y-2">
            {content.location_performance.map((l: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/10 border border-border/10">
                <div>
                  <span className="text-sm text-foreground font-medium">{l.group}</span>
                  <span className="text-xs text-muted-foreground ml-2">{l.bookings} bookings</span>
                </div>
                <span className="text-sm text-foreground font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{l.revenue}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Platform Breakdown */}
      {content?.platform_breakdown && (
        <section>
          <SectionHeading icon={BarChart3} title="Booking Source Breakdown" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(content.platform_breakdown).map(([platform, pct]) => (
              <div key={platform} className="px-4 py-2.5 rounded-lg bg-secondary/10 border border-border/10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {platform.replace(/_/g, ".")}
                </p>
                <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{pct as string}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seasonal Commentary (quarterly) */}
      {isQuarterly && content?.seasonal_commentary && (
        <section>
          <SectionHeading icon={Calendar} title="Seasonal Analysis" />
          <div className="mt-4 border-l-2 border-accent/40 pl-5 py-3 bg-accent/5 rounded-r-lg">
            <p className="text-sm text-foreground/90 leading-relaxed">{content.seasonal_commentary}</p>
          </div>
        </section>
      )}

      {/* Forward Outlook (quarterly) */}
      {isQuarterly && content?.forward_outlook && (
        <section>
          <SectionHeading icon={TrendingUp} title="Forward Outlook" />
          <div className="mt-4 border-l-2 border-primary/40 pl-5 py-3 bg-primary/5 rounded-r-lg">
            <p className="text-sm text-foreground/90 leading-relaxed">{content.forward_outlook}</p>
          </div>
        </section>
      )}

      {/* Commentary */}
      {content?.commentary && (
        <section>
          <SectionHeading icon={Sparkles} title="Orin's Analysis" />
          <blockquote className="mt-4 border-l-2 border-primary/50 pl-5 py-3 bg-primary/5 rounded-r-lg">
            <p className="text-sm text-foreground/90 leading-relaxed italic">"{content.commentary}"</p>
          </blockquote>
        </section>
      )}

      {/* Lead Time */}
      {content?.avg_lead_time && (
        <p className="text-xs text-muted-foreground">Average booking lead time: {content.avg_lead_time}</p>
      )}

      {/* Raw text fallback */}
      {content?.raw_text && !content?.headline && (
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{content.raw_text}</p>
        </div>
      )}
    </article>
  );
}

/* ── Sub-components ── */

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
    </div>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{label}</p>
      <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
    </div>
  );
}
