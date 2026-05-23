# Archived modules

This directory contains modules that were active in the proprietary fork of Beacon
but are **disabled in the open-source distribution**. They are kept here so
forks that want a billing or auth story can re-enable them without rewriting
from scratch.

| Module | Original location | Purpose |
|---|---|---|
| `billing/` | `packages/billing/` | Stripe Checkout + webhooks, 5 plan tiers, quota enforcement, referral commissions, guarantee claims |
| `auth/` | `packages/auth/` | Supabase SSR auth (cookie sessions), server clients, sign-up/sign-in flow |

## Why they were removed

The OSS distribution treats every visitor as anonymous with full feature
access. There is no payment story, no plan gating, no daily scan limits.
This keeps the project simple to self-host and matches the "Lighthouse for
Agentic Web Readiness" framing — Lighthouse has no paid tier either.

## Re-enabling

If you want to bring billing or auth back into a fork:

1. **Move the directory back**

   ```bash
   mv archive/billing packages/billing
   mv archive/auth packages/auth
   ```

   pnpm-workspace.yaml uses `packages/*` so re-adding works automatically.

2. **Restore the database columns** that migration `0040_drop_billing_columns.sql`
   removed. The dropped surface includes:
   - `profiles.plan`, `profiles.subscription_status`, `profiles.stripe_customer_id`,
     `profiles.last_billing_event_at`, `profiles.monthly_scans_used`,
     `profiles.quota_period_start`, `profiles.feature_overrides`
   - tables `subscription_events`, `guarantee_claims`, `guarantee_milestones`,
     `affiliates`, `referral_links`, `referral_conversions`, `referral_commissions`,
     `referral_payouts`, `referral_fraud_flags`
   - RPC functions `check_scan_limit`, `check_daily_scan_limit`,
     `check_anonymous_scan_limit`, `rollback_scan_usage`,
     `rollback_anonymous_scan_usage`

   The drizzle snapshot in `archive/billing/` shows the column shapes.

3. **Restore the routes** that were deleted. Look at git history before the
   "OSS conversion" commit to find:
   - `apps/web/src/app/dashboard/`, `apps/web/src/app/admin/`,
     `apps/web/src/app/billing/`, `apps/web/src/app/pricing/`,
     `apps/web/src/app/(auth)/`, `apps/web/src/app/auth/`
   - `apps/web/src/app/api/billing/`, `apps/web/src/app/api/admin/`,
     `apps/web/src/app/api/referral/`, etc.

4. **Re-add the quota checks** in `apps/web/src/app/api/scan/route.ts` and the
   plan gates in `/api/fix`, `/api/analyze`, `/api/report`.

The archived code is unmodified from the day it was deactivated and should
function as before once steps 1–4 are in place.
