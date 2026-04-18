import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PeriodRequest {
  period_type: "monthly" | "quarterly";
  period_label: string;
  period_start: string;
  period_end: string;
  force?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body: PeriodRequest | { periods: PeriodRequest[] } = await req.json();
    const periods = "periods" in body ? body.periods : [body];
    const results: any[] = [];

    for (const period of periods) {
      const { period_type, period_label, period_start, period_end, force } = period;

      // Check if already exists
      if (!force) {
        const { data: existing } = await admin
          .from("orin_briefs")
          .select("id, status")
          .eq("period_type", period_type)
          .eq("period_label", period_label)
          .maybeSingle();
        if (existing && existing.status === "generated") {
          results.push({ period_label, status: "already_exists" });
          continue;
        }
      }

      // Upsert as generating
      await admin.from("orin_briefs").upsert({
        period_type,
        period_label,
        period_start,
        period_end,
        status: "generating",
        content: null,
        generated_at: new Date().toISOString(),
      }, { onConflict: "period_type,period_label" });

      // Fetch reservation data for the period
      const { data: reservations } = await admin
        .from("reservations")
        .select("*, listing:listings(name, city, location_group, owner_id, bedrooms)")
        .gte("check_in", period_start)
        .lt("check_in", period_end)
        .eq("status", "confirmed");

      if (!reservations || reservations.length === 0) {
        await admin.from("orin_briefs").update({ status: "failed", content: { error: "No reservation data for this period" } })
          .eq("period_type", period_type).eq("period_label", period_label);
        results.push({ period_label, status: "no_data" });
        continue;
      }

      // Fetch same period last year for comparison
      const startDate = new Date(period_start);
      const endDate = new Date(period_end);
      const lyStart = new Date(startDate);
      lyStart.setFullYear(lyStart.getFullYear() - 1);
      const lyEnd = new Date(endDate);
      lyEnd.setFullYear(lyEnd.getFullYear() - 1);

      const { data: lyReservations } = await admin
        .from("reservations")
        .select("*, listing:listings(name, city, location_group, owner_id)")
        .gte("check_in", lyStart.toISOString().slice(0, 10))
        .lt("check_in", lyEnd.toISOString().slice(0, 10))
        .eq("status", "confirmed");

      // Fetch owners
      const { data: owners } = await admin.from("property_owners").select("id, name");
      const ownerMap = Object.fromEntries((owners || []).map(o => [o.id, o.name]));

      // Fetch listings for property count
      const { data: listings } = await admin.from("listings").select("id, name, location_group").eq("status", "active");

      // Aggregate data
      const stats = aggregateData(reservations, ownerMap);
      const lyStats = lyReservations && lyReservations.length > 0 ? aggregateData(lyReservations, ownerMap) : null;

      // Build prompt
      const prompt = buildPrompt(period_type, period_label, period_start, period_end, stats, lyStats, listings?.length || 0);

      // Call AI
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are Orin, a sharp short-term rental revenue analyst. You write portfolio intelligence briefs. Your tone is analytical, direct, and specific. You sound like a senior revenue manager, not a chatbot. No corporate fluff. Use specific numbers. Be opinionated. Return your response as a JSON object with the structure specified in the user prompt.`,
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        await admin.from("orin_briefs").update({ status: "failed", content: { error: `AI error: ${aiResponse.status}` } })
          .eq("period_type", period_type).eq("period_label", period_label);
        results.push({ period_label, status: "ai_error" });
        continue;
      }

      const aiData = await aiResponse.json();
      let content: any;
      const rawContent = aiData.choices?.[0]?.message?.content || "";

      try {
        // Strip markdown code fences if present
        let jsonStr = rawContent.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        content = JSON.parse(jsonStr);
      } catch {
        content = { raw_text: rawContent };
      }

      await admin.from("orin_briefs").update({
        status: "generated",
        content,
        generated_at: new Date().toISOString(),
      }).eq("period_type", period_type).eq("period_label", period_label);

      results.push({ period_label, status: "generated" });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-orin-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getNetRevenue(r: any): number {
  if (!r) return 0;
  if (r.host_payout != null && Number(r.host_payout) > 0) return Number(r.host_payout);
  const total = Number(r.total_amount ?? 0);
  const cleaning = Number(r.cleaning_fee ?? 0);
  const commission = Number(r.channel_commission ?? 0);
  const tax = Number(r.tax_amount ?? 0);
  if (cleaning > 0 || commission > 0 || tax > 0) return Math.max(0, total - cleaning - commission - tax);
  return total;
}

function aggregateData(reservations: any[], ownerMap: Record<string, string>) {
  const totalRevenue = reservations.reduce((s, r) => s + getNetRevenue(r), 0);
  const totalNights = reservations.reduce((s, r) => {
    const ci = new Date(r.check_in);
    const co = new Date(r.check_out);
    return s + Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }, 0);
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
  const avgLeadDays = reservations.reduce((s, r) => s + (r.booking_lead_days || 0), 0) / (reservations.length || 1);

  // Platform breakdown
  const platforms: Record<string, number> = {};
  reservations.forEach(r => {
    const p = r.platform || "Unknown";
    platforms[p] = (platforms[p] || 0) + getNetRevenue(r);
  });

  // Property performance
  const propRevenue: Record<string, { name: string; revenue: number; nights: number }> = {};
  reservations.forEach(r => {
    const name = r.listing?.name || "Unknown";
    if (!propRevenue[name]) propRevenue[name] = { name, revenue: 0, nights: 0 };
    propRevenue[name].revenue += getNetRevenue(r);
    const ci = new Date(r.check_in);
    const co = new Date(r.check_out);
    propRevenue[name].nights += Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
  });
  const propList = Object.values(propRevenue).sort((a, b) => b.revenue - a.revenue);
  const propByOccupancy = Object.values(propRevenue).sort((a, b) => a.nights - b.nights);

  // Owner performance
  const ownerRevenue: Record<string, { name: string; revenue: number }> = {};
  reservations.forEach(r => {
    const oid = r.listing?.owner_id;
    if (!oid) return;
    const oname = ownerMap[oid] || "Unknown";
    if (!ownerRevenue[oid]) ownerRevenue[oid] = { name: oname, revenue: 0 };
    ownerRevenue[oid].revenue += getNetRevenue(r);
  });
  const ownerList = Object.values(ownerRevenue).sort((a, b) => b.revenue - a.revenue);

  // Location group
  const locationRevenue: Record<string, { revenue: number; nights: number; bookings: number }> = {};
  reservations.forEach(r => {
    const lg = r.listing?.location_group || r.listing?.city || "Other";
    if (!locationRevenue[lg]) locationRevenue[lg] = { revenue: 0, nights: 0, bookings: 0 };
    locationRevenue[lg].revenue += getNetRevenue(r);
    locationRevenue[lg].bookings += 1;
    const ci = new Date(r.check_in);
    const co = new Date(r.check_out);
    locationRevenue[lg].nights += Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
  });

  // Monthly breakdown (for quarterly)
  const monthlyRevenue: Record<string, number> = {};
  reservations.forEach(r => {
    const m = r.check_in?.slice(0, 7); // YYYY-MM
    if (m) monthlyRevenue[m] = (monthlyRevenue[m] || 0) + getNetRevenue(r);
  });

  return {
    totalRevenue: Math.round(totalRevenue),
    totalBookings: reservations.length,
    totalNights,
    adr: Math.round(adr),
    avgLeadDays: Math.round(avgLeadDays),
    platforms,
    topProperties: propList.slice(0, 3),
    bottomProperties: propByOccupancy.slice(0, 3),
    topOwners: ownerList.slice(0, 3),
    locationBreakdown: locationRevenue,
    monthlyRevenue,
  };
}

function buildPrompt(
  periodType: string,
  periodLabel: string,
  periodStart: string,
  periodEnd: string,
  stats: any,
  lyStats: any | null,
  activePropertyCount: number
) {
  const lyComparison = lyStats
    ? `\n\nSame period last year comparison:\n- Revenue: £${lyStats.totalRevenue.toLocaleString()}\n- Bookings: ${lyStats.totalBookings}\n- ADR: £${lyStats.adr}\n- Total nights: ${lyStats.totalNights}`
    : "\n\nNo data available for the same period last year.";

  const base = `Generate a ${periodType} portfolio intelligence brief for ${periodLabel} (${periodStart} to ${periodEnd}).

Here is the actual data for this period:
- Total Revenue: £${stats.totalRevenue.toLocaleString()}
- Total Bookings: ${stats.totalBookings}
- Total Nights Sold: ${stats.totalNights}
- ADR (Average Daily Rate): £${stats.adr}
- Average Booking Lead Time: ${stats.avgLeadDays} days
- Active Properties: ${activePropertyCount}
${lyComparison}

Platform Breakdown: ${JSON.stringify(stats.platforms)}

Top 3 Properties by Revenue: ${JSON.stringify(stats.topProperties)}

Bottom 3 Properties by Occupancy (lowest nights): ${JSON.stringify(stats.bottomProperties)}

Top 3 Owners by Revenue: ${JSON.stringify(stats.topOwners)}

Location Group Performance: ${JSON.stringify(stats.locationBreakdown)}

Monthly Revenue Trend: ${JSON.stringify(stats.monthlyRevenue)}`;

  if (periodType === "monthly") {
    return `${base}

Return a JSON object with this exact structure:
{
  "headline": "One sentence summary of the month",
  "snapshot": { "total_revenue": "£X", "adr": "£X", "occupancy_note": "text", "vs_last_year": "text" },
  "top_properties": [{ "name": "...", "revenue": "£X", "note": "..." }],
  "watch_list": [{ "name": "...", "issue": "..." }],
  "platform_breakdown": { "airbnb": "X%", "booking_com": "X%", "direct": "X%", "other": "X%" },
  "avg_lead_time": "X days",
  "commentary": "One paragraph of sharp, analytical narrative. No fluff. Be specific with numbers and property names."
}`;
  }

  return `${base}

Return a JSON object with this exact structure:
{
  "headline": "One sentence summary of the quarter",
  "snapshot": { "total_revenue": "£X", "adr": "£X", "occupancy_note": "text", "vs_last_year": "text" },
  "monthly_trend": [{ "month": "...", "revenue": "£X" }],
  "top_properties": [{ "name": "...", "revenue": "£X", "note": "..." }],
  "watch_list": [{ "name": "...", "issue": "..." }],
  "owner_rankings": [{ "name": "...", "revenue": "£X" }],
  "location_performance": [{ "group": "...", "revenue": "£X", "bookings": X, "avg_night_revenue": "£X" }],
  "platform_breakdown": { "airbnb": "X%", "booking_com": "X%", "direct": "X%", "other": "X%" },
  "seasonal_commentary": "How this quarter compared to the same quarter last year. Specific patterns and shifts.",
  "forward_outlook": "Based on the data, what should the team focus on next quarter. Be opinionated and specific.",
  "commentary": "One paragraph narrative tying it all together. Sharp and direct."
}`;
}
