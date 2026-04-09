import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { interval_hours } = await req.json();
    const hours = parseInt(interval_hours, 10);

    const { error } = await supabase.rpc("manage_hostaway_cron", {
      interval_hours: isNaN(hours) || hours <= 0 ? 0 : hours,
      supabase_url: Deno.env.get("SUPABASE_URL")!,
      anon_key: Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, interval_hours: hours }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron management error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
