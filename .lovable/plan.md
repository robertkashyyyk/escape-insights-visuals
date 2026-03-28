

# Plan: Add Password Login to Auth Page

## Problem
The Auth page only supports magic link login. The two super users were created with email + password (`EO2026!!`), so they can't log in.

## Changes

**`src/pages/Auth.tsx`** — Add a tabbed login interface:

1. Add two tabs: **"Magic Link"** and **"Password"** using a simple toggle or shadcn Tabs component
2. Magic Link tab keeps the existing OTP flow unchanged
3. Password tab adds:
   - Email input
   - Password input (with show/hide toggle)
   - "Sign In" button calling `supabase.auth.signInWithPassword({ email, password })`
   - Error handling with toast notifications
4. After successful password login, redirect to `/dashboard`

## Design
- Tabs sit inside the existing glassmorphic card, matching the current premium style
- Password field uses the same `Input` component with `Lock` icon
- No "Forgot password" link needed for now (invite-only system)
- No signup form (invite-only as specified)

## No other files change.

