import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Net (management) revenue: prefer hostPayout, else totalPrice minus fees
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

function buildCancellationContext(
  cancelled: any[],
  listings: any[],
  confirmedCount: number,
  periodStart: string
) {
  const listingMap = Object.fromEntries(listings.map((l: any) => [l.id, l.name]));
  const totalLost = cancelled.reduce((s, r) => s + getNetRevenue(r), 0);
  const byProp: Record<string, { name: string; count: number; revenue_lost: number }> = {};
  let leadSum = 0;
  let leadCount = 0;
  for (const r of cancelled) {
    const name = listingMap[r.listing_id] || "Unknown";
    if (!byProp[name]) byProp[name] = { name, count: 0, revenue_lost: 0 };
    byProp[name].count += 1;
    byProp[name].revenue_lost += getNetRevenue(r);
    if (r.reservation_date && r.check_in) {
      const lead = (new Date(r.check_in).getTime() - new Date(r.reservation_date).getTime()) / 86400000;
      if (!isNaN(lead) && lead >= 0) {
        leadSum += lead;
        leadCount += 1;
      }
    }
  }
  const totalBookings = confirmedCount + cancelled.length;
  const rate = totalBookings > 0 ? Math.round((cancelled.length / totalBookings) * 1000) / 10 : 0;
  return {
    period: "last_30_days",
    period_start: periodStart,
    total_cancelled: cancelled.length,
    revenue_lost: Math.round(totalLost),
    by_property: Object.values(byProp)
      .map(p => ({ ...p, revenue_lost: Math.round(p.revenue_lost) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    avg_lead_time_days: leadCount > 0 ? Math.round(leadSum / leadCount) : null,
    cancellation_rate_pct: rate,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = user.id;

  // Get user role
  const { data: roleData } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  const role = roleData?.role || "client";

  // Rate limiting
  const today = new Date().toISOString().slice(0, 10);
  const { count: msgCount } = await admin
    .from("orin_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", `${today}T00:00:00Z`);

  const limit = role === "super" || role === "senior" || role === "admin" ? 100 : 20;
  if ((msgCount ?? 0) >= limit) {
    return new Response(
      JSON.stringify({
        error: "You have reached today's Orin message limit. Your limit resets at midnight.",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse request
  const { question, current_page } = await req.json();
  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "Question is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Save user message
  await admin.from("orin_conversations").insert({
    user_id: userId,
    role: "user",
    content: question,
    current_page,
  });

  // Load last 10 messages for context
  const { data: history } = await admin
    .from("orin_conversations")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const conversationHistory = (history || []).reverse().map((m: any) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  // Build data context based on role
  let dataContext: any = {};
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = now.toISOString().slice(0, 10);

  if (role === "client") {
    // Owner scope — only their properties
    const { data: ownerRec } = await admin
      .from("property_owners")
      .select("id, name")
      .eq("user_id", userId)
      .single();

    if (!ownerRec) {
      return new Response(JSON.stringify({ error: "Owner record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: listings } = await admin
      .from("listings")
      .select("id, name, bedrooms, bathrooms, location_group, nightly_rate, status")
      .eq("owner_id", ownerRec.id);

    const listingIds = (listings || []).map((l: any) => l.id);

    const { data: reservations } = listingIds.length
      ? await admin
          .from("reservations")
          .select("id, listing_id, check_in, check_out, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, platform, status, guest_name")
          .in("listing_id", listingIds)
          .eq("status", "confirmed")
      : { data: [] };

    const allRes = reservations || [];
    const ytdRes = allRes.filter((r: any) => r.check_in >= yearStart && r.check_in <= todayStr);

    // Cancellations (last 30 days) — owner scope
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: cancelledRes } = listingIds.length
      ? await admin
          .from("reservations")
          .select("listing_id, check_in, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, reservation_date")
          .in("listing_id", listingIds)
          .eq("status", "cancelled")
          .gte("check_in", thirtyAgo)
      : { data: [] };
    const cancellations = buildCancellationContext(cancelledRes || [], listings || [], allRes.length, thirtyAgo);

    const propertyStats = (listings || []).map((l: any) => {
      const propRes = ytdRes.filter((r: any) => r.listing_id === l.id);
      const revenue = propRes.reduce((s: number, r: any) => s + getNetRevenue(r), 0);
      const totalNights = propRes.reduce((s: number, r: any) => {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        return s + Math.max(0, (co.getTime() - ci.getTime()) / 86400000);
      }, 0);
      const daysInYear = (now.getTime() - new Date(yearStart).getTime()) / 86400000;
      const occupancy = daysInYear > 0 ? Math.round((totalNights / daysInYear) * 100) / 100 : 0;
      const adr = totalNights > 0 ? Math.round(revenue / totalNights) : 0;
      const upcoming = allRes.filter(
        (r: any) => r.listing_id === l.id && r.check_in >= todayStr && r.status !== "cancelled"
      ).length;

      return {
        name: l.name,
        bedrooms: l.bedrooms,
        location_group: l.location_group,
        status: l.status,
        revenue_ytd: Math.round(revenue),
        occupancy_ytd: occupancy,
        adr_ytd: adr,
        upcoming_reservations: upcoming,
      };
    });

    const totalRevYtd = propertyStats.reduce((s: number, p: any) => s + p.revenue_ytd, 0);
    const avgOcc =
      propertyStats.length > 0
        ? Math.round(
            (propertyStats.reduce((s: number, p: any) => s + p.occupancy_ytd, 0) /
              propertyStats.length) *
              100
          ) / 100
        : 0;

    dataContext = {
      user_role: "owner",
      owner_name: ownerRec.name,
      properties: propertyStats,
      total_revenue_ytd: totalRevYtd,
      total_occupancy_ytd: avgOcc,
      current_month: now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
      current_page: current_page || "unknown",
      cancellations,
    };
  } else {
    // Admin/super/senior scope — all data
    const { data: listings } = await admin
      .from("listings")
      .select("id, name, bedrooms, location_group, owner_id, status");

    const { data: owners } = await admin.from("property_owners").select("id, name");

    const { data: reservations } = await admin
      .from("reservations")
      .select("id, listing_id, check_in, check_out, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, platform, status")
      .eq("status", "confirmed");

    const allRes = reservations || [];
    const ytdRes = allRes.filter((r: any) => r.check_in >= yearStart && r.check_in <= todayStr);
    const totalRevYtd = ytdRes.reduce((s: number, r: any) => s + getNetRevenue(r), 0);

    // Cancellations (last 30 days) — admin scope
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: cancelledRes } = await admin
      .from("reservations")
      .select("listing_id, check_in, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, reservation_date")
      .eq("status", "cancelled")
      .gte("check_in", thirtyAgo);
    const cancellations = buildCancellationContext(cancelledRes || [], listings || [], allRes.length, thirtyAgo);

    const totalNights = ytdRes.reduce((s: number, r: any) => {
      const ci = new Date(r.check_in);
      const co = new Date(r.check_out);
      return s + Math.max(0, (co.getTime() - ci.getTime()) / 86400000);
    }, 0);
    const daysInYear = (now.getTime() - new Date(yearStart).getTime()) / 86400000;
    const totalListings = (listings || []).length;
    const avgOcc =
      totalListings > 0 && daysInYear > 0
        ? Math.round((totalNights / (totalListings * daysInYear)) * 100) / 100
        : 0;

    // Owner portfolio summaries
    const ownerSummaries = (owners || []).map((o: any) => {
      const oListings = (listings || []).filter((l: any) => l.owner_id === o.id);
      const oListingIds = oListings.map((l: any) => l.id);
      const oRes = ytdRes.filter((r: any) => oListingIds.includes(r.listing_id));
      const rev = oRes.reduce((s: number, r: any) => s + getNetRevenue(r), 0);
      return { name: o.name, property_count: oListings.length, revenue_ytd: Math.round(rev) };
    });

    // Location group summaries
    const groups: Record<string, { count: number; revenue: number }> = {};
    for (const l of listings || []) {
      const g = l.location_group || "Ungrouped";
      if (!groups[g]) groups[g] = { count: 0, revenue: 0 };
      groups[g].count++;
      const gRes = ytdRes.filter((r: any) => r.listing_id === l.id);
      groups[g].revenue += gRes.reduce((s: number, r: any) => s + getNetRevenue(r), 0);
    }

    dataContext = {
      user_role: "admin",
      total_properties: totalListings,
      total_owners: (owners || []).length,
      total_revenue_ytd: Math.round(totalRevYtd),
      total_occupancy_ytd: avgOcc,
      total_reservations_ytd: ytdRes.length,
      owner_summaries: ownerSummaries,
      location_groups: Object.entries(groups).map(([name, d]) => ({
        name,
        properties: d.count,
        revenue_ytd: Math.round(d.revenue),
      })),
      current_month: now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
      current_page: current_page || "unknown",
      cancellations,
    };
  }

  // Build system prompt
  const roleDesc =
    role === "client"
      ? `a property owner named "${dataContext.owner_name}" who owns ${dataContext.properties?.length || 0} properties managed by Escape Ordinary`
      : `an admin/manager at Escape Ordinary who manages ${dataContext.total_properties} properties across ${dataContext.total_owners} owners`;

  const ownerGuardrail =
    role === "client"
      ? `
CRITICAL OWNER GUARDRAILS:
- You must NEVER reference other owners, other properties not in this context, or portfolio-wide totals.
- If asked about anything outside this owner's properties, respond: "I can only see data for your own properties. For questions about the wider portfolio or operations, please reach out to your management team at Escape Ordinary."
- NEVER reveal management fees, agency revenue, cleaning operations, cleaner names, or operational data.
- You may discuss general STR market knowledge if asked (not data-dependent).`
      : "";

  const systemPrompt = `You are Orin, an AI intelligence assistant for Escape Grids — a short-term rental management platform.
You are answering a question for: ${roleDesc}.

STRICT RULES:
1. You can ONLY reference data provided in the context JSON below. Do not invent figures.
2. ${ownerGuardrail}
3. Be concise, analytical, and direct. No filler phrases like "Great question!" or "Certainly!"
4. Format responses clearly — use bullet points or short paragraphs. Never use tables (they do not render well in chat).
5. If you do not have enough data to answer confidently, say so clearly rather than guessing.
6. Tone: Senior analyst. Crisp. Insightful. Not chatty.
7. Use £ for currency. Format numbers with commas (e.g. £14,200).
8. The user is currently viewing: ${current_page || "unknown page"}. Use this for contextual awareness.

Context data:
${JSON.stringify(dataContext, null, 2)}`;

  // Call AI with streaming
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(0, -1), // exclude the just-saved user msg since we add it below
    { role: "user", content: question },
  ];

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      stream: true,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI gateway error:", aiResponse.status, errText);

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add funds to continue using Orin." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "AI gateway error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // We need to capture the full response to save it, while also streaming to client.
  // Use a TransformStream to tee the response.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullResponse = "";

  (async () => {
    try {
      const reader = aiResponse.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Pass through to client
        await writer.write(value);

        // Also capture text for saving
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch {
            // partial JSON, ignore
          }
        }
      }
    } finally {
      await writer.close();

      // Save assistant response
      if (fullResponse.trim()) {
        await admin.from("orin_conversations").insert({
          user_id: userId,
          role: "assistant",
          content: fullResponse.trim(),
          current_page,
        });
      }
    }
  })();

  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
});
