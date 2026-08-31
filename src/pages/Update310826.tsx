// Standalone public release-notes page — served at /310826Update.
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
  <h1>What shipped on 31 August</h1>
  <p class="lede">A big one — team cleaners, a look-ahead capacity view, a proper command centre, a way to remove cleans that genuinely aren't needed, plus a run of scheduling reliability fixes so regenerate behaves and cleans stop slipping through. A few items need a bit of setup; those are flagged.</p>

  <div class="stats">
    <div class="stat"><div class="n">10</div><div class="l">areas changed</div></div>
    <div class="stat"><div class="n amber">3</div><div class="l">need setup from you</div></div>
    <div class="stat"><div class="n emerald">Live</div><div class="l">deployed to escapegrids.com</div></div>
  </div>

  <hr class="rule">

  <section class="change">
    <div class="head"><span class="idx">01</span><h2>Cleaning Traffic — see the crunch before it lands</h2><span class="tag new">New</span></div>
    <p class="body-text">A new <span class="path">Operations → Cleaning Traffic</span> page: a capacity heat-map with <b>regions down the side and dates across the top</b>, scrolling weeks ahead. Each cell is a traffic light:</p>
    <ul class="feat">
      <li>🟢 <b>Green</b> — all cleans covered, within capacity.</li>
      <li>🟠 <b>Amber</b> — covered but over the ideal cap (someone's carrying extra).</li>
      <li>🔴 <b>Red</b> — unassigned cleans; no cover.</li>
    </ul>
    <p class="body-text sub">Cells show counts and, on click, jump straight into that day's schedule. It's the quickest way to spot an over-loaded day and fix it before it arrives.</p>
    <span class="noaction">No action — reads the live schedule</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">02</span><h2>Today, reshaped into a command centre</h2><span class="tag change">Improved</span></div>
    <p class="body-text">The <span class="path">Today</span> page now leads with <b>"Needs attention"</b> instead of a wall of cards: unassigned cleans (with today called out), over-capacity days ahead, and any flagged cleaner issues — each a one-line link to go fix it — plus a 14-day capacity strip into Cleaning Traffic. The genuinely useful bits (today's cleans, movements, portfolio pulse) stay; a tidy "Jump to" row keeps the nav.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">03</span><h2>Team cleaners — one login, pick who you are</h2><span class="tag new">New</span></div>
    <p class="body-text">For a crew like <b>Sunshine</b> (four people, one login): mark a cleaner as a <b>Team</b> and name its members. On the app they're asked <b>"Who are you today?"</b> and pick a name, so every Start / Complete / tick / photo is logged to <b>that person</b>. A team's daily capacity also scales with its member count, so it takes on its fair share.</p>
    <div class="action">
      <div class="atitle">Action required — set up the team</div>
      <ol class="steps">
        <li><span class="path">Settings → Cleaners</span> → open the team → toggle <b>Team</b> on and add the members' names.</li>
        <li>Set their <b>Regions</b> and <b>Workload share</b> so the schedule routes the right areas + volume to them.</li>
      </ol>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">04</span><h2>Day-off overrides</h2><span class="tag new">New</span></div>
    <p class="body-text">A weekly day off is now a <b>rule with exceptions</b>, not absolute. On a cleaner's profile, add specific dates they'll <b>work despite their usual day off</b> (e.g. covering while the area's other cleaner is away). Their recurring day off is untouched — only the dates you add are overridden. Multi-day time off still goes in Holidays.</p>
    <div class="action single">
      <div class="atitle">Action required — where to set it</div>
      <p><span class="path">Settings → Cleaners</span> → open the cleaner → <b>"Works on these days"</b> → add the date. It re-runs that day's schedule so they pick up the cleans.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">05</span><h2>Suspend &amp; Archive properties</h2><span class="tag new">New</span></div>
    <p class="body-text">You can now take a property out of the app properly — via <span class="path">Properties → edit → Property status</span>:</p>
    <ul class="feat">
      <li><b>Suspend</b> — reversible pause. Out of cleaning &amp; cleaner views, still in management. For seasonal/student lets.</li>
      <li><b>Archive</b> — hides it everywhere but keeps all history (reservations, cleans, revenue); restorable.</li>
    </ul>
    <div class="action single">
      <div class="atitle">Action required — the two you flagged</div>
      <p><b>The Lookout</b> (long-term let) → Suspend or Archive; <b>Toby Cottage</b> (launch held) → Archive. That also clears their leftover cleans from the schedule.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">06</span><h2>Cleaner user manual</h2><span class="tag new">New</span></div>
    <p class="body-text">A full how-to for cleaners at <span class="path">escapegrids.com/cleaner/manual</span> — signing in (incl. the <b>Magic Link</b> option, so no password to remember), the priority bands, the Shopping List, working the checklist, photos, completing, flagging issues, and (for teams) picking who you are. Bookmark-able, and a good hand-out for a new starter.</p>
    <span class="noaction">No action — screenshots being added</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">07</span><h2>Cleaning schedule — much more reliable</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">A cluster of fixes so Regenerate behaves and cleans stop slipping through the cracks:</p>
    <ul class="feat">
      <li><b>Regenerate no longer crashes</b> — a duplicate-clean conflict (and a long-run request timeout) used to fail the whole run with a "non-2xx". Both handled; it now completes and reports properly.</li>
      <li><b>Capacity is a flag, not a blocker</b> — cleans are always assigned by fair-share; if a cleaner goes over the ideal cap it's <b>flagged</b> for you to rebalance, rather than left unassigned.</li>
      <li><b>No more orphan cleans</b> — a clean left with no cleaner (e.g. after a cleaner was deleted) now gets picked back up on regenerate, whatever its status. And deleting a cleaner cleanly unassigns their cleans (with a warning first).</li>
      <li><b>Modified bookings can't blank out a clean</b> — when Hostaway modifies a booking it leaves a cancelled "twin"; that twin was making the system think the day was covered and skip the real checkout's clean ("nothing to generate"). Cancelled cleans are now ignored when deciding if a property still needs one.</li>
      <li><b>No more phantom "unassigned"</b> — a stray clean stuck on a bundle listing was being counted in the header but had no row to appear in (so you couldn't see or filter to it). The counter now only counts cleans you can actually action, and the scheduler never parks — or drags forward — a clean on a bundle.</li>
    </ul>
    <div class="action single">
      <div class="atitle">Action required — the last unassigned</div>
      <p>Anything still unassigned after a regenerate is a genuine <b>coverage gap</b> — no cleaner covers that region. Add the region to a cleaner in <span class="path">Settings → Cleaners</span>, and set a <b>location group</b> on any property that's missing one.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">08</span><h2>Mark a clean "Not required" — and it stays gone</h2><span class="tag new">New</span></div>
    <p class="body-text">When a turnover genuinely doesn't need cleaning — an <b>owner checking in</b>, or a <b>guest no-show</b> who's kept the booking — you can now take the clean off for good. Open the clean and you'll see two options:</p>
    <ul class="feat">
      <li><b>Remove &amp; regenerate</b> — for accidental removals; it rebuilds from the booking (as before).</li>
      <li><b>Not required — remove for good</b> — takes it off the schedule and it <b>won't come back on regenerate</b>. The booking itself is left completely untouched.</li>
    </ul>
    <div class="action single">
      <div class="atitle">How to use it</div>
      <p>Open the clean → <b>Not required — remove for good</b> → confirm. Use it for owner stays, no-shows, or any turnover that doesn't need a clean.</p>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">09</span><h2>Checklists &amp; Shopping List — fixed</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">Two data-permission bugs that made cleaners' screens look empty:</p>
    <ul class="feat">
      <li><b>Checklists were coming up "no items"</b> — a database column mismatch was rejecting the whole checklist for any property with equipment. Fixed; checklists populate correctly.</li>
      <li><b>Shopping List linens were blank</b> — cleaners couldn't read the bed inventory. Fixed; linens now total by bed type.</li>
    </ul>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">10</span><h2>App polish &amp; safety net</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">The <span class="path">Today</span> page had a crash and a scrolling <b>jitter</b> (the glass-card blur re-drawing every frame) — both fixed, and scrolling is smoother across the app. We also added an <b>app-wide error catch</b>, so a page that ever hits a problem shows the actual error instead of a blank screen.</p>
    <span class="noaction">No action</span>
  </section>

  <footer><span class="mono">Escape Grids</span> — deployed to escapegrids.com · 31 August 2026. Anything unclear, give me a shout and I'll walk through it.</footer>
</div>
`;

export default function Update310826() {
  return (
    <div className="eg-update">
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
}
