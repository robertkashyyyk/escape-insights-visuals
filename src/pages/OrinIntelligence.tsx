import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Sparkles, TrendingUp, AlertTriangle, Target, BarChart3, Building2 } from "lucide-react";

const monthlyBrief = {
  title: "April 2026 Performance Brief",
  date: "Generated March 29, 2026",
  sections: [
    {
      heading: "Executive Summary",
      icon: Sparkles,
      content: `Revenue is up 8% year-over-year, reaching £142,300 against last April's £131,760. However, booking velocity for June has slowed significantly — we are currently 22% behind last year's pace for that month. Immediate attention to pricing strategy and promotional campaigns for the early summer window is recommended.`
    },
    {
      heading: "Revenue Analysis",
      icon: TrendingUp,
      content: `The portfolio generated £142,300 in gross revenue this month across 287 reservation nights. Average daily rate (ADR) climbed to £186, a 5.2% increase from last April's £177. Direct bookings accounted for 34% of revenue — up from 28% last year, reflecting improved brand positioning.\n\nNotably, properties in the coastal cluster outperformed inland units by 18% on a per-bedroom basis, driven by strong demand from Northern European travellers booking Easter getaways.`
    },
    {
      heading: "Occupancy & Demand",
      icon: BarChart3,
      content: `Portfolio-wide occupancy reached 74.2%, slightly below the 76.1% target. Three properties dragged the average down: Villa Serena (58%), Casa del Sol (61%), and Apartamento Brisa (63%). All three share a common pattern — they are priced within 5% of higher-rated competitors without offering comparable amenities.\n\nWeekend occupancy remains strong at 89%, while midweek fill rates hover at 64%. Consider introducing a midweek discount strategy for underperforming units.`
    },
    {
      heading: "Pricing Intelligence",
      icon: Building2,
      content: `Dynamic pricing adjustments contributed an estimated £8,400 in additional revenue this month. The algorithm identified 12 opportunities where rates were increased during high-demand periods, with an average uplift of £23 per night.\n\nHowever, minimum rate floors on 4 properties are set too aggressively — they prevented the system from capturing last-minute bookings during shoulder periods. I recommend reducing minimum rates by 12-15% on these units during the final 72-hour booking window.`
    },
    {
      heading: "Risk Flags",
      icon: AlertTriangle,
      content: `• June forward bookings are 22% behind last year's pace — this is the primary concern.\n• Two properties have received consecutive reviews below 4.2 stars. Guest complaints centre on cleanliness and check-in communication.\n• The Airbnb algorithm appears to be suppressing visibility on 3 listings with stale photos (last updated 8+ months ago).`
    },
    {
      heading: "Recommended Actions",
      icon: Target,
      content: `1. Launch a targeted email campaign for June availability, offering 10% early-bird discounts for bookings made before April 15.\n2. Schedule professional photography refreshes for the 3 flagged listings within the next 2 weeks.\n3. Reduce minimum rate floors on Villa Serena, Casa del Sol, Apartamento Brisa, and Penthouse Azul by 12% for last-minute windows.\n4. Investigate and resolve the cleanliness complaints — consider switching cleaning providers for the affected properties.\n5. Activate midweek pricing tiers (Mon-Thu) at 15% below weekend rates for properties below 65% midweek occupancy.`
    }
  ]
};

const quarterlyBrief = {
  title: "Q1 2026 Deep Dive",
  date: "Generated March 29, 2026",
  sections: [
    {
      heading: "Executive Summary",
      icon: Sparkles,
      content: `Q1 2026 closed at £398,200 in gross revenue — a 12.4% increase over Q1 2025's £354,300. The portfolio expanded by 3 units mid-quarter, contributing £28,100. On a like-for-like basis, growth was 4.5%, slightly below the 6% target. The gap is attributable to a weak January, where storm disruptions in the region caused 47 cancellations worth approximately £31,000 in lost revenue.`
    },
    {
      heading: "Revenue Analysis",
      icon: TrendingUp,
      content: `Monthly revenue trajectory: January £108,400 (down 3% YoY), February £127,500 (up 11% YoY), March £162,300 (up 18% YoY). The recovery arc from January's weather disruption was faster than historical precedent — typically taking 6-8 weeks, we achieved full recovery in 4 weeks.\n\nManagement fee revenue reached £59,730 (15% effective rate), up from £53,145 in Q1 2025. Two new management contracts at 18% commission rate improved the blended margin.`
    },
    {
      heading: "Occupancy & Demand",
      icon: BarChart3,
      content: `Quarterly occupancy averaged 68.3% across the portfolio. February was the standout month at 73.1%, buoyed by school holiday demand from the UK and German markets. The location group analysis reveals a widening performance gap: coastal properties averaged 74.2% occupancy while rural inland properties dropped to 59.8%.\n\nAverage length of stay increased from 4.2 nights to 4.8 nights — a positive trend that reduces turnover costs and cleaning overhead per revenue euro.`
    },
    {
      heading: "Market Positioning",
      icon: Building2,
      content: `Competitive analysis against 45 comparable properties in our regions shows we are positioned in the 72nd percentile for pricing and 68th percentile for guest ratings. The gap between pricing position and quality perception suggests we have room to improve amenities and service before the market pushes back on rates.\n\nDirect booking share grew from 24% (Q1 2025) to 31% (Q1 2026). Our cost per acquisition through direct channels is £8.40 versus £38.20 through OTAs — the channel shift contributed approximately £12,300 in saved commission fees.`
    },
    {
      heading: "Risk Flags",
      icon: AlertTriangle,
      content: `• Three properties consistently underperform their location group average by >15%. Recommend strategic review — consider repositioning, renovation, or contract renegotiation.\n• Currency exposure: 28% of bookings are from GBP-denominated markets. Sterling weakened 4% in Q1 — monitor for pricing sensitivity.\n• Regulatory risk: Two municipalities have announced new short-term rental licensing requirements effective Q3. Compliance costs estimated at £2,400 per property.`
    },
    {
      heading: "Strategic Recommendations",
      icon: Target,
      content: `1. Invest in amenity upgrades for the 3 underperforming properties (estimated ROI: 180% within 12 months based on comparable case studies).\n2. Accelerate the direct booking strategy — allocate budget for retargeting campaigns and loyalty incentives.\n3. Begin Q3 licensing compliance immediately to avoid disruption during peak season.\n4. Explore dynamic minimum-stay requirements: 3-night minimums during peak, 1-night during shoulder periods.\n5. Commission a professional market study for potential expansion into 2 adjacent regions showing >20% demand growth.`
    }
  ]
};

export default function OrinIntelligence() {
  const [view, setView] = useState<"monthly" | "quarterly">("monthly");
  const brief = view === "monthly" ? monthlyBrief : quarterlyBrief;

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Orin Intelligence</h1>
            <p className="text-sm text-muted-foreground">AI-powered portfolio analysis</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="mt-6 mb-8 inline-flex rounded-lg bg-secondary/60 p-1">
          {(["monthly", "quarterly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                view === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "monthly" ? "Monthly Brief" : "Quarterly Deep Dive"}
            </button>
          ))}
        </div>

        {/* Brief */}
        <article className="animate-fade-in">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">{brief.title}</h2>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs text-muted-foreground">{brief.date}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
              <Sparkles className="h-3 w-3" /> AI-Generated Brief
            </span>
          </div>

          <div className="space-y-8">
            {brief.sections.map((section) => (
              <section key={section.heading} className="border-l-2 border-primary/30 pl-5">
                <div className="flex items-center gap-2 mb-3">
                  <section.icon className="h-4 w-4 text-primary/70" />
                  <h3 className="text-base font-display font-semibold text-foreground">{section.heading}</h3>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line font-body">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </AppLayout>
  );
}
