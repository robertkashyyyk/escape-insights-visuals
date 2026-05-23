import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function priorityLabel(level: number | null | undefined): string {
  if (level === 0) return '🔴 URGENT — Arrival Risk';
  if (level === 1) return '🟠 Same-Day Turnaround';
  return 'Standard';
}

function formatTime(t: string | null | undefined): string {
  if (!t) return 'TBC';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(t);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { taskId } = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Missing taskId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: task, error: taskErr } = await admin
      .from('clean_tasks')
      .select('id, listing_id, scheduled_date, checkout_time, priority_level, assigned_cleaner_id, is_same_day_turnaround')
      .eq('id', taskId)
      .maybeSingle();
    if (taskErr) throw taskErr;
    if (!task) {
      return new Response(JSON.stringify({ sent: false, reason: 'task not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!task.assigned_cleaner_id) {
      return new Response(JSON.stringify({ sent: false, reason: 'no assigned cleaner' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: listing }, { data: cleaner }] = await Promise.all([
      admin.from('listings').select('name').eq('id', task.listing_id).maybeSingle(),
      admin.from('cleaners').select('name, email').eq('id', task.assigned_cleaner_id).maybeSingle(),
    ]);

    const propertyName = listing?.name ?? 'Property';
    const cleanerName = cleaner?.name ?? 'Cleaner';
    const cleanerEmail = cleaner?.email?.trim();
    const pLabel = priorityLabel(task.priority_level);
    const coTime = formatTime(task.checkout_time);
    const dateStr = task.scheduled_date;

    if (!cleanerEmail) {
      console.log('notify-cleaner-schedule-update: no cleaner email for task', taskId);
      return new Response(JSON.stringify({ sent: false, reason: 'no cleaner email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch manager emails
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['super', 'senior']);
    const managerIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    const managerEmails: string[] = [];
    for (const uid of managerIds) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) managerEmails.push(u.user.email);
    }

    const FROM = 'Escape Grids Scheduling <scheduling@escapegrids.com>';

    const cleanerHtml = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">
        <div style="background:#fffbeb;border-left:4px solid #d97706;padding:16px 20px;border-radius:6px;margin-bottom:24px;">
          <h1 style="margin:0 0 4px;font-size:18px;color:#92400e;">New clean added to your schedule</h1>
          <p style="margin:0;font-size:13px;color:#78350f;">A new property has been assigned to you.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Property</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(propertyName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Date</td><td style="padding:8px 0;">${escapeHtml(dateStr)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Start time</td><td style="padding:8px 0;">Clean from ${escapeHtml(coTime)} onwards</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Priority</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(pLabel)}</td></tr>
        </table>
        <div style="margin-top:28px;text-align:center;">
          <a href="https://escapegrids.com/cleaner/schedule" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">View My Schedule</a>
        </div>
        <p style="margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;">Escape Grids · Scheduling</p>
      </div>
    `;

    const cleanerResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [cleanerEmail],
        subject: `New clean added to your schedule — ${propertyName}, today`,
        html: cleanerHtml,
      }),
    });
    const cleanerResult = await cleanerResp.json();
    if (!cleanerResp.ok) console.error('Cleaner email failed:', cleanerResult);

    if (managerEmails.length > 0) {
      const managerHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">
          <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:16px 20px;border-radius:6px;margin-bottom:24px;">
            <h1 style="margin:0 0 4px;font-size:18px;color:#075985;">Auto-assigned clean</h1>
            <p style="margin:0;font-size:13px;color:#0c4a6e;">A cleaner has been auto-assigned to a new task.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Property</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(propertyName)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Cleaner</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(cleanerName)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Date</td><td style="padding:8px 0;">${escapeHtml(dateStr)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Priority</td><td style="padding:8px 0;">${escapeHtml(pLabel)}</td></tr>
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="https://escapegrids.com/operations/schedule" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">View Matrix</a>
          </div>
          <p style="margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;">Escape Grids · Scheduling</p>
        </div>
      `;
      const mgrResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: managerEmails,
          subject: `Auto-assigned: ${propertyName} → ${cleanerName}, today`,
          html: managerHtml,
        }),
      });
      if (!mgrResp.ok) {
        const r = await mgrResp.json();
        console.error('Manager email failed:', r);
      }
    }

    return new Response(
      JSON.stringify({ sent: true, cleaner_email: cleanerEmail, manager_count: managerEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('notify-cleaner-schedule-update error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
