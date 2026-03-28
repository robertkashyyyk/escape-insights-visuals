

# Plan: Create Two Super Users

## What Happens

Create two authenticated users with passwords and assign them the `super` role.

## Steps

### 1. Create a temporary edge function (`create-initial-users`)
A one-time edge function that uses the Supabase Admin API (`supabase.auth.admin.createUser`) to create both users with:
- `robert@kashyyyk.co.uk` / `EO2026!!`
- `ryan@escapeordinarygroup.com` / `EO2026!!`
- `email_confirm: true` (skip email verification)

After creating each user, inserts a `super` role into `user_roles`.

### 2. Invoke the edge function once
Call it to create both accounts.

### 3. Clean up
Delete the edge function after use — it's not needed ongoing since the invite flow handles future users.

## Technical Details
- Uses `SUPABASE_SERVICE_ROLE_KEY` (already configured) for admin operations
- The `handle_new_user` trigger will auto-create `profiles` entries
- Both users will be able to log in immediately via the `/auth` page with email + password (magic link also works)

