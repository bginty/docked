# Phase 1 marketplace — local operational acceptance

14 October 2026. Continuation of `ed8bc02c` and `5694e454` on `pivot/fantasy-cards-preview-v1`. Barry's marketplace additions are retained.

**Decision: NOT READY for full operational acceptance.** Real multi-connection PostgreSQL acceptance now passes. Actual application HTTP → Supabase Auth → database acceptance remains unexecuted because the local Auth stack cannot start. No deployment, hosted database access, member operation, payment, invitation or message occurred. No application migration or production behavior was changed in this continuation.

## Infrastructure diagnosis and supported alternative

Docker Desktop is installed (4.88.1; CLI 29.7.2). Starting its existing executable did not start an engine. The backend log at 04:44:11 UTC records a crash initializing the Ingest server: it cannot remove `C:/Users/61412/AppData/Local/Docker/run/sailor-ingest.sock` — “The file cannot be accessed by the system.” The Desktop error dialog offers Quit or factory reset. The Linux engine pipe remains absent and `docker info` has no Server result. WSL2 and the docker-desktop distribution exist; this is NOT evidence that virtualization is absent. No factory reset, permissions change, socket deletion, tenant change or hosted workaround was attempted.

The earlier claim that PostgreSQL was unavailable because it was not on PATH is superseded. The repository already has the pinned `embedded-postgres@17.10.0-beta.17` Windows runner in `tmp/free-play-postgres-runtime`. Despite the package name, this runs a **real PostgreSQL 17.10 server with separate connections**, not PGlite. It creates a fresh loopback-only database, random password and port. The added `--marketplace-phase-one` option runs the existing store/SQL against isolated fixtures; it refuses a non-loopback/non-test database target. No new runtime dependency or service was purchased or installed.

Run:

```text
node scripts/fantasy-production-local-postgres.mjs --marketplace-phase-one
```

The installed Supabase CLI supports the standard local Docker stack. No existing local GoTrue binary or alternative Podman/nerdctl/Go runtime was found. Native PostgreSQL alone cannot provide Supabase Auth. See [official local-stack requirements](https://supabase.com/docs/guides/local-development/cli/getting-started). Do not replace authentication with a fake service and call that acceptance.

**Minimum unblock action:** quit the Docker error dialog and restart Windows/Docker Desktop normally, then verify `docker info` returns a Server section. This is a recovery attempt, not a guaranteed fix. If the same socket error remains, repair that specific Docker startup fault through Docker's supported troubleshooting; do not factory-reset or bypass permissions. Once the engine works, use an isolated local Supabase project/ports and local mail sink, with no hosted credentials, SMTP delivery, production hooks or linked remote project. Re-run the real Next application against that stack with fresh local QA users. No owner/Barry login or hosted access is needed.

## Executed evidence — keep these categories separate

| Category | Result and limits |
|---|---|
| Native PostgreSQL | PASS: [receipt](qa/marketplace-operational/postgres.json). Three distinct runtime-role backend PIDs. `pg_stat_activity` confirms two blocked connections before releasing the shared advisory lock for buyer/buyer, cancel/buy and swap/buy races. |
| Distinct buyers | Exactly one settlement. Durable 1,000-credit receipt retains 75 commission / 925 seller proceeds. Competing buyers have different fixture identities. |
| Cancel / swap races | Cancellation or purchase wins once. An accepted reserved swap transfers once and makes the obsolete listing cancelled; competing purchase is rejected. |
| Competition integration | Real `seven_command` rejects a listed/lost-ownership new entry against purchase. Salary Cap and Open edit/purchase races retain the original complete entry. Same-card use across both modes blocks pre-lock transfer. **Inventory and identity functions are explicit local test adapters**, not proof of authenticated catalogue mapping. |
| Kickoff / historical entitlement | Real server clock crosses the fixture deadline; actual lock processing creates 14 snapshots across the two modes. Replacing a started player is rejected; a later permitted transfer preserves all saved scoring inputs. This tests before/after the boundary, not an HTTP request synchronized to the exact microsecond. A completed scoring-worker round after transfer is not newly demonstrated by this runner. |
| Recovery / rollback | Repeated original operation ID returns the original durable result without another debit/transfer. Injected AFTER UPDATE error rolls back state, journal, normalized lines and history. Permanent instances/supply unchanged. Wallets nonnegative and actual member-boundary issuance unchanged. |
| SQL authorization | Authenticated SQL role cannot read the private aggregate or call private market context. This does not validate real session/admission/MFA enforcement. |
| Domain + PGlite regression | Marketplace 8/8 and seven-player 7/7 pass. PGlite is serialized, with controlled fixture identity. Seven-player salary, positions, API payload, rounding and lock/privacy regressions are distinct from native contention evidence. |
| Synthetic browser | Re-run passed: listing, review, purchase, lost-response reload/recovery, private projection, expiry/error recovery, keyboard/focus, 360/412/1440 layouts and axe checks. [Receipt](qa/marketplace-phase-one/browser.json). These are actual components/engine with synthetic cookies and in-memory transport, not genuine session refresh. |
| Static checks | Typecheck and lint passed. No runtime application edits requiring another production build were made. Prior build remains historical evidence. |
| Actual authenticated HTTP/database | **BLOCKED / NOT RUN**: seller/buyer login, real token expiry/refresh, account switching, revocation, private receipts and authoritative inventory through application handlers. |
| Physical S24 | **NOT PERFORMED**. No APK or hosted app was changed. |

The first runner drafts exposed test-harness defects (JSON property-order comparison and an incorrect normalized-line column name). Both were corrected; the final receipt is from the successful rerun. No application defect was established by these checks. The evidence file is reset to incomplete when a new native run starts so an earlier pass cannot stand in for a failed attempt.

## Secret findings — no suppression

The unchanged heuristic scanner still returns **FAIL**, now with eight candidate files. [Raw report](qa/marketplace-operational/secret-scan.json) and [review with file hashes/line numbers](qa/marketplace-operational/secret-review.json) contain no credential values.

| Original finding | Evidence / classification |
|---|---|
| `legacy/retired-product/tests/platform/market-data.test.ts` | Explicit fictional database configuration in a retired validation test. |
| `scripts/fantasy-production-local-postgres.mjs` | String interpolation of a newly cryptographically generated password, used only for the disposable loopback DB and redacted in logs. No embedded password. |
| `tests/database/preview-auth-gate.test.ts` | Fictional password in configuration-only auth-gate fixtures. |
| `tests/platform/database-tls.test.ts` | Driver-parsing examples at an `.invalid` hostname; tests explicitly make no connection. |
| `tests/platform/hosted-runtime.test.ts` | Synthetic configuration fixtures and an unused loopback driver test, not a connected credential. |
| `tests/platform/preview-auth.test.ts` | Fictional project/password fixtures for identity rejection. |
| `tests/platform/production-release-tools.test.ts` | Locally generated synthetic output fixture; assertions ensure values do not appear in stdout. |

Additional existing untracked finding: `artifacts/android/Docked-v20-Samsung-install.txt`, line 5, contains a signed token whose decoded scope is `download`, expiring **18 October 2026 10:44:54 UTC**. It is not a synthetic fixture. Decoding does not validate the signature or current remote access. The file remains untouched and excluded from this commit; the token/link is not reproduced. Treat it as a bearer download capability, not an account password. Do not publish it in source or attach it to this review. Revocation/expiry handling, if required, is a separate authorized artifact-provider action. No credential was printed, tested against a remote service or revoked. The seven reviewed false positives do not turn the raw scanner into a PASS.

## Remaining acceptance work

1. Restore the local Docker engine (specific socket crash above), start isolated Supabase Auth, then execute real application HTTP/auth/database acceptance with new local users: seller lists, distinct buyer buys, both private receipts/balances/ownership reconcile; unrelated user denied; genuine expiry/refresh, account switching and interrupted-response recovery pass.
2. Extend that same authenticated path through both-mode entry/edit/transfer races and deadline behavior. Current native SQL contention evidence is substantial but uses fixture identity/inventory. Observe scoring-worker outputs after transfer using the saved round rules; do not substitute unchanged snapshots for a full worker execution.
3. Keep the untracked signed download note out of source/distribution evidence. Raw scan status and reviewed exceptions remain visible.
4. Complete the physical checklist below. Later hosted review/deployment still requires separate authorization; this task authorizes neither.

## S24 checklist for the owner and Barry — pending

Use designated QA accounts/assets on a separately approved connected build; do not mutate existing member teams for verification.

1. Sign in, background/reopen and switch QA accounts. Confirm no previous account's cards, balance or activity flashes on screen.
2. Browse → card details → Sell review. Check fantasy salary is distinct from asking credits, exact card identity and reservation explanation/link.
3. With the second QA buyer, review and buy once. Confirm 100 → 8 fee / 92 proceeds, ownership and both private receipts. Double tap and interrupt/reopen; confirm no duplicate settlement.
4. Cancel a separate listing through review; verify Cancelled versus Sold, Activity filters and receipt access.
5. Exercise network loss/Retry, Back/Escape, keyboard focus, scrolling, bottom safe area and no horizontal overflow. Confirm existing lineup locks and scores remain unchanged after any permitted test transfer.

## Change / review / rollback

Only local verification tooling and evidence/docs changed. No new migration, app feature, dependency, financial policy, account or supply change. Review the local commit diff; do not merge or deploy it as implied acceptance. Rollback is simply not running the optional new test flag (or reverting that test/docs commit through normal review). Never restore a fixture over real state. Local database directories under `tmp/free-play-pg-*` contain synthetic records and are not committed. The preexisting untracked Android installation note is excluded.
