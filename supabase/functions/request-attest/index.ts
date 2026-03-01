// BloodSheet Golf — Attest Request Edge Function
// Sends attestation request emails via Resend to players in a match.
//
// Deploy: supabase functions deploy request-attest
// Secret:  supabase secrets set RESEND_API_KEY=re_2DWtj2Ke_JWEYhz6Hn5PDo3copisMzA9p

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { matchId, targetUserId, appUrl } = await req.json();
    if (!matchId) {
      return new Response(JSON.stringify({ error: 'matchId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client to access auth.users emails
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the calling user is the match creator
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user: callerUser } } = await anonClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch match + course details
    const { data: matchRow } = await admin
      .from('matches')
      .select('*, courses(name)')
      .eq('id', matchId)
      .single();

    if (!matchRow) {
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure caller is the match creator
    if (matchRow.created_by !== callerUser.id) {
      return new Response(JSON.stringify({ error: 'Only the match creator can send attest requests' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch scorekeeper's name
    const { data: keeperProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', callerUser.id)
      .single();
    const scorekeeperName = (keeperProfile as { full_name: string } | null)?.full_name ?? 'Your scorekeeper';

    // Determine which players to email
    // Exclude the scorekeeper (match creator) and guests (guest_name IS NOT NULL means guest)
    let query = admin
      .from('match_players')
      .select('user_id')
      .eq('match_id', matchId)
      .neq('user_id', callerUser.id)
      .is('guest_name', null); // guests have no real auth account

    if (targetUserId) {
      // Reminder mode: only target a specific player
      query = query.eq('user_id', targetUserId);
    }

    const { data: playerRows } = await query;
    if (!playerRows || playerRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const courseName = (matchRow as any).courses?.name ?? 'Unknown Course';
    const format = (matchRow as any).format ?? '';
    const wagerAmount = (matchRow as any).wager_amount ?? 0;
    const ledgerUrl = `${appUrl ?? 'https://bloodsheetgolf.com'}/ledger`;

    let sent = 0;

    for (const row of playerRows) {
      // Get auth user email (service role only)
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(row.user_id);
      if (!authUser?.email) continue; // guest or invalid user — skip

      const { data: recipientProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', row.user_id)
        .single();
      const recipientFirstName = ((recipientProfile as { full_name: string } | null)?.full_name ?? 'Golfer').split(' ')[0];

      const isReminder = Boolean(targetUserId);
      const subject = isReminder
        ? `[BloodSheet Golf] Reminder: Your signature is still needed`
        : `[BloodSheet Golf] Your signature is needed`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="background:#1C1C1E;color:#fff;font-family:sans-serif;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;">
    <h1 style="color:#FF003F;font-size:22px;margin-bottom:4px;">BloodSheet Golf</h1>
    <p style="color:#999;font-size:12px;margin-top:0;">Match Attestation${isReminder ? ' — Reminder' : ''}</p>

    <p style="font-size:16px;">Hey ${recipientFirstName},</p>
    <p style="font-size:15px;line-height:1.5;">
      <strong>${scorekeeperName}</strong> needs you to attest the scores from your round${isReminder ? ' (this is a reminder)' : ''}.
    </p>

    <div style="background:#2C2C2E;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Match Details</p>
      <p style="margin:4px 0;font-size:15px;"><strong>Course:</strong> ${courseName}</p>
      <p style="margin:4px 0;font-size:15px;"><strong>Format:</strong> ${format.toUpperCase()}</p>
      <p style="margin:4px 0;font-size:15px;"><strong>Wager:</strong> $${wagerAmount}</p>
    </div>

    <p style="font-size:14px;color:#ccc;line-height:1.5;">
      One tap to confirm the scores are correct and make the round official.
    </p>

    <a href="${ledgerUrl}"
       style="display:block;background:#FF003F;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:900;font-size:16px;letter-spacing:0.1em;text-transform:uppercase;margin:24px 0;">
      Attest Scores
    </a>

    <p style="font-size:12px;color:#666;text-align:center;">BloodSheet Golf • match ledger</p>
  </div>
</body>
</html>`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'BloodSheet Golf <onboarding@resend.dev>',
          to: [authUser.email],
          subject,
          html: emailHtml,
        }),
      });

      if (resendRes.ok) sent++;
      else {
        const errText = await resendRes.text();
        console.error(`[request-attest] Resend error for ${authUser.email}:`, errText);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[request-attest] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
