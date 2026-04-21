

# Give Orin "How do I…" answers without building a RAG pipeline

## The idea
Instead of writing/embedding a knowledge base, ship a **static, hand-curated app guide** as a plain Markdown file that gets injected into Orin's system prompt on every chat call. Small (a few KB), zero infra, zero maintenance overhead beyond editing one file when features change. Orin reads it, knows the app, and can answer "how do I X" with a real route + steps.

This is the same pattern Cursor/Claude use — a single `APP_GUIDE.md` is cheaper, simpler, and more accurate than RAG for an app this size (~30 routes).

## How it works

1. **One source-of-truth file**: `supabase/functions/orin-chat/app-guide.md` — a structured Markdown doc covering every feature, route, role permissions, and common workflows. Roughly:
   ```
   ## Cleaning Schedule (/operations/schedule)
   - Roles: super, senior, admin
   - Views: Day, Week, Matrix
   - To regenerate: click "Regenerate Week" (matrix/week) or "Regenerate" (day)
   - To mark a clean complete: click the task tile → "Mark complete"
   - To undo a clean: open task → "Remove this clean" → then Regenerate
   - Filters: chips (matrix/week) hide non-matching; dropdowns (day) only
   ...
   ```

2. **Inject into Orin's system prompt**: In `supabase/functions/orin-chat/index.ts`, read the file at function startup (Deno: `await Deno.readTextFile`) and prepend a new section to the system prompt:
   ```
   ## App Guide (use this to answer "how do I…" questions)
   {APP_GUIDE_CONTENTS}
   ```

3. **Update Orin's rules**: Currently rule #1 says "only reference provided context data". We add an explicit allowance:
   > You may also answer **product help / how-to** questions using the App Guide section below. When you do, cite the route (e.g. `/operations/schedule`) and give concrete click-by-click steps. If the guide doesn't cover it, say "I don't have docs on that yet" rather than guessing.

4. **Role-aware filtering**: The guide has clear role tags (`Roles: super, senior, admin` vs `Roles: client`). Orin already knows the user's role from context — it'll naturally filter what it suggests (no Owner asking about /operations).

5. **Suggested chips**: Add 1-2 how-to chips per persona to `OrinSuggestedChips.tsx` so users discover the capability:
   - Admin: "How do I regenerate the cleaning schedule?"
   - Owner: "How do I view my monthly statement?"

## Why not auto-generate from code?
Considered it. Two reasons against:
- **Routes ≠ workflows**: Reading `App.tsx` tells Orin a route exists, not what to click or why. The interesting answers ("undo a clean → then click Regenerate") only live in human-written prose.
- **Noise**: Auto-extracting from 200+ components produces a context bomb that degrades answer quality and burns tokens on every chat call.

A 4-6 KB hand-curated guide beats 100 KB of auto-extracted noise.

## Maintenance
- One file. When you ship a feature, add 5 lines to `app-guide.md`. That's it.
- Optional later: a lightweight check in CI that flags if a new route in `App.tsx` doesn't appear in the guide.

## Files to change
- **New**: `supabase/functions/orin-chat/app-guide.md` — the guide itself, organised by area (Today, Cleaning, Properties, Owners, Reservations, Pricing, Settings, Owner Portal, Cleaner Portal). I'll draft an initial version covering all current routes based on what's in the codebase.
- **Edit**: `supabase/functions/orin-chat/index.ts` — load the markdown file at startup, inject into system prompt, relax rule #1 to permit how-to answers from the guide.
- **Edit**: `src/components/orin/OrinSuggestedChips.tsx` — add one how-to chip per persona.

No DB migration. No new dependencies. No RAG, no embeddings, no vector store.

## Out of scope
- Auto-generating the guide from source code (rejected above).
- Screenshots / video walkthroughs in answers.
- Versioning the guide per-release.

