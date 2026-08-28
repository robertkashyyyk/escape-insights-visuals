// Standalone public release-notes page — served at /280826Update.
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
  <h1>What shipped on 28 August</h1>
  <p class="lede">Building on last week's checklist launch — this round is all about the cleaner's day: a reshaped Today view, a full day Shopping List, notes that reach the cleaner, plus equipment tweaks and a batch of reliability fixes.</p>

  <div class="stats">
    <div class="stat"><div class="n">8</div><div class="l">areas changed</div></div>
    <div class="stat"><div class="n amber">1</div><div class="l">needs a nudge from you</div></div>
    <div class="stat"><div class="n emerald">Live</div><div class="l">deployed to escapegrids.com</div></div>
  </div>

  <hr class="rule">

  <section class="change">
    <div class="head"><span class="idx">01</span><h2>The cleaner's day, reshaped</h2><span class="tag new">New</span></div>
    <p class="body-text">The cleaner's <b>Today</b> view has been rebuilt around what matters on the morning of a shift — priority first, clutter gone.</p>
    <ul class="feat">
      <li><b>Priority bands</b> — jobs are grouped and colour-coded <b>P0 → P1 → P2</b> (do-first in red at the top, same-day turnarounds amber, standard checkouts green), so the order of the day is obvious at a glance.</li>
      <li><b>Routing clutter removed</b> — no more travel-between-jobs, distance-from-home or proposed-start times. We kept checkout/check-in times and the clean duration. (We'll revisit smart routing later, once the basics are bedded in.)</li>
      <li><b>Checklist is view-first</b> — a cleaner can <b>preview</b> a job's checklist before starting, but it's read-only until they hit <b>Start Job</b> — at which point it becomes tickable and opens automatically.</li>
    </ul>
    <div class="action">
      <div class="atitle">Action required — brief the cleaners + keep property config tidy</div>
      <ol class="steps">
        <li><b>Brief the cleaners</b> on the new flow: pick a job → View checklist → Start → tick + photograph → Complete.</li>
        <li>The Shopping List and checklist are only as good as each property's setup — keep <b>Kitchens, Bathrooms, Beds and Equipment</b> accurate (<span class="path">Properties → edit</span> or the <span class="path">Matrix</span>).</li>
      </ol>
    </div>
  </section>

  <section class="change">
    <div class="head"><span class="idx">02</span><h2>Today's Shopping List</h2><span class="tag new">New</span></div>
    <p class="body-text">A single <b>Today's Shopping List</b> button on the cleaner's Today view — open it first thing, no need to start any job. It totals <b>everything to pack for the whole day</b> across all their cleans:</p>
    <ul class="feat">
      <li><b>Linens</b> — every bed by type, e.g. “5× Super King bedding, 3× King, 1× Sofa Bed”.</li>
      <li><b>Consumables</b> — per total kitchens and bathrooms, e.g. “Toilet Rolls ×6, Dishwasher Tablets ×4”.</li>
      <li><b>Equipment to service</b> — counts of hot tubs, coffee machines, BBQs and the rest.</li>
    </ul>
    <span class="noaction">No action — builds itself from the day's jobs</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">03</span><h2>Manager notes now reach the cleaner</h2><span class="tag new">New</span></div>
    <p class="body-text">A note typed on a clean in the schedule (the “Notes” box on a job) now shows on the <b>cleaner's job card</b> as a highlighted “Note from manager”. Previously those notes were saved but never surfaced to the cleaner.</p>
    <span class="noaction">No action — just type a note on a clean in the schedule</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">04</span><h2>Coffee Machine &amp; tick-only equipment</h2><span class="tag new">New</span></div>
    <p class="body-text">Equipment checks can now be <b>photo-required</b> (Hot Tub, BBQ…) or <b>tick-only</b> (Coffee Machine — no photo, just a tick).</p>
    <ul class="feat">
      <li>A property's <b>Equipment</b> is now <b>preset toggle-buttons</b> (Hot Tub, BBQ, Sauna, Pizza Oven, Coffee Machine) instead of free text — consistent with the Matrix. Anything unusual can still be added by hand.</li>
      <li><b>Coffee Machine</b> can be toggled per property in the <span class="path">Matrix</span> (new “Coffee” column) and on the property page, and flows straight onto the cleaner's checklist as a tick.</li>
    </ul>
    <span class="noaction">No action — toggle coffee machines on where they exist</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">05</span><h2>Property Matrix niceties</h2><span class="tag change">Improved</span></div>
    <p class="body-text">Small quality-of-life fixes on the bulk-edit <span class="path">Matrix</span>: a <b>“Board” button</b> to jump back to the card view (mirroring the “Matrix” button on Board), the new <b>Coffee</b> toggle column, and opening a property's <b>“set beds”</b> no longer auto-fills phantom “Super King” rows — beds only appear once you actually enter them.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">06</span><h2>Equipment photos — reliable on phones now</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">Taking an equipment photo could crash the app, loop the cleaner back to the start, or throw a “low memory” error on phones. The photo path was re-worked to do <b>no heavy image processing on the phone</b> — the shot uploads straight to storage and the tab can no longer run out of memory. Photos now capture, save and view cleanly.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">07</span><h2>iPhone blank / unreadable screen — fixed</h2><span class="tag fix">Fix</span></div>
    <p class="body-text">Some iPhones showed a dark, unreadable or blank screen on login (Android was fine). The cause was the fonts blocking the stylesheet from loading. Fixed — the page now paints correctly straight away on any device.</p>
    <span class="noaction">No action</span>
  </section>

  <section class="change">
    <div class="head"><span class="idx">08</span><h2>Sign-in first + clearer login errors</h2><span class="tag change">Change</span></div>
    <p class="body-text"><b>Escape Grids is now sign-in-first</b> — the old public marketing pages are gone and <span class="path">escapegrids.com</span> goes straight to the login (it's an internal Escape Ordinary tool). And when setting a temporary password or enabling a login fails, the screen now shows the <b>real reason</b> instead of a generic “non-2xx” error.</p>
    <span class="noaction">No action</span>
  </section>

  <footer><span class="mono">Escape Grids</span> — deployed to escapegrids.com · 28 August 2026. Anything unclear, give me a shout and I'll walk through it.</footer>
</div>
`;

export default function Update280826() {
  return (
    <div className="eg-update">
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
}
