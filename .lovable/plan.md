

# Plan: Invite-Only Auth with Role-Based Access

## What Changes

No signup page. Users can only join via invite from a Super user. Four roles control access across the app.

## Roles

| Role | Access |
|------|--------|
| **Super** | Full access — invite users, manage all data, settings |
| **Senior** | Most functions — manage properties, owners, upload data |
| **Admin** | Limited management — view and edit assigned data |
| **Client** | Read-only — can only view their own property/listing data |

## Database (3 migrations)

### Migration 1: Profiles table
- `profiles` table (id uuid PK → auth.users, display_name, avatar_url, created_at, updated_at)
- Trigger on `auth.users` insert to auto-create profile
- RLS: users read/update own profile; super users read all

### Migration 2: User roles
- `app_role` enum: `super`, `senior`, `admin`, `client`
- `user_roles` table (id, user_id FK → auth.users, role app_role, unique(user_id, role))
- Security definer function `has_role(user_id, role)` to avoid RLS recursion
- RLS: only super users can manage roles; users can read own role

### Migration 3: Update core table RLS
- `property_owners`, `listings`, `reservations`, `upload_batches` RLS policies use `has_role()`:
  - Super/Senior/Admin: full or scoped access
  - Client: SELECT only on listings linked to their owner record (requires a `user_id` column on `property_owners` to link clients to their owner profile)

## Frontend

### 1. Login page (`/auth`)
- Email + magic link only (no signup tab, no password fields)
- Premium glassmorphism design matching the dark theme
- "Request Access" note explaining invite-only policy

### 2. Auth context (`AuthContext.tsx`)
- `onAuthStateChange` listener, provides `user`, `session`, `profile`, `role`
- Fetches role from `user_roles` table after auth
- `useRole()` hook for role checks

### 3. Protected route (`ProtectedRoute.tsx`)
- Redirects to `/auth` if unauthenticated
- Optional `requiredRoles` prop to gate specific pages by role

### 4. Invite user flow (Super users only)
- "Invite User" button in Settings page
- Form: email, role selection
- Calls `supabase.auth.admin.inviteUserByEmail()` via an edge function (admin API requires service role key)
- Edge function `invite-user`: validates caller is Super, sends invite, pre-assigns role

### 5. Sidebar updates
- Show user email/name and role badge at bottom
- Sign out button
- Conditionally show/hide nav items based on role (e.g., Client only sees Dashboard + Properties)

### 6. Route protection by role
| Route | Super | Senior | Admin | Client |
|-------|-------|--------|-------|--------|
| Dashboard | yes | yes | yes | yes (own data) |
| Properties | yes | yes | yes | yes (own only) |
| Owners | yes | yes | no | no |
| Upload | yes | yes | no | no |
| Settings | yes | no | no | no |

## Edge Function: `invite-user`
- Receives `{ email, role }` from frontend
- Verifies caller has `super` role (via service role key + user_roles check)
- Calls Supabase Admin API `inviteUserByEmail`
- Inserts role into `user_roles` for the invited user
- Returns success/error

## Implementation Order
1. Database migrations (profiles → roles → core table RLS)
2. Edge function for invites
3. Auth context + protected routes
4. Login page
5. Sidebar role display + nav gating
6. Invite UI in Settings

