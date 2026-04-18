import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  issueId: string;
  propertyName: string;
  issueType: string;
  description: string;
  reportedBy: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as Payload;
    if (!body.issueId || !body.propertyName || !body.issueType || !body.description) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all super/senior user IDs
    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['super', 'senior']);
    if (roleErr) throw roleErr;
    const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'No managers found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get emails from auth.users
    const emails: string[] = [];
    for (const uid of userIds) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) emails.push(u.user.email);
    }
    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'No emails found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = req.headers.get('origin') || 'https://escapegrids.com';
    const link = `${appUrl}/today`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;border-radius:6px;margin-bottom:24px;">
          <h1 style="margin:0 0 4px;font-size:18px;color:#991b1b;">🚨 Urgent Issue Reported</h1>
          <p style="margin:0;font-size:13px;color:#7f1d1d;">A cleaner has flagged an urgent issue requiring immediate attention.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Property</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(body.propertyName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Issue Type</td><td style="padding:8px 0;">${escapeHtml(body.issueType)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Reported By</td><td style="padding:8px 0;">${escapeHtml(body.reportedBy)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:14px;background:#f9fafb;border-radius:6px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Description</div>
          <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(body.description)}</div>
        </div>
        <div style="margin-top:28px;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">View on Escape Grids</a>
        </div>
        <p style="margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;">Escape Grids · Operational Alert</p>
      </div>
    `;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Escape Grids Alerts <alerts@escapegrids.com>',
        to: emails,
        subject: `🚨 Urgent: ${body.issueType} at ${body.propertyName}`,
        html,
      }),
    });

    const result = await resp.json();
    if (!resp.ok) {
      console.error('Resend error:', result);
      return new Response(JSON.stringify({ error: 'Resend failed', details: result }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: emails.length, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-urgent-issue error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
