# Deployment — Escape Grids

The app is hosted on **DigitalOcean App Platform** as a **Static Site**, off Lovable.
Backend remains **Supabase** (project `pftqjrmdksrrpczhomln`).

## Live URLs

- DO default: https://clownfish-app-4ud6j.ondigitalocean.app
- Custom domain: `escapegrids.com` (pending — GoDaddy nameservers to be delegated to DO managed DNS)

## DigitalOcean App

- App name: `clownfish-app`  ·  App ID: `1f58b569-e35c-4269-b2f8-023d56e1cae9`
- Project: **Escape Grids**  ·  Region: **London (lon)**
- Component: **Static Site** (not a Web Service — no running server billed)
- Spec is version-controlled at [`.do/app.yaml`](../.do/app.yaml)

### Build settings (confirmed)

| Setting | Value |
|---|---|
| Resource type | **Static Site** |
| Build command | `npm run build` |
| Output directory | `dist` |
| SPA catch-all / fallback document | `index.html` |
| Source directory | `/` |
| Buildpack | Node (ubuntu-22) — runs `npm ci` then the build command |

### Environment variables (set in DO, BUILD_TIME scope)

Vite inlines `VITE_*` vars at build time. Both are **public** (the anon key is
designed to be exposed; row-level security enforces access):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://pftqjrmdksrrpczhomln.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the Supabase **anon** key (see `.env` / `.do/app.yaml`) |

> Note: `src/integrations/supabase/client.ts` currently **hardcodes** these same
> values, so the env vars are belt-and-braces today. To make the app read them
> instead, switch `client.ts` to `import.meta.env.VITE_SUPABASE_URL` /
> `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` (with the current literals as fallback).

## Deploy method (confirmed)

**DigitalOcean-native git auto-deploy** — App Platform is connected to the GitHub
repo `robertkashyyyk/escape-insights-visuals` with `deploy_on_push: true` on the
**`main`** branch. Every push to `main` triggers a build + deploy automatically. **No
GitHub Action is involved.** (If a CI workflow is ever preferred instead, disable
`deploy_on_push` and have the Action call `doctl apps create-deployment <app-id>`.)

## Operate via doctl

```bash
doctl apps list
doctl apps spec get 1f58b569-e35c-4269-b2f8-023d56e1cae9
doctl apps update 1f58b569-e35c-4269-b2f8-023d56e1cae9 --spec .do/app.yaml
doctl apps create-deployment 1f58b569-e35c-4269-b2f8-023d56e1cae9   # manual redeploy
doctl apps logs 1f58b569-e35c-4269-b2f8-023d56e1cae9 escape-insights-visuals --type build
```

## History / gotchas

- First builds failed with `npm lockfile is not in sync`: the committed
  `package-lock.json` was stale vs `package.json` (Lovable builds with **bun**).
  Fixed by regenerating the lockfile (no dependency changes). The `bun.lock` /
  `bun.lockb` files have since been removed from the repo.
- Lovable's bot commits as `gpt-engineer-app[bot]`. To stop Lovable pushing to the
  repo, remove its GitHub App access (GitHub → Settings → Applications → Installed
  GitHub Apps) and disconnect GitHub inside the Lovable project. DO's deploy uses a
  separate GitHub connection and is unaffected.
