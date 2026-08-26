// Standalone public release-notes page — served at /260826Update.
// Self-contained: its own scoped styles + theme tokens, no app chrome.

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.eg-update {
  --ground: #F6F8FB; --surface: #FFFFFF; --surface-2: #EEF2F8;
  --ink: #141B2B; --muted: #5A6579; --faint: #8A93A5;
  --border: #E2E7F0; --border-strong: #CDD5E3;
  --accent: #4361D8; --accent-soft: #E7ECFB;
  --amber: #B45309; --amber-soft: #FDF3E4; --amber-border: #F0D9B5;
  --emerald: #2F855A; --emerald-soft: #E4F1EA;
  --shadow: 0 1px 2px rgba(20,27,43,.04), 0 8px 24px -12px rgba(20,27,43,.10);
  min-height: 100vh; background: var(--ground); color: var(--ink);
  font-family: "IBM Plex Sans", system-ui, sans-serif; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .eg-update {
    --ground: #0E1421; --surface: #151D2D; --surface-2: #1C2637;
    --ink: #EAEEF6; --muted: #9BA6BA; --faint: #6B7688;
    --border: #263148; --border-strong: #33415C;
    --accent: #7C93F0; --accent-soft: #1E2A47;
    --amber: #E0A45C; --amber-soft: #2A2013; --amber-border: #4A3A1E;
    --emerald: #6FC79A; --emerald-soft: #14271C;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 30px -14px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] .eg-update {
  --ground: #0E1421; --surface: #151D2D; --surface-2: #1C2637;
  --ink: #EAEEF6; --muted: #9BA6BA; --faint: #6B7688;
  --border: #263148; --border-strong: #33415C;
  --accent: #7C93F0; --accent-soft: #1E2A47;
  --amber: #E0A45C; --amber-soft: #2A2013; --amber-border: #4A3A1E;
  --emerald: #6FC79A; --emerald-soft: #14271C;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 30px -14px rgba(0,0,0,.6);
}

.eg-update * { box-sizing: border-box; }
.eg-update .wrap { max-width: 780px; margin: 0 auto; padding: clamp(28px, 6vw, 64px) clamp(18px, 5vw, 32px) 80px; }
.eg-update .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
.eg-update h1 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: clamp(30px, 6vw, 46px); line-height: 1.04; letter-spacing: -.02em; text-wrap: balance; margin: 0 0 14px; }
.eg-update .lede { font-size: 17px; color: var(--muted); margin: 0; max-width: 60ch; }
.eg-update .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 30px 0 8px; }
.eg-update .stat { flex: 1 1 150px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.eg-update .stat .n { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 26px; line-height: 1; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.eg-update .stat .n.amber { color: var(--amber); }
.eg-update .stat .n.emerald { color: var(--emerald); }
.eg-update .stat .l { font-size: 12.5px; color: var(--muted); margin-top: 5px; }
.eg-update .rule { height: 1px; background: var(--border); border: 0; margin: 40px 0 34px; }
.eg-update .change { margin: 0 0 40px; }
.eg-update .change:last-child { margin-bottom: 0; }
.eg-update .head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; flex-wrap: wrap; }
.eg-update .idx { font-family: "IBM Plex Mono", monospace; font-size: 13px; color: var(--faint); font-variant-numeric: tabular-nums; padding-top: 3px; }
.eg-update h2 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 600; font-size: clamp(20px, 3.4vw, 25px); line-height: 1.15; letter-spacing: -.015em; margin: 0; flex: 1 1 auto; text-wrap: balance; }
.eg-update .tag { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; white-space: nowrap; align-self: flex-start; margin-top: 3px; }
.eg-update .tag.new { background: var(--accent-soft); color: var(--accent); }
.eg-update .tag.fix { background: var(--surface-2); color: var(--muted); }
.eg-update .tag.change { background: var(--surface-2); color: var(--muted); }
.eg-update .body-text { color: var(--ink); margin: 12px 0 0; }
.eg-update .body-text.sub { color: var(--muted); }
.eg-update ul.feat { list-style: none; padding: 0; margin: 14px 0 0; display: grid; gap: 9px; }
.eg-update ul.feat li { position: relative; padding-left: 22px; color: var(--ink); font-size: 15px; }
.eg-update ul.feat li::before { content: ""; position: absolute; left: 4px; top: 10px; width: 6px; height: 6px; border-radius: 2px; background: var(--accent); transform: rotate(45deg); }
.eg-update ul.feat li b { font-weight: 600; }
.eg-update .action { margin-top: 18px; background: var(--amber-soft); border: 1px solid var(--amber-border); border-radius: 12px; padding: 16px 18px; }
.eg-update .action .atitle { font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); font-weight: 500; display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.eg-update .action .atitle::before { content: "▲"; font-size: 9px; }
.eg-update ol.steps { margin: 0; padding-left: 0; list-style: none; counter-reset: s; display: grid; gap: 8px; }
.eg-update ol.steps li { position: relative; padding-left: 30px; font-size: 14.5px; color: var(--ink); counter-increment: s; }
.eg-update ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 1px; width: 20px; height: 20px; border-radius: 6px; background: var(--amber); color: var(--amber-soft); font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.eg-update .action.single p { margin: 0; font-size: 14.5px; }
.eg-update .path { font-family: "IBM Plex Mono", monospace; font-size: .88em; background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
.eg-update .noaction { margin-top: 14px; font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--emerald); display: inline-flex; align-items: center; gap: 7px; }
.eg-update .noaction::before { content: "●"; font-size: 8px; }
.eg-update footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid var(--border); color: var(--faint); font-size: 13px; }
.eg-update footer .mono { font-family: "IBM Plex Mono", monospace; }
.eg-update a { color: var(--accent); }
@media (max-width: 540px) { .eg-update .idx { display: none; } }
`;

const BODY = `
<div class="wrap">
  <p class="eyebrow">Escape Grids · Release Notes</p>
  <h1>What shipped on 26 August</h1>
  <p class="lede">A run through everything that changed today — mostly the new cleaner job checklist, plus scheduling and property fixes. A few items need a quick bit of setup from you; those are flagged.</p>

  <div class="stats">
    <div class="stat"><div class="n">6</div><div class="l">areas changed</div></div>
    <div class="stat"><div class="n amber">3</div><div class="l">need setup from you</div></div>
    <div class="stat"><div class="n emerald">Live</div><div class="l">deployed to escapegrids.com</div></div>
  </div>

  <hr class="rule">

  <section class="change">
    <div class="head"><span class="idx">01</span><h2>Cleaner job checklist</h2><span class="tag new">New</span></div>
    <p class="body-text">The big one. Every clean now carries a checklist the cleaner works through in the app, and they <b>can't mark the job complete until it's all done</b>. Four parts, built from each property's own setup:</p>
    <ul class="feat">
      <li><b>Requests</b> — guest requests from the booking (High Chair, Travel Cot) appear as tick items.</li>
      <li><b>Consumables</b> — one card per room: a <b>Kitchen</b> card for each kitchen, a <b>Bathroom</b> card for each bathroom, each listing the restock items (Kitchen: dishwasher tablets, washing-up liquid, tea towels, kitchen roll · Bathroom: shampoo/shower gel, toilet rolls). Tick each item, or “Check all” for the room.</li>
      <li><b>Equipment</b> — each item (Hot Tub, BBQ, Sauna…) must be <b>photographed in approved condition</b> before it counts. The camera opens straight from the item.</li>
      <li><b>Every tick is timestamped and saved.</b> If someone hits “Check all” or clears a room in under 5 seconds it's flagged <b>“Check All Without Due Attention”</b> — allowed, but recorded.</li>
    </ul>
    <p class="body-text sub">Everything lands in a new <b>Cleaning Audit</b> page (<span class="path">Operations → Cleaning Audit</span>): every completed clean, who did it, when, each item's timestamp, any red flags, and the equipment photos — month by month.</p>
    <div class="action">
      <div class="atitle">Action required — property setup + cleaner brief</div>
      <ol class="steps">
        <li>Check each property's <b>Kitchens</b> and <b>Bathrooms</b> counts are right (<span class="path">Properties → edit</span>) — these decide how many room cards a cleaner sees.</li>
        <li>Check each property's <b>Equipment</b> list (<span class="path">Properties → edit → Equipment</span>). It's pre-filled from amenities (hot tubs, the Sauna at The Manse) — add or remove so it matches reality. Anything listed becomes a photo-required check.</li>
        <li>The consumables list is shared across all properties — change the standard restock items under <span class="path">Settings → General → Consumables</span> if needed.</li>
        <li><b>Brief the cleaners:</b> open the job → work the checklist → photograph the equipment → Complete. They can't finish until it's all ticked.</li>
      </ol>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">02</span><h2>Missed cleans now roll forward on their own</h2><span class="tag change">Behaviour</span></div>
    <p class="body-text">Previously a clean that wasn't done on its day could get stranded on a past date — where neither the cleaner app nor the Today board (both today-onward) would ever show it again. Now any incomplete clean from a previous day is <b>rolled forward to today automatically</b>, so it never disappears.</p>
    <ul class="feat">
      <li>An <b>arrival today</b> still jumps to top priority; the rest carry over as flagged standard cleans.</li>
      <li>If a property was <b>re-let and turned over</b> in the meantime, the stale clean is cancelled rather than dragged along.</li>
      <li>On carry-over the <b>same cleaner keeps it only if they're working today</b>. If they're off — day off or holiday — it drops back into the fair-share pool and goes to an available cleaner.</li>
    </ul>
    <span class="noaction">No action — runs on the daily schedule</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">03</span><h2>Schedule stopped refreshing every time you switch tabs</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">The cleaning schedule used to reload itself every time you clicked away to another tab and came back, losing your place. That's fixed — it stays put now.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">04</span><h2>Properties now show their operational name</h2><span class="tag change">Improved</span></div>
    <p class="body-text">We pulled Hostaway's internal listing name (e.g. <b>“Castle Hume No. 9”</b>) into Escape Grids and made it the <b>main label everywhere</b> — schedule, properties, owner views. The branded guest name (e.g. “Mabel's Maison by Escape Ordinary”) is still there as the second line when you need it.</p>
    <div class="action single">
      <div class="atitle">Action required — tidy a few names in Hostaway</div>
      <p>A handful of internal names have typos at source (e.g. <b>“Ellie's Retreat by Escape Ordianry”</b>). Fix them in Hostaway's internal listing name and they'll flow through on the next sync.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">05</span><h2>Guest “Requests” now show on bookings and cleans</h2><span class="tag new">New</span></div>
    <p class="body-text">Requests set on a Hostaway reservation — High Chair, Travel Cot and the like — now appear on the booking detail and feed straight into the cleaner's checklist (item 01). Cleaners see <b>only the guest requests</b> — not the guest-facing access info (door codes, deposit), which stays on the manager view only.</p>
    <div class="action single">
      <div class="atitle">Action required — set them in Hostaway</div>
      <p>Add these on the reservation's custom fields in Hostaway (e.g. <b>“Travel Cot required? — Yes”</b>) and they'll appear automatically on the clean.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">06</span><h2>Property view now shows everything the edit screen does</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">The property detail page was missing fields that only appeared when you clicked Edit. It now shows the lot: <b>kitchens</b>, <b>cleaning &amp; deep-clean fees</b>, the <b>bed inventory</b> with laundry cost per turnover, the <b>equipment list</b>, and the <b>communal / bundle</b> setup.</p>
    <span class="noaction">No action</span>
  </section>

  <footer><span class="mono">Escape Grids</span> — deployed to escapegrids.com · 26 August 2026. Anything unclear, give me a shout and I'll walk through it.</footer>
</div>
`;

export default function Update260826() {
  return (
    <div className="eg-update">
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
}
