# Profile and Weekly Core Pack review

Implementation date: 16 October 2026. Local review only. No hosted migration, enrolment, deployment, scheduled job or member-asset mutation was performed.

## Reward policy

- `weekly-core-nfl-v1`: four Core cards, drawn from the existing eligible NFL QB/RB/WR/TE roster. Four different underlying players; previously owned players remain eligible. No guaranteed position mix. No credit charge.
- A single account-wide schedule begins at actual feature enrolment. Period zero delivers the first sealed pack immediately; subsequent periods are exactly 604,800 elapsed seconds apart in UTC.
- Existing accounts do not earn periods before enrolment. Newly admitted/setup-complete accounts enrol on the next job run or their first Profile/My Packs reconciliation, whichever happens first.
- Opening, changing sport/device or replaying never moves the anchor. Sealed rewards accumulate without expiry. The member may open one at a time.
- The existing roster freshness/active-player requirements and Core edition issuance guards remain in force. If fewer than four eligible players are available, opening rolls back completely and the pack remains sealed. There is no rarity substitution.
- Core cards retain their existing non-transferable rules. Paid Standard/Premium configurations, existing Starter allocations, card identities, wallet economics and competition scoring are unchanged.
- Account restrictions prevent enrolment, reconciliation and opening. Existing schedule anchors are retained; on restored eligibility, due periods since enrolment reconcile. Disabling the feature does not delete entitlements or receipts.

## Implementation

Migration: `supabase/migrations/20261016093000_weekly_core_rewards.sql`.

The migration adds a disabled control row, immutable account schedule, unique `(user_id, period)` sealed entitlements, and restricted functions. It creates no rewards on installation. Tables have RLS and no direct application/browser/service-role privileges. Authenticated server requests use the existing admission/session checks; only the worker role can execute the batch job.

All grant/open operations use the existing transaction advisory lock. A grant and its schedule cursor update commit together. Opening reuses `beta_fantasy.mint`, existing ownership/serial records and the request-id ledger. Random UUID ordering uses PostgreSQL secure randomness. Four awards, the immutable receipt and idempotency record commit in one transaction. The same pack returns its saved receipt even with a different retry key; reusing a key for another operation is rejected. No wallet debit is involved.

Profile and My Packs consume the same private `/api/weekly-core` records. Reveal, reduced motion, sound, Escape and replay use the existing `PackOpening` viewer. Weekly artwork suppresses jersey numbers without rewriting player metadata. Original Starter Pack history reads its saved authoritative receipt and replays it without issuing anything.

The shared `WorkspaceWalletProvider` serves the header and page consumers. It reads `wallet.spendable`, including existing reservation deductions, from `/api/test-wallet`. It refreshes on navigation, wallet mutation/resume, visibility and reconnect; aborts superseded requests; and has no persistent cross-account cache. Missing balances display “Balance unavailable”, never zero. Public shells do not mount it.

Profile rarity links reuse `RarityCounts` from Cards. Card and entry counts are sport-scoped; entries are distinct submitted competition IDs. Packs opened count saved purchased, weekly and original/legacy receipts. Completed swaps count accepted member swaps, not listings, declined offers or an inferred financial volume. The latter two totals are explicitly account-wide. No competition-point aggregate or portfolio value is displayed. Email is masked on the server; verification uses the authenticated user's real confirmation field, or an unavailable state.

Key UI files: `profile-overview.tsx`, `weekly-core-panel.tsx`, `starter-pack-history.tsx`, `rarity-counts.tsx`, `workspace-wallet-link.tsx`, `use-workspace-wallet.ts`, `app-shell.tsx`, `fantasy-screen.tsx`, `pack-shop.tsx`, `pack-opening.tsx`, `pack-artwork.tsx`, `pwa-status.tsx`, and `play-cards.css`/`pack-shop.css`. Server projection/API files: `server/weekly-core.ts`, `app/api/weekly-core/route.ts`, `core/weekly-core.ts`, `core/profile-overview.ts`, the private Fantasy page and `ownProfileIdentity` in the existing community service. Wallet and Withdrawals success paths notify the shared provider.

## Reviewed activation procedure — not executed

1. Review and back up the intended environment under the existing deployment process. Apply the additive migration in normal order. Verify `weekly_core_control.enabled` is still false and there are zero schedule/pack rows before activation.
2. Deploy the reviewed application. Set `DOCKED_WEEKLY_CORE_ENABLED=true` only in the approved invited beta environment. Existing `DOCKED_BETA_STAGING`, NFL roster and admission/session controls remain required. No public enrolment is added.
3. Reuse the existing PostgreSQL `pg_cron` infrastructure; no additional paid service is needed. A privileged operator may register the following job only after activation approval:

   ```sql
   select cron.schedule(
     'docked-weekly-core', '*/5 * * * *',
     'select sports_feed.weekly_core_job()'
   );
   update sports_feed.weekly_core_control set enabled=true where id=true;
   select sports_feed.weekly_core_job();
   ```

   Job installation must use an authorised database operator; do not grant scheduler privileges to web users. The existing `docked_nfl_worker` role can execute the job function without direct access to reward tables. Do not run existing hosted provisioning scripts merely to test this implementation.

4. Check `cron.job_run_details` and counts below. The initial job enrols eligible existing accounts at that run's server time, with no earlier rewards. Each run handles up to 100 due accounts, at most 500 periods per account. Additional runs safely drain a longer backlog; the regular five-minute cadence handles new admissions while offline. Screen reconciliation provides an independent recovery path.

   ```sql
   select count(*) as schedules from sports_feed.weekly_core_schedules;
   select count(*) as unopened from sports_feed.weekly_core_packs where opened_at is null;
   select count(*) as due_accounts
   from sports_feed.weekly_core_schedules s
   where sports_feed.weekly_core_allowed(s.user_id)
     and s.enrolled_at + s.next_period * interval '604800 seconds' <= clock_timestamp();
   ```

5. Recovery: rerun `sports_feed.weekly_core_job()`; never manually advance `next_period`, backdate enrolment, insert cards or edit receipts. A failed transaction leaves its entitlements/cursor unchanged. A failed open leaves the sealed pack intact. Lost opening responses can retry the same pack to recover the committed receipt.
6. Pause by disabling the control and unscheduling `docked-weekly-core`; also disable the server feature flag when appropriate. The application shows a disabled state. Preserve all reward rows/history. Re-enabling retains existing anchors and reconciles elapsed periods; it does not start another enrolment schedule.

No real-money redemption, document collection, settlement or paid infrastructure is enabled by this work.

## Verification scope

- `tests/database/weekly-core.test.ts` applies the migrations to an isolated runtime and covers disabled installation, first grants, exact elapsed periods, no pre-enrolment rewards, offline catch-up, restrictions, four distinct eligible Core players, already-owned players, no charges, no Starter mutation, atomic failure, immutable receipts, cross-account denial and role permissions.
- The same test also runs in disposable native PostgreSQL with six concurrent connections for member reconciliation, scheduled jobs and opening. Identity helpers are synthetic local fixtures; this is not hosted Supabase login acceptance.
- `tests/platform/weekly-core.test.ts` covers policy/countdown and private email/verification projection.
- `scripts/weekly-core-browser.ts` renders the actual React components against isolated HTTP fixtures at 1440, 1024, 412 and 360px. It checks layout, serious/critical Axe findings, a single shared wallet request, reserve-aware header display, unavailable balance, refresh, opening/replay, original Starter replay, multiple packs, lost-response retry, number-free weekly artwork, install availability and manipulated browser wall time. Header route screenshots exercise the shared shell, not authenticated hosted backends for those routes.
- Screenshots are real Edge browser renders with synthetic data. No physical Samsung S24 testing or hosted reward grants have been performed.

Test logs and final screenshot paths are recorded in `docs/qa/weekly-core/acceptance.json`. Earlier failed/partial attempts are retained alongside the final evidence; they must not be represented as uninterrupted passes.
