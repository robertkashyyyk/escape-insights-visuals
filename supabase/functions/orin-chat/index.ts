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
    // Admin/super/senior scope — enriched portfolio context
    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;
    const yearStartDate = new Date(`${currentYear}-01-01`);
    const priorYearStart = `${priorYear}-01-01`;
    // Same period last year: Jan 1 PY → same MM-DD as today, PY
    const sameDayPriorYear = new Date(now);
    sameDayPriorYear.setFullYear(priorYear);
    const priorYearSamePeriodEnd = sameDayPriorYear.toISOString().slice(0, 10);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);
    const lyMonthStart = new Date(priorYear, now.getMonth(), 1).toISOString().slice(0, 10);
    const lyMonthEnd = new Date(priorYear, now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const next30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const next60 = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
    const next90 = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);

    const { data: listings } = await admin
      .from("listings")
      .select("id, name, bedrooms, location_group, owner_id, status, is_bundle, is_clean");

    const { data: owners } = await admin.from("property_owners").select("id, name");

    // Pull all confirmed reservations from start of prior year through next 90 days.
    // IMPORTANT: paginate — Supabase caps a single response at 1000 rows, and the
    // portfolio easily exceeds that across 18+ months of bookings.
    const allRes: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: pageErr } = await admin
        .from("reservations")
        .select("id, listing_id, check_in, check_out, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, platform, status")
        .eq("status", "confirmed")
        .gte("check_in", priorYearStart)
        .lte("check_in", next90)
        .order("check_in", { ascending: true })
        .range(from, from + PAGE - 1);
      if (pageErr) {
        console.error("orin-chat: reservations page error", pageErr);
        break;
      }
      if (!page || page.length === 0) break;
      allRes.push(...page);
      if (page.length < PAGE) break;
    }
    console.log(`orin-chat: loaded ${allRes.length} confirmed reservations`);
    const activeListings = (listings || []).filter((l: any) => !l.is_bundle);
    const activeListingIds = new Set(activeListings.map((l: any) => l.id));
    const activeListingCount = activeListings.length;

    const listingMap = Object.fromEntries((listings || []).map((l: any) => [l.id, l]));

    const nightsOf = (r: any) =>
      Math.max(0, (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);

    const sumRev = (rs: any[]) => rs.reduce((s, r) => s + getNetRevenue(r), 0);
    const sumNights = (rs: any[]) => rs.reduce((s, r) => s + nightsOf(r), 0);

    // Filter helpers (only count active, non-bundle listings for portfolio metrics)
    const inActive = (r: any) => activeListingIds.has(r.listing_id);

    // 1. Current YTD
    const ytdRes = allRes.filter((r: any) => inActive(r) && r.check_in >= yearStart && r.check_in <= todayStr);
    const revenueYtd = sumRev(ytdRes);
    const nightsYtd = sumNights(ytdRes);
    const daysElapsed = Math.max(
      1,
      Math.floor((now.getTime() - yearStartDate.getTime()) / 86400000) + 1
    );
    const occupancyYtd =
      activeListingCount > 0
        ? Math.round((nightsYtd / (activeListingCount * daysElapsed)) * 1000) / 10
        : 0;
    const adrYtd = nightsYtd > 0 ? Math.round(revenueYtd / nightsYtd) : 0;

    // 2. Prior year same period (Jan 1 → today's MM-DD, PY)
    const pyRes = allRes.filter(
      (r: any) => inActive(r) && r.check_in >= priorYearStart && r.check_in <= priorYearSamePeriodEnd
    );
    const revenuePy = sumRev(pyRes);
    const nightsPy = sumNights(pyRes);
    const occupancyPy =
      activeListingCount > 0
        ? Math.round((nightsPy / (activeListingCount * daysElapsed)) * 1000) / 10
        : 0;
    const adrPy = nightsPy > 0 ? Math.round(revenuePy / nightsPy) : 0;

    // 3. YoY variance
    const pct = (cur: number, prior: number) =>
      prior > 0 ? Math.round(((cur - prior) / prior) * 1000) / 10 : null;

    const yoyVariance = {
      revenue_pct: pct(revenueYtd, revenuePy),
      revenue_gbp: Math.round(revenueYtd - revenuePy),
      occupancy_pts: Math.round((occupancyYtd - occupancyPy) * 10) / 10,
      adr_pct: pct(adrYtd, adrPy),
      reservations_pct: pct(ytdRes.length, pyRes.length),
    };

    // 4. Revenue pacing — current month
    const monthRes = allRes.filter(
      (r: any) => inActive(r) && r.check_in >= monthStartStr && r.check_in <= monthEndStr
    );
    const monthActual = sumRev(monthRes.filter((r: any) => r.check_in <= todayStr));
    const monthBooked = sumRev(monthRes.filter((r: any) => r.check_in > todayStr));
    const monthTotal = monthActual + monthBooked;
    const lyMonthRes = allRes.filter(
      (r: any) => inActive(r) && r.check_in >= lyMonthStart && r.check_in <= lyMonthEnd
    );
    const lyMonthRev = sumRev(lyMonthRes);
    const daysRemaining = Math.max(
      0,
      Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000)
    );

    const revenuePacing = {
      current_month_name: now.toLocaleString("en-GB", { month: "long" }),
      current_month_actual: Math.round(monthActual),
      current_month_booked: Math.round(monthBooked),
      current_month_total: Math.round(monthTotal),
      same_month_last_year: Math.round(lyMonthRev),
      pacing_vs_ly_pct: pct(monthTotal, lyMonthRev),
      days_remaining_in_month: daysRemaining,
    };

    // 5. Pipeline (next 30/60/90 days, forward-looking)
    const futureRes = allRes.filter((r: any) => inActive(r) && r.check_in > todayStr);
    const inWindow = (r: any, end: string) => r.check_in <= end;
    const next30Res = futureRes.filter((r: any) => inWindow(r, next30));
    const next60Res = futureRes.filter((r: any) => inWindow(r, next60));
    const next90Res = futureRes.filter((r: any) => inWindow(r, next90));

    // Busiest week in next 90 days
    const weekBuckets: Record<string, { week_start: string; reservations: number; revenue: number }> = {};
    for (const r of next90Res) {
      const ci = new Date(r.check_in);
      const dow = ci.getUTCDay();
      const monday = new Date(ci);
      monday.setUTCDate(ci.getUTCDate() - ((dow + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!weekBuckets[key]) weekBuckets[key] = { week_start: key, reservations: 0, revenue: 0 };
      weekBuckets[key].reservations += 1;
      weekBuckets[key].revenue += getNetRevenue(r);
    }
    const busiestWeek = Object.values(weekBuckets)
      .map(w => ({ ...w, revenue: Math.round(w.revenue) }))
      .sort((a, b) => b.reservations - a.reservations)[0] || {
      week_start: todayStr,
      reservations: 0,
      revenue: 0,
    };

    const pipeline = {
      next_30_days_revenue: Math.round(sumRev(next30Res)),
      next_60_days_revenue: Math.round(sumRev(next60Res)),
      next_90_days_revenue: Math.round(sumRev(next90Res)),
      next_30_days_reservations: next30Res.length,
      busiest_week: busiestWeek,
    };

    // 6. Location group breakdown (YTD + YoY)
    const locMap: Record<string, { properties: Set<string>; ytdRes: any[]; pyRes: any[] }> = {};
    for (const l of activeListings) {
      const g = l.location_group || "Ungrouped";
      if (!locMap[g]) locMap[g] = { properties: new Set(), ytdRes: [], pyRes: [] };
      locMap[g].properties.add(l.id);
    }
    for (const r of ytdRes) {
      const g = listingMap[r.listing_id]?.location_group || "Ungrouped";
      if (locMap[g]) locMap[g].ytdRes.push(r);
    }
    for (const r of pyRes) {
      const g = listingMap[r.listing_id]?.location_group || "Ungrouped";
      if (locMap[g]) locMap[g].pyRes.push(r);
    }
    const locationBreakdown = Object.entries(locMap).map(([name, d]) => {
      const rev = sumRev(d.ytdRes);
      const nights = sumNights(d.ytdRes);
      const propCount = d.properties.size;
      const occ = propCount > 0 ? Math.round((nights / (propCount * daysElapsed)) * 1000) / 10 : 0;
      return {
        location_group: name,
        revenue_ytd: Math.round(rev),
        reservations_ytd: d.ytdRes.length,
        occupancy_pct: occ,
        property_count: propCount,
        yoy_revenue_pct: pct(rev, sumRev(d.pyRes)),
      };
    }).sort((a, b) => b.revenue_ytd - a.revenue_ytd);

    // 7. Owner breakdown (top 5)
    const ownerBreakdown = (owners || []).map((o: any) => {
      const oListingIds = activeListings.filter((l: any) => l.owner_id === o.id).map((l: any) => l.id);
      const oYtd = ytdRes.filter((r: any) => oListingIds.includes(r.listing_id));
      const oPy = pyRes.filter((r: any) => oListingIds.includes(r.listing_id));
      const rev = sumRev(oYtd);
      return {
        owner_name: o.name,
        property_count: oListingIds.length,
        revenue_ytd: Math.round(rev),
        yoy_revenue_pct: pct(rev, sumRev(oPy)),
      };
    }).sort((a, b) => b.revenue_ytd - a.revenue_ytd).slice(0, 5);

    // 8. Top + bottom properties
    const propStats = activeListings.map((l: any) => {
      const pYtd = ytdRes.filter((r: any) => r.listing_id === l.id);
      const pPy = pyRes.filter((r: any) => r.listing_id === l.id);
      const rev = sumRev(pYtd);
      const nights = sumNights(pYtd);
      const occ = Math.round((nights / daysElapsed) * 1000) / 10;
      const adr = nights > 0 ? Math.round(rev / nights) : 0;
      const lastBooking = pYtd.reduce((latest: string | null, r: any) => {
        return !latest || r.check_in > latest ? r.check_in : latest;
      }, null as string | null);
      const daysSince = lastBooking
        ? Math.floor((now.getTime() - new Date(lastBooking).getTime()) / 86400000)
        : null;
      return {
        name: l.name,
        location_group: l.location_group || "Ungrouped",
        revenue_ytd: Math.round(rev),
        occupancy_pct: occ,
        adr,
        yoy_revenue_pct: pct(rev, sumRev(pPy)),
        reservations: pYtd.length,
        days_since_last_booking: daysSince,
      };
    });

    const topProperties = [...propStats]
      .sort((a, b) => b.revenue_ytd - a.revenue_ytd)
      .slice(0, 5)
      .map(({ days_since_last_booking, reservations, ...p }) => p);

    const bottomProperties = [...propStats]
      .filter((p) => p.reservations > 0) // exclude brand-new listings
      .sort((a, b) => a.revenue_ytd - b.revenue_ytd)
      .slice(0, 5)
      .map(({ adr, yoy_revenue_pct, reservations, ...p }) => p);

    // 9. Cleaning today
    const { data: todayCleans } = await admin
      .from("clean_tasks")
      .select("status, assigned_cleaner_id, is_same_day_turnaround")
      .eq("scheduled_date", todayStr);
    const cleansArr = todayCleans || [];
    const dirtyCount = (listings || []).filter((l: any) => l.is_clean === false && l.status === "active").length;
    const cleaningToday = {
      total_cleans: cleansArr.length,
      completed: cleansArr.filter((c: any) => c.status === "completed").length,
      pending: cleansArr.filter((c: any) => c.status !== "completed").length,
      same_day_turnarounds: cleansArr.filter((c: any) => c.is_same_day_turnaround).length,
      unassigned: cleansArr.filter((c: any) => !c.assigned_cleaner_id).length,
      needs_cleaning_count: dirtyCount,
    };

    // 10. Cancellations (last 30 days, enriched with location split)
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: cancelledRes } = await admin
      .from("reservations")
      .select("listing_id, check_in, total_amount, host_payout, cleaning_fee, channel_commission, tax_amount, reservation_date")
      .eq("status", "cancelled")
      .gte("check_in", thirtyAgo);
    const cancelledArr = cancelledRes || [];
    const confirmedLast30 = allRes.filter(
      (r: any) => r.check_in >= thirtyAgo && r.check_in <= todayStr
    ).length;
    const totalLast30 = confirmedLast30 + cancelledArr.length;
    const cancRate = totalLast30 > 0 ? Math.round((cancelledArr.length / totalLast30) * 1000) / 10 : 0;
    let leadSum = 0; let leadCount = 0;
    const locCanc: Record<string, { count: number; revenue_lost: number }> = {};
    for (const r of cancelledArr) {
      const lg = listingMap[r.listing_id]?.location_group || "Ungrouped";
      if (!locCanc[lg]) locCanc[lg] = { count: 0, revenue_lost: 0 };
      locCanc[lg].count += 1;
      locCanc[lg].revenue_lost += getNetRevenue(r);
      if (r.reservation_date && r.check_in) {
        const lead = (new Date(r.check_in).getTime() - new Date(r.reservation_date).getTime()) / 86400000;
        if (!isNaN(lead) && lead >= 0) { leadSum += lead; leadCount += 1; }
      }
    }
    const cancellations = {
      last_30_days_count: cancelledArr.length,
      last_30_days_revenue_lost: Math.round(sumRev(cancelledArr)),
      cancellation_rate_pct: cancRate,
      avg_lead_time_days: leadCount > 0 ? Math.round(leadSum / leadCount) : null,
      by_location: Object.entries(locCanc)
        .map(([location_group, d]) => ({ location_group, count: d.count, revenue_lost: Math.round(d.revenue_lost) }))
        .sort((a, b) => b.count - a.count),
    };

    // 11. Today
    const checkoutsToday = allRes.filter((r: any) => r.check_out === todayStr).length;
    const checkinsToday = allRes.filter((r: any) => r.check_in === todayStr).length;
    const { count: openIssuesCount } = await admin
      .from("clean_issues")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    dataContext = {
      user_role: "admin",
      current_page: current_page || "unknown",
      current_year: {
        year: currentYear,
        revenue_ytd: Math.round(revenueYtd),
        reservations_ytd: ytdRes.length,
        nights_booked_ytd: nightsYtd,
        occupancy_pct: occupancyYtd,
        adr: adrYtd,
        active_listings: activeListingCount,
      },
      prior_year_same_period: {
        year: priorYear,
        revenue: Math.round(revenuePy),
        reservations: pyRes.length,
        nights_booked: nightsPy,
        occupancy_pct: occupancyPy,
        adr: adrPy,
      },
      yoy_variance: yoyVariance,
      revenue_pacing: revenuePacing,
      pipeline,
      location_breakdown: locationBreakdown,
      owner_breakdown: ownerBreakdown,
      top_properties: topProperties,
      bottom_properties: bottomProperties,
      cleaning_today: cleaningToday,
      cancellations,
      today: {
        date: todayStr,
        checkouts_today: checkoutsToday,
        checkins_today: checkinsToday,
        open_issues: openIssuesCount ?? 0,
      },
    };
  }

  // Build system prompt
  const roleDesc =
    role === "client"
      ? `a property owner named "${dataContext.owner_name}" who owns ${dataContext.properties?.length || 0} properties managed by Escape Ordinary`
      : `an admin/manager at Escape Ordinary who manages ${dataContext.current_year?.active_listings ?? 0} active properties`;

  const ownerGuardrail =
    role === "client"
      ? `
CRITICAL OWNER GUARDRAILS:
- You must NEVER reference other owners, other properties not in this context, or portfolio-wide totals.
- If asked about anything outside this owner's properties, respond: "I can only see data for your own properties. For questions about the wider portfolio or operations, please reach out to your management team at Escape Ordinary."
- NEVER reveal management fees, agency revenue, cleaning operations, cleaner names, or operational data.
- You may discuss general STR market knowledge if asked (not data-dependent).`
      : "";

  const adminDataGuide = role === "client" ? "" : `

YOUR DATA: You have been given a structured data context containing:
- current_year: YTD performance (revenue, reservations, nights, occupancy_pct, ADR, active_listings)
- prior_year_same_period: same Jan 1 → today's MM-DD window for the prior year — use this for direct YoY comparison
- yoy_variance: pre-calculated revenue % / £, occupancy point change, ADR %, reservations %
- revenue_pacing: current month actual + booked + total + same month last year + pacing_vs_ly_pct + days_remaining
- pipeline: confirmed revenue for the next 30/60/90 days, plus the busiest week
- location_breakdown: per location group — revenue, reservations, occupancy, property count, YoY %
- owner_breakdown: top 5 owners by revenue YTD with YoY %
- top_properties / bottom_properties: top + bottom 5 by revenue YTD
- cleaning_today: cleans scheduled today (total, completed, pending, same-day turnarounds, unassigned, dirty count)
- cancellations: separate from confirmed metrics — last 30 days count, revenue lost, cancellation rate %, avg lead time, by location
- today: date, checkouts, checkins, open issues

HOW TO ANSWER:
- Always use the data provided. NEVER say you do not have access to data that is in the context.
- For YoY questions: cite yoy_variance AND prior_year_same_period.
- For pacing questions: cite revenue_pacing (lead with month total vs same month LY).
- For pipeline / "next 30 days" questions: cite pipeline.
- For location questions: cite location_breakdown.
- For property-specific summary questions: cite top_properties / bottom_properties.
- For cleaning questions: cite cleaning_today.
- For cancellation questions: cite cancellations — always keep separate from revenue/occupancy.
- Format currency as £X,XXX. Percentages to 1 decimal place.
- Lead with the number, then the context. Be direct and specific.
- If asked for individual property operational details (boiler location, access codes, cleaning quirks), say: "I have summary performance data but not individual property operational details yet — the Property Knowledge system will unlock that."`;

  const systemPrompt = `You are Orin, the portfolio intelligence assistant for Escape Grids — a short-term rental management platform.
You are answering a question for: ${roleDesc}.
${ownerGuardrail}${adminDataGuide}

STRICT RULES:
1. You can ONLY reference data provided in the context JSON below. Do not invent figures.
2. Be concise, analytical, and direct. No filler phrases like "Great question!" or "Certainly!"
3. Format responses clearly — use bullet points or short paragraphs. Never use tables (they do not render well in chat).
4. If a specific number is genuinely missing from the context, say so plainly. Do not guess.
5. Tone: Senior analyst. Crisp. Insightful. Not chatty. Not hedging.
6. Use £ for currency. Format numbers with commas (e.g. £14,200). Percentages to 1dp.
7. The user is currently viewing: ${current_page || "unknown page"}. Use this for contextual awareness.

CANCELLATION DATA: Use the separate cancellations block when the user asks about cancellations, lost revenue, or booking reliability. Proactively flag if cancellation_rate_pct > 5% or avg_lead_time_days < 7. Never roll cancellations into confirmed revenue/occupancy — frame as "revenue at risk" or "bookings lost".

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
