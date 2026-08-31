// Standalone cleaner user manual — served at /cleaner/manual.
// Self-contained: its own scoped styles + theme tokens, no app chrome.

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.eg-manual {
  --ground: #F6F8FB; --surface: #FFFFFF; --surface-2: #EEF2F8;
  --ink: #141B2B; --muted: #5A6579; --faint: #8A93A5;
  --border: #E2E7F0; --accent: #4361D8; --accent-soft: #E7ECFB;
  --red: #C0392B; --red-soft: #FBEAE7; --amber: #B45309; --amber-soft: #FDF3E4;
  --emerald: #2F855A; --emerald-soft: #E4F1EA;
  --shadow: 0 1px 2px rgba(20,27,43,.04), 0 8px 24px -12px rgba(20,27,43,.10);
  min-height: 100vh; background: var(--ground); color: var(--ink);
  font-family: "IBM Plex Sans", system-ui, sans-serif; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .eg-manual {
    --ground: #0E1421; --surface: #151D2D; --surface-2: #1C2637;
    --ink: #EAEEF6; --muted: #9BA6BA; --faint: #6B7688;
    --border: #263148; --accent: #7C93F0; --accent-soft: #1E2A47;
    --red: #F1998E; --red-soft: #2A1613; --amber: #E0A45C; --amber-soft: #2A2013;
    --emerald: #6FC79A; --emerald-soft: #14271C;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 30px -14px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] .eg-manual {
  --ground: #0E1421; --surface: #151D2D; --surface-2: #1C2637;
  --ink: #EAEEF6; --muted: #9BA6BA; --faint: #6B7688;
  --border: #263148; --accent: #7C93F0; --accent-soft: #1E2A47;
  --red: #F1998E; --red-soft: #2A1613; --amber: #E0A45C; --amber-soft: #2A2013;
  --emerald: #6FC79A; --emerald-soft: #14271C;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 30px -14px rgba(0,0,0,.6);
}

.eg-manual * { box-sizing: border-box; }
.eg-manual .wrap { max-width: 720px; margin: 0 auto; padding: clamp(28px, 6vw, 60px) clamp(18px, 5vw, 32px) 80px; counter-reset: sec; }
.eg-manual .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
.eg-manual h1 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: clamp(30px, 6vw, 44px); line-height: 1.05; letter-spacing: -.02em; text-wrap: balance; margin: 0 0 12px; }
.eg-manual .lede { font-size: 17px; color: var(--muted); margin: 0; max-width: 60ch; }
.eg-manual .toc { margin: 30px 0 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; box-shadow: var(--shadow); }
.eg-manual .toc p { margin: 0 0 10px; font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
.eg-manual .toc ol { margin: 0; padding: 0; list-style: none; counter-reset: t; display: grid; gap: 6px; }
.eg-manual .toc li { counter-increment: t; }
.eg-manual .toc a { display: flex; gap: 10px; color: var(--ink); text-decoration: none; font-size: 15px; align-items: baseline; }
.eg-manual .toc a:hover { color: var(--accent); }
.eg-manual .toc a::before { content: counter(t, decimal-leading-zero); font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--accent); }
.eg-manual .rule { height: 1px; background: var(--border); border: 0; margin: 34px 0; }
.eg-manual section { margin: 0 0 34px; scroll-margin-top: 20px; counter-increment: sec; }
.eg-manual h2 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 600; font-size: clamp(20px, 3.6vw, 25px); line-height: 1.15; letter-spacing: -.015em; margin: 0 0 4px; display: flex; align-items: baseline; gap: 10px; text-wrap: balance; }
.eg-manual h2 .n { font-family: "IBM Plex Mono", monospace; font-size: 14px; color: var(--accent); font-weight: 500; }
.eg-manual h2 .n::before { content: counter(sec, decimal-leading-zero); }
.eg-manual p.intro { color: var(--muted); margin: 6px 0 0; }
.eg-manual ol.steps { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: s; display: grid; gap: 10px; }
.eg-manual ol.steps li { position: relative; padding-left: 30px; counter-increment: s; }
.eg-manual ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 0; width: 21px; height: 21px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.eg-manual ul.plain { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.eg-manual ul.plain li { position: relative; padding-left: 20px; }
.eg-manual ul.plain li::before { content: ""; position: absolute; left: 4px; top: 10px; width: 5px; height: 5px; border-radius: 2px; background: var(--accent); transform: rotate(45deg); }
.eg-manual b { font-weight: 600; }
.eg-manual .pill { display: inline-flex; align-items: center; font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; letter-spacing: .04em; }
.eg-manual .p0 { background: var(--red-soft); color: var(--red); }
.eg-manual .p1 { background: var(--amber-soft); color: var(--amber); }
.eg-manual .p2 { background: var(--emerald-soft); color: var(--emerald); }
.eg-manual .btn { font-family: "IBM Plex Mono", monospace; font-size: .86em; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 1px 7px; white-space: nowrap; font-weight: 500; }
.eg-manual .note { margin-top: 14px; background: var(--amber-soft); border: 1px solid var(--amber); border-radius: 12px; padding: 12px 15px; font-size: 14px; color: var(--ink); }
.eg-manual .note b { color: var(--amber); }
.eg-manual figure.shot { margin: 16px 0 0; }
.eg-manual figure.shot img { width: 100%; max-width: 340px; border-radius: 14px; border: 1px solid var(--border); box-shadow: var(--shadow); display: block; }
.eg-manual figure.shot figcaption { font-size: 12px; color: var(--faint); margin-top: 7px; }
.eg-manual footer { margin-top: 50px; padding-top: 22px; border-top: 1px solid var(--border); color: var(--faint); font-size: 13px; }
.eg-manual footer .mono { font-family: "IBM Plex Mono", monospace; }
`;

const BODY = `
<div class="wrap">
  <p class="eyebrow">Escape Grids · Cleaner Guide</p>
  <h1>How to use the app</h1>
  <p class="lede">Everything you need to run your day from your phone — from signing in to finishing a clean. Keep this handy; it's here whenever you need it.</p>

  <div class="toc">
    <p>Contents</p>
    <ol>
      <li><a href="#signin">Signing in</a></li>
      <li><a href="#team">If you're part of a team</a></li>
      <li><a href="#today">Your day (Today)</a></li>
      <li><a href="#shopping">Today's Shopping List</a></li>
      <li><a href="#view">Looking at a job first</a></li>
      <li><a href="#start">Starting a job</a></li>
      <li><a href="#checklist">Working the checklist</a></li>
      <li><a href="#photos">Equipment photos</a></li>
      <li><a href="#complete">Finishing a job</a></li>
      <li><a href="#notes">Notes from your manager</a></li>
      <li><a href="#flag">Flagging a problem</a></li>
      <li><a href="#week">Other days</a></li>
    </ol>
  </div>

  <hr class="rule">

  <section id="signin">
    <h2><span class="n"></span> Signing in</h2>
    <ol class="steps">
      <li>Open <b>escapegrids.com</b> in your phone's browser (Safari or Chrome). Tip: add it to your home screen so it opens like an app.</li>
      <li>Enter your <b>email</b> and <b>password</b> and tap <span class="btn">Sign In</span>.</li>
      <li>You'll land straight on <b>Today</b> — your jobs for the day.</li>
    </ol>
    <div class="note">Trouble getting in? Don't keep retrying — message your manager and they'll sort your login.</div>
  </section>

  <section id="team">
    <h2><span class="n"></span> If you're part of a team</h2>
    <p class="intro">Some teams share <b>one login</b> between several people (for example, a group who travel and clean together). If that's you, the app needs to know <b>which person is using it</b> so your work is logged to you — not just the team.</p>
    <ol class="steps">
      <li>When you open the app, you'll see <b>“Who are you today?”</b> — tap <b>your name</b> in the list.</li>
      <li>That's it — from now on every job you <b>start</b>, <b>finish</b> and every item you <b>tick</b> or <b>photograph</b> is recorded under your name.</li>
      <li>Your choice is remembered on that phone. If someone else takes the phone to do a job, tap <span class="btn">You are: … · Switch</span> at the top and pick the right name.</li>
    </ol>
    <div class="note">You can't <b>Start</b> or <b>Complete</b> a job until you've told the app who you are — if you try, it'll pop the name list up first. If you're a <b>solo cleaner</b>, you'll never see this; skip straight to the next section.</div>
    <figure class="shot"><img src="/images/manual/team.svg" alt="Who are you today" onerror="this.closest('figure').style.display='none'"><figcaption>The “Who are you today?” screen for shared-login teams.</figcaption></figure>
  </section>

  <section id="today">
    <h2><span class="n"></span> Your day (Today)</h2>
    <p class="intro">Your jobs are grouped by priority, most important at the top:</p>
    <ul class="plain">
      <li><span class="pill p0">P0</span> &nbsp;<b>Do first</b> — highest priority, get to these before anything else.</li>
      <li><span class="pill p1">P1</span> &nbsp;<b>Same-day turnaround</b> — a guest is arriving that same day, so timing is tight.</li>
      <li><span class="pill p2">P2</span> &nbsp;<b>Standard checkout</b> — no rush beyond the normal window.</li>
    </ul>
    <p class="intro">Each job card shows the <b>property</b>, its <b>area</b>, the <b>checkout</b> (📋 CO) and <b>check-in</b> (🔑 CI) times, and roughly <b>how long</b> the clean should take (⏱).</p>
    <figure class="shot"><img src="/images/manual/today.png" alt="Today view" onerror="this.closest('figure').style.display='none'"><figcaption>Your Today list, grouped P0 → P1 → P2.</figcaption></figure>
  </section>

  <section id="shopping">
    <h2><span class="n"></span> Today's Shopping List</h2>
    <p class="intro">Before you set off, tap <span class="btn">Today's Shopping List</span> at the top of Today. It totals <b>everything you'll need for the whole day</b> across all your jobs — you don't need to start anything to see it.</p>
    <ul class="plain">
      <li><b>Linens</b> — how many of each bed type to load (e.g. “5× Super King bedding, 3× King”).</li>
      <li><b>Consumables</b> — how many toilet rolls, dishwasher tablets, tea towels, etc.</li>
      <li><b>Equipment to service</b> — how many hot tubs, coffee machines, BBQs you'll deal with.</li>
    </ul>
    <figure class="shot"><img src="/images/manual/shopping.png" alt="Shopping List" onerror="this.closest('figure').style.display='none'"><figcaption>The day's Shopping List — linens, consumables and equipment totalled.</figcaption></figure>
  </section>

  <section id="view">
    <h2><span class="n"></span> Looking at a job first</h2>
    <p class="intro">Tap <span class="btn">View Checklist</span> on any job to see what it involves — guest requests, the consumables for each room, and any equipment — <b>before</b> you start. It's read-only at this point; you can look but not tick.</p>
  </section>

  <section id="start">
    <h2><span class="n"></span> Starting a job</h2>
    <ol class="steps">
      <li>When you arrive and begin, tap <span class="btn">Start Job</span>.</li>
      <li>The checklist opens automatically and is now <b>tickable</b>.</li>
      <li>Started the wrong one by mistake? Tap <span class="btn">Started by mistake? Undo</span> to set it back.</li>
    </ol>
    <div class="note">Only start a job when you're actually there and cleaning — the times you start and finish are recorded.</div>
  </section>

  <section id="checklist">
    <h2><span class="n"></span> Working the checklist</h2>
    <p class="intro">There are up to three sections. Tick things off as you go:</p>
    <ul class="plain">
      <li><b>Guest Requests</b> — things the guest asked for (High Chair, Travel Cot…). Tick once you've set them up.</li>
      <li><b>Consumables</b> — one card per room (a Kitchen card per kitchen, a Bathroom card per bathroom). Tick each item as you restock it, or tap <b>“Check all”</b> for a room once it's fully done.</li>
      <li><b>Equipment</b> — items like Hot Tub or BBQ need a <b>photo</b> (see next section). Others, like a Coffee Machine, are just a tick.</li>
    </ul>
    <div class="note">Tick <b>honestly, as you actually do each thing</b>. Hitting “Check all” the instant you open a room gets flagged as “without due attention” and your manager sees it.</div>
    <figure class="shot"><img src="/images/manual/checklist.png" alt="Job checklist" onerror="this.closest('figure').style.display='none'"><figcaption>A job's checklist — Requests, Consumables per room, Equipment.</figcaption></figure>
  </section>

  <section id="photos">
    <h2><span class="n"></span> Equipment photos</h2>
    <ol class="steps">
      <li>On an equipment item that needs one, tap <span class="btn">Photo</span> — your camera opens.</li>
      <li>Take a clear shot of the item in <b>good, approved condition</b>, then confirm.</li>
      <li>The item turns green with a <span class="btn">View</span> link. Need to redo it? Tap <span class="btn">Retake</span>.</li>
    </ol>
  </section>

  <section id="complete">
    <h2><span class="n"></span> Finishing a job</h2>
    <p class="intro">Once <b>everything</b> is ticked and every equipment photo is taken, the green <span class="btn">Complete Job</span> button unlocks. Tap it to finish — the job drops off your list.</p>
    <p class="intro">If Complete is greyed out, something's still outstanding. The checklist shows <b>how many are left</b> (e.g. “10/12 done”) — finish those and it'll turn green.</p>
  </section>

  <section id="notes">
    <h2><span class="n"></span> Notes from your manager</h2>
    <p class="intro">If your manager left a note for a specific job, it shows on the card as a highlighted <b>“Note from manager”</b> (e.g. “bins out Thursday”, “key in the lockbox”). Always read it before you start.</p>
  </section>

  <section id="flag">
    <h2><span class="n"></span> Flagging a problem</h2>
    <p class="intro">Something wrong — damage, a missing key, something that needs the manager's attention? Tap <span class="btn">Flag an Issue</span> on the job, describe it, and send. Your manager gets it straight away.</p>
  </section>

  <section id="week">
    <h2><span class="n"></span> Other days</h2>
    <p class="intro">Use <span class="btn">Tomorrow</span>, <span class="btn">Rest of Week</span> and <span class="btn">Next Week</span> at the top to see what's coming up. Future days are view-only — you can look ahead and plan, but you start and complete jobs on the day itself.</p>
  </section>

  <footer><span class="mono">Escape Grids</span> — cleaner guide. Stuck on anything? Message your manager.</footer>
</div>
`;

export default function CleanerManual() {
  return (
    <div className="eg-manual">
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
}
