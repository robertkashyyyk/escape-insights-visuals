// Standalone release-notes page — served at /080926Update.
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
  <h1>Cleaning schedule — a week of fixes</h1>
  <p class="lede">A concerted push on scheduling reliability: we found the real root cause behind cleans going missing, fixed the timing edge-cases, swept the pre-go-live ghosts, and added safety nets so problems surface themselves. The schedule now heals itself — no more daily hand-clearing.</p>

  <div class="stats">
    <div class="stat"><div class="n">8</div><div class="l">areas fixed / improved</div></div>
    <div class="stat"><div class="n amber">1</div><div class="l">habit that keeps it clean</div></div>
    <div class="stat"><div class="n emerald">Live</div><div class="l">deployed to escapegrids.com</div></div>
  </div>

  <hr class="rule">

  <section class="change">
    <div class="head"><span class="idx">01</span><h2>Cleans that vanished now heal themselves</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">The big one. When a booking was modified in Hostaway, the old <b>cancelled</b> clean was still holding that property's slot in the database — so the system couldn't create the correct one, and regenerating never helped. That's fixed at the source: a dead clean can no longer block a live one, so <b>a Regenerate now recreates any missing clean automatically</b> instead of needing a manual re-add. (Confirmed live on CHC 9.)</p>
    <span class="noaction">No action — hit Regenerate and it self-heals</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">02</span><h2>Back-to-back bookings keep their clean</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">Cleans were being wrongly cancelled when a guest checked out one day and the next arrived the day after (Northern Bank Apt 1 was the example). A same-day timing error mistook the <i>incoming</i> guest for one who'd already left. Fixed — those turnovers now hold and carry to the day they're needed.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">03</span><h2>Pre-go-live "ghost" cleans swept</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">Properties whose last checkout was <b>before go-live (1 Sep)</b> were cleaned offline but showed as permanently "dirty" — some rolling forward since as far back as May, wearing an old guest's name. Those have all been cleared, and a safeguard is being added so a clean can never silently roll for weeks again.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">04</span><h2>Two new safety nets</h2><span class="tag new">New</span></div>
    <p class="body-text">The schedule now flags its own problems, before they reach a guest:</p>
    <ul class="feat">
      <li><b>Coverage alert</b> — flags any area with no cleaner assigned, so a settings change (renaming/combining areas, a cleaner going inactive) can't silently leave cleans unassigned.</li>
      <li><b>Missing-clean alert</b> — flags any confirmed checkout with no clean scheduled, <b>before</b> the guest arrives. Even a brand-new edge case raises its hand early.</li>
    </ul>
    <p class="body-text sub">Both appear as a "Needs attention" banner on the Cleaning Schedule.</p>
  </section>

  <section class="change">
    <div class="head"><span class="idx">05</span><h2>The views now agree and stay live</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">The Matrix used to lag behind the Day view — "it's not there… now it is". That was stale cached data. The Matrix, Day view and On The Daily now refresh live, so what you see is always the current schedule.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">06</span><h2>On The Daily — rebuilt</h2><span class="tag change">Improved</span></div>
    <p class="body-text">One board, four columns — <b>Occupied · Dirty · In Progress · Clean</b> — one card per property showing its true current state:</p>
    <ul class="feat">
      <li><b>Occupied</b> shows the stay dates (in → out).</li>
      <li><b>Dirty</b> shows when it's due to be cleaned — a today time or a future date.</li>
      <li><b>In Progress</b> shows the expected ready time; <b>Clean</b> shows expected-vs-actual.</li>
      <li><b>Sort</b> by earliest-first or A–Z, and <b>filter</b> by location and cleaner (multi-select).</li>
    </ul>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">07</span><h2>Properties page — status you can trust</h2><span class="tag change">Improved</span></div>
    <p class="body-text">The Clean/Dirty status was reading a stored flag that often didn't update. It now reflects the <b>real, live state</b> (from bookings + cleans), matching On The Daily. Plus an <b>Occupied</b> filter alongside Clean and Dirty, and the little status light is now colour-coded — <span class="path">🔵 Occupied · 🔴 Dirty · 🟠 In Progress · 🟢 Clean</span>.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">08</span><h2>One habit that keeps it all clean</h2><span class="tag change">For the team</span></div>
    <p class="body-text">A lot of the "phantom" cleans traced back to jobs that <b>were done but never marked complete</b> in the app. When a clean is finished, tapping <b>Complete</b> keeps the schedule accurate and stops these reappearing.</p>
    <div class="action single">
      <div class="atitle">The one ask</div>
      <p>Cleaners: tap <b>Complete</b> when a clean is finished. It's the single biggest thing that keeps the whole schedule honest.</p>
    </div>
  </section>

  <footer><span class="mono">Escape Grids</span> — deployed to escapegrids.com · 8 September 2026. Anything unclear, give me a shout and I'll walk through it.</footer>
</div>
`;

export default function Update080926() {
  return (
    <div className="eg-update">
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
}
