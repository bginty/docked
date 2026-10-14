# Phase 1 marketplace — local operational acceptance

> Historical checkpoint. [Current release acceptance](MARKETPLACE_RELEASE.md) supersedes the incomplete-chain and release-pending conclusions below. Real authenticated catalogue → both-mode entries → locks → transfer → worker → correction now passes, including the actual restricted worker role. Preserve the earlier evidence categories and failures; do not treat old blockers as current.

14 October 2026. Branch `pivot/fantasy-cards-preview-v1`; continued after `512e080c`, preserving `ed8bc02c` / `5694e454` and Barry's additions.

## Current decision

**PASS for the local authenticated marketplace journey and separate-connection transaction tests. Full operational/release acceptance is not claimed.** The earlier Docker/Auth infrastructure blocker is resolved. Remaining coverage limits are the combined authenticated competition/catalogue/scoring-worker journey and physical S24 acceptance, described below. No deployment, hosted database access, existing-member mutation, payment, invitation or message occurred.

## What actually ran

| Evidence category | Actual result |
|---|---|
| Real HTTP → Auth → PostgreSQL | [PASS receipt](qa/marketplace-authenticated/http.json). Actual Next handlers, GoTrue sessions/cookies, all repository migrations and `docked_beta_app` runtime role. Only isolated `.invalid` QA users and synthetic assets. |
| Sale and recovery | Seller lists; a different signed-in buyer reviews/buys; balances, current owner, SOLD status and both private durable receipts reconcile. Discarding the first response and retrying its original operation ID returns the same result without another debit. |
| Authorization | Ordinary AAL1 member admitted; owner AAL1 denied; unadmitted identity denied. Unrelated user cannot list/cancel another owner's asset or see the sale receipt. A forged `member` filter is ignored and the server returns the actual caller's identity. |
| Sessions | Actual logout rejects copied old cookies. Account switching in the same cookie jar returns only the new identity. The real 120-second local JWT expires; reopening persisted cookies refreshes through GoTrue and returns the correct account. |
| Authenticated buyer race | Two DISTINCT signed-in HTTP buyers reach separate blocked PostgreSQL connections. Exactly one purchase succeeds. 100 credits → 8 commission + 92 proceeds. The ordinary sale verifies 1,000 → 75 + 925. |
| Actual hydrated browser | [PASS receipt](qa/marketplace-authenticated/browser.json). A 412px browser uses the real session, receives `/api/marketplace` 200, finishes loading and reloads. [Current screenshot](qa/marketplace-authenticated/member-market-mobile.png). Not a physical Android/WebView test. |
| Native multi-connection PostgreSQL | [PASS receipt](qa/marketplace-operational/postgres.json), rerun after the fixture change. Three runtime-role PIDs; buyer/buyer, cancel/buy, swap/buy, submit/edit versus purchase in both modes, exact server-time lock predicate, same-ID recovery, injected settlement rollback, supply/serial integrity and nonnegative wallets. No new member-boundary credit issuance. |
| Competition race limitation | Native tests use actual `seven_command`, reservations, triggers and locks, but explicit fixture identity/inventory adapters. They are NOT authenticated competition/catalogue end-to-end tests. The test crosses the real deadline, not an HTTP request synchronized to an exact microsecond. |
| Locked scoring limitation | All 14 saved slot snapshots across Salary Cap/Open remain identical after permitted transfer. This run does not execute an entire imported-statistics worker round after the transfer. Existing scoring unit evidence is separate. |
| Domain/PGlite regression | [24/24 PASS](qa/marketplace-authenticated/regression.txt). Includes marketplace, seven-slot rules, auth target guards, fixture hash integrity and CSP separation. PGlite is serialized, not contention evidence. |
| Synthetic browser | Prior [PASS receipt](qa/marketplace-phase-one/browser.json): desktop/mobile layouts, keyboard/focus, axe, sale/cancel/recovery UI. Synthetic transport/cookies, distinct from the real browser check above. |
| Static checks | Typecheck and repository lint pass. Clean-environment production build recorded separately in [build log](qa/marketplace-authenticated/build.txt); no hosted secrets/configuration are used. |
| Physical S24 / hosted | NOT PERFORMED. No APK, domain or hosted state changed. |

## Docker and reproducible local setup

Docker Desktop 4.88.1 / engine 29.7.2 now responds. The previous `sailor-ingest.sock` startup failure and request to restart Docker are superseded; no further owner infrastructure action is needed.

The CLI attempted newer image downloads but stalled. The supported alternative uses the documented self-hosted Auth/Postgres/Kong subset with already-installed pinned images: PostgreSQL 17.6.1.166, GoTrue 2.195.0, Kong 2.8.1. No image/package upgrade, paid service or permissions workaround. This Docker PostgreSQL version is separate from the native PostgreSQL 17.10 runner.

Only `docked-market-http` containers/network/volumes are used. PostgreSQL and the gateway bind to 127.0.0.1 ports 55322/55321; the app binds to 3033. Auth has only the internal network, no SMTP, external hooks or outbound email. Unrelated Docker projects are untouched. Failed local fixture/bootstrap volumes are preserved separately; no database reset or destructive cleanup occurred.

```text
node scripts/marketplace-auth-infra.mjs
docker compose -f tmp/marketplace-auth/compose.private.json up -d --force-recreate
node --import tsx scripts/marketplace-auth-local.ts
node --import tsx scripts/marketplace-auth-local.ts --browser-only
node scripts/fantasy-production-local-postgres.mjs --marketplace-phase-one
```

Generated passwords, local signing keys and QA account details remain in ignored `tmp/marketplace-auth`. Never copy them into hosted configuration. The copied application has no `.env`; only an allowlisted environment, public local Auth key and restricted database login. Admin Auth credentials are used only by the isolated fixture harness. The harness refuses non-loopback destinations. Completed synthetic transactions remain recorded; repeated full purchase runs can exhaust the finite fixture inventory/balances. Browser-only repeats do not purchase. Use a new isolated fixture database for a new campaign rather than resetting genuine data or weakening supply guards.

References: [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started), [self-hosted Auth configuration](https://supabase.com/docs/guides/self-hosting/auth/config). This is real Auth, not an emulator or mocked token issuer.

## Fixes and test-harness repairs

- Added an explicit, nondeployable local marketplace target profile. It only allows development on exact loopback origins/ports with the restricted runtime DB role, admission/MFA controls and paid/sending flags off. Hosted/production use is rejected. Existing authentication, admission and transaction guards still execute.
- Confirmed a local browser hydration failure: CSP blocked Webpack development eval, leaving the page on Loading market. [Captured error](qa/marketplace-authenticated/browser-errors.json). Only the validated local profile permits that development runtime; normal/hosted CSP is unchanged and tested. This is not evidence that Barry's deployed loading report had the same cause.
- Generate fixture journals for actual local Auth IDs. Replacing UUIDs after generation invalidated their hashes; the real guard correctly rejected that fixture. The failed fixture was retained separately.
- Corrected harness expectations: activity uses a prefixed event identity plus `listing`, and an unsupported identity query parameter is stripped rather than returning 400. Neither observation was a production authorization defect.
- Refresh PostgreSQL activity snapshots when observing contention. Await all competing responses before teardown; request errors omit Playwright's cookie-bearing call logs from saved reports.

No migration, financial rule, member balance, ownership rule, scoring rule or permanent cap changed.

## Secret findings — raw FAIL retained

[Current scanner output](qa/marketplace-authenticated/secret-scan.json) has nine candidate files. [Evidence classification](qa/marketplace-authenticated/secret-review.json) verifies prior file hashes without printing credential values. Scanner patterns were not suppressed or changed.

| Finding | Classification |
|---|---|
| Retired `market-data.test.ts` | Fictional configuration fixture. |
| `fantasy-production-local-postgres.mjs` | Runtime interpolation of a new random local password. |
| `preview-auth-gate.test.ts` | Fictional auth-gate configuration. |
| `database-tls.test.ts` | Invalid-host parsing examples; no connection. |
| `hosted-runtime.test.ts` | Synthetic configuration/local driver fixtures. |
| `preview-auth.test.ts` | Fictional project/password identity rejection fixtures. |
| `production-release-tools.test.ts` | Generated synthetic fixtures with output redaction assertions. |
| New `marketplace-auth-infra.mjs` | Runtime interpolation of newly generated local-only database passwords into ignored configuration; no embedded credential. |
| Existing untracked Android installation note | A real bearer download capability, not a synthetic fixture. Decoded download scope expires 18 October 2026 10:44:54 UTC; signature/remote validity not tested. Unchanged and excluded from the commit. Do not publish it in source. No revocation or hosted action performed. |

## Remaining limits and next acceptance boundary

There is no remaining Docker or real Auth prerequisite. Local marketplace HTTP/auth/transaction acceptance passes. A claim that the entire competition/scoring release is operational would still require running the authenticated catalogue mapping → both-mode entry/edit → scoring-worker flow without the native suite's fixture mapping adapters. The current evidence must not be relabelled as that combined acceptance.

A later hosted review/deployment is outside this authorization. Keep the signed download note out of source. Physical S24 acceptance remains pending; no user action to repair the local infrastructure is requested.

## Short S24 checklist — not performed

Use isolated QA accounts/assets on a separately approved connected build, not existing member teams.

1. Sign in, background/reopen and switch accounts; no prior account's cards, balance or activity should appear.
2. Browse → details → Sell Review. Check fantasy salary versus asking credits, exact card instance and owner-only reservation links.
3. Second QA buyer purchases once. Verify both receipts and balances; double-tap/interruption/reopen must not settle twice.
4. Cancel another listing through confirmation. Check Sold versus Cancelled and Activity filters.
5. Test network loss/Retry, keyboard, Back, safe areas, scrolling and no horizontal overflow. Verify locked team history survives an allowed transfer.

## Review and rollback

Local commit only: no push, merge or deployment. Review the guard/CSP changes and harness separately from evidence. Roll back by not enabling `DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE`, or revert the local commit through normal review. Stop only this task's stack with `docker compose -f tmp/marketplace-auth/compose.private.json stop`; preserve its volumes if needed for inspection. Never restore local fixtures over hosted state. Existing member data and the untracked Android note are untouched.
