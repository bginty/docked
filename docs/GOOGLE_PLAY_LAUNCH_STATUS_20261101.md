# Google Play launch status — 1 November 2026

Public submission: **NO-GO**. The website/policy release is live; Google Play remains internal testing. This report supersedes the migration, privacy-URL and declaration status in the earlier 309b7861 handover, without replacing its genuine isolated TEST evidence.

## Follow-up: confirmed reviewer and approved queue

Updated 1 November, after the owner completed normal reviewer signup/sign-in:

- Queue migration `20261031234304_google_test_reconciliation_queue.sql` is now **applied**, separately approved by the owner. The 06:15:48 UTC transaction preserved twelve protected fingerprints. Queue readback: empty, RLS enabled, no anon/authenticated/service_role/unrelated-runtime access. Encrypted targeted recovery snapshot verified. This supersedes the earlier "prepared, not applied" status below.
- Reviewer email verification initially failed because the approved-beta email allowlist omitted the nominated address, not because the invitation had expired. Existing four recipients were retained and only the nominated reviewer added. Normal resend was accepted by the provider at 06:18 UTC; the user confirmed and signed in. No password reset or verification bypass.
- Reviewer consent/admission is accepted and the account has no privileged role. Genuine browser login revealed separate wallet/multi-sport access rows were missing. Those three existing membership rows were provisioned under the owner's reviewer-setup authority, with the existing programme deadline (31 January 2027). No credits, cards, purchase permission or admin role were granted; other users and feature flags were unchanged.
- **Hosted read-only evidence:** verified reviewer email shown in Profile; zero-credit wallet loads; NFL, AFL and NRL Play render, with seven-, 22- and 13-slot formations respectively. NBA absent from the selector. These are genuine signed-in browser checks, not the previous owner session or mocked fixtures.
- All 18 pack products render with correct sport, quantity and configured prices; zero funds correctly disables purchases. Each sport shows one normal weekly starter pack ready. No pack was opened or purchased. NRL marketplace and unified Social load. Direct owner operations navigation remains behind the security gate, and the authenticated NBA capability endpoint returns `allowed:false`.
- **Full reviewer acceptance still blocked:** NRL player picker has no eligible owned/free-Core cards; free-Core programmes remain disabled. NFL currently resolves to closed Week 7 with no next selectable week. Do not mark Google's declaration of full feature access complete, or imply the user can build/enter a team. A testable eligible-round/free-Core programme and supported reviewer access duration must be approved before submission. No round was created, unlocked or activated during this check.
- An empty Google Pub/Sub topic has been created without subscription, retention, export, traffic or publisher permissions. Topic-only publisher and scoped keyless push identity permissions are prepared for owner confirmation. Genuine Google delivery/refund acceptance remains pending.
- Android v27/1.26 and website deployment remain unchanged. Script lint and full TypeScript checks passed again after the provisioning work. Financial aggregate remains revision **226**, hash **5f6b1926b820cb90f68d9a6a01ab5d5e**. Existing automated test results below remain applicable; they were not needlessly rerun.
- Supabase security advisors are unchanged before/after the queue migration: 219 existing informational private-RLS/no-policy findings and the existing disabled leaked-password-protection warning; no queue-specific finding. See [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) for the remaining security setting. No policies were broadened to suppress advice.

Evidence: `qa/customer-billing-20261101/queue-applied.json`, `reviewer-mail-repair.json`, `reviewer-recovery-inspected.json`, `reviewer-access-applied.json`, `reviewer-hosted-observations.json` and signed-in screenshots. Credentials and invitation tokens remain outside Git.

## Deployed and preserved

- Website: https://docked.com.au, commit `5a62f4ee5594dffba1812c1ce6b1c0983efbf962`.
- Vercel deployment `dpl_FpXCzRPTNYFtK7DVTj5dAXW3PiYp`, READY. Candidate https://docked-production-hq7rml7id-briant-s-projects.vercel.app. Staged, checked, then promoted; live identity independently read back.
- NFL/AFL/NRL remain the customer sport allowlist. NBA code/data remain preserved and hidden. Native mobile capabilities still require authentication and report billing disabled. No public-registration, real-money, withdrawal, prize, permanent-issuance or statistics-feed activation.
- The reused release receipt's legacy `privateNba: true` field names the shared private multi-sport infrastructure required by AFL/NRL; it is not NBA customer activation. The authoritative customer sport allowlist excludes basketball. The copied commerce receipt is provenance for an earlier authorised setup, not a new commerce migration in this release.
- Wallet after deployment: revision **226**, document hash **5f6b1926b820cb90f68d9a6a01ab5d5e**, matching before migration. Customer Google receipts **0**, purchase admissions **0**, enabled free-Core programmes **0**.
- No customer purchase, pack opening, balance adjustment, prize award or account deletion was used for verification. The reviewer completed normal account creation and consent, followed by the narrowly scoped membership repair described above. Normal weekly pack entitlements are visible; no collectible cards were opened/issued by a verification action.

## Published policies

All four pages return HTTP 200 publicly without login. Version: **2026-11-01-release-preparation-v1**. Exact source is `config/launch-policy-content.json`; the release record contains its SHA-256.

| URL | Published scope |
| --- | --- |
| https://docked.com.au/privacy | Current service/privacy notice, including actual test-mode limitations |
| https://docked.com.au/refund-policy | Current TEST purchasing and proposed paid-release terms; unresolved spent-credit recovery identified |
| https://docked.com.au/retention | Existing beta targets, provider limitations and outstanding commercial retention decisions |
| https://docked.com.au/commercial-policy | Proposed public model, explicitly not payment activation or legal approval |
| https://docked.com.au/account-deletion | Existing public deletion resource |

Historical accepted policy content, consent versions and hashes remain unchanged. Publication is not a replacement of previous consent or proof of legal review. New public-registration consent configuration still needs approval against the final release model.

## Billing implementation and evidence boundary

- Ordinary customer checkout session now returns the authoritative member. The UI refuses a session/account mismatch before starting checkout; server receipt binding, product allocation, token replay protection and wallet transactions remain authoritative.
- Deployed notification and worker routes remain disabled/protected. Google JWT validation checks exact audience, verified service identity, subscription, package and bounded payload. Durable insertion precedes acknowledgement.
- Reconciliation implementation has bounded sweeps, SKIP LOCKED leases, retry/backoff, attention state, consumption outbox and repeat/refund protection. Only existing bound TEST receipts can be reconciled; expired new-purchase admission does not prevent refund recovery.
- The previous genuine Samsung Google TEST purchases/refunds are still valid isolated evidence. They used a paired synthetic subject and shared settlement engine, **not the ordinary Supabase-authenticated customer wallet/reveal journey**.
- No new ordinary-member Google checkout or genuine RTDN push occurred. Limited authenticated customer browser acceptance is now recorded above. Synthetic JWT/provider tests are not evidence of Google push delivery. No real-money acceptance is claimed.
- Google AU products `docked_credits_4900_v1` and `docked_credits_9900_v1` were read back INACTIVE. The TEST verifier rejects real purchases. Commercial settlement is not enabled by flipping a feature flag.

## Production migrations

Applied atomically at **2026-10-31T23:56:08Z** (1 November AEDT):

1. `20261031123611_free_core_gameplay_eligibility.sql` — disabled, versioned gameplay eligibility; no collectible issuance or historical rewrites.
2. `20261031123931_member_google_test_receipts.sql` — empty private admission/receipt/outbox records and restricted functions; no purchase grant or wallet credit.

Exact hashes, backup receipt and migration-ledger evidence are in `qa/customer-billing-20261101/migrations-applied.json`. Twelve protected table fingerprints were unchanged. Encrypted recovery snapshot covers eleven relevant tables and three replaced function definitions; append-only wallet history was fingerprinted instead of downloading its 313 MB aggregate. This is a targeted migration backup, not full Auth/storage disaster recovery. Raw DDL is not blindly replayable: the reviewed runner skips exact version/source history and rejects mismatches.

**Separately approved and applied at 06:15:48 UTC:** `20261031234304_google_test_reconciliation_queue.sql`. It creates an empty private RLS queue and indexes; protected data fingerprints unchanged. An empty Pub/Sub topic now exists, but no publisher IAM/subscription, worker secret or schedule has been activated. See `GOOGLE_NOTIFICATION_ACTIVATION_20261101.md` for exact existing-infrastructure setup and scoped permissions.

Rollback: return the website alias to `dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9` / commit `673a751b2ec755836ef31dfb9b967786861c7b99`. Keep additive receipt/audit tables disabled. Do not overwrite later customer activity with backup wallet documents or delete financial history. Any function restoration requires an operator-reviewed disabled-programme window.

## Tests actually executed

| Check | Actual result |
| --- | --- |
| Platform suite | 692 passed; 0 failures/skips |
| Database suite | 226 passed; 0 failures/skips |
| Disposable PostgreSQL migration/deletion integration | 12 checks passed; 251 pre-existing table fingerprints preserved; rollback/history replay; four concurrent Auth-erasure retries |
| Disposable PostgreSQL wallet/pack/refund concurrency | 6 checks passed; 20 duplicate notifications, 12 reconciliation workers, 16 purchases/10 openings, stale events and exhausted retries |
| TypeScript, lint, production build | Passed; final committed release also built READY on Vercel |
| Candidate protected HTTP checks | 7 passed; real Vercel-authenticated requests, no member authentication |
| Production HTTP/policy checks | 11 passed; public policy version, registration closed, protected/disabled routes |
| Rendered policy pages | Desktop and 390-pixel mobile inspection; readable, no horizontal overflow; privacy/refund navigation verified |
| Android artifact | Existing v27/1.26 AAB hash and Google signing readback verified; no unnecessary rebuild/device retest |

Database mutation tests used disposable PostgreSQL, mocked Google/Auth transport and synthetic members. They did not connect to customer ledgers. The client-boundary scanner examined 92 build assets without finding configured secret markers; this was not a special injected-canary build. Limited genuine reviewer browser checks now pass as recorded above; full gameplay, native customer checkout and refund acceptance remain pending.

## Console and Android

- Console dashboard: **8/11 initial tasks complete**, Production **Inactive**, release task locked until initial setup completes.
- Privacy URL saved to https://docked.com.au/privacy. Data Safety draft saved with actual collected-data categories and deletion URL; not submitted for review.
- Remaining declarations: **Sign in details; Target audience and content; final Data Safety**. Google blocks target-audience setup until sign-in details are complete.
- Seven actioned declarations observed: privacy, financial features, advertising ID, content rating, health, government and ads. Category/contact details and store listing are marked complete. These are saved declarations, not Google approval of the commercial model.
- Nominated reviewer: ordinary signup, email confirmation, consent and browser login complete. Initial invite expiry **2026-11-06T23:57:40.508Z** no longer limits accepted signup. Existing multi-sport beta programme runs until **2027-01-31 UTC**. No invented credentials, account bypass or owner password shared. Console username/name prepared but not saved; password remains owner-held and the full-access declaration remains unticked pending actual playable access.
- Android package `docked.fantasy`, **27 / 1.26**, existing internal release. AAB `artifacts/android/Docked-public-candidate.aab`, SHA-256 `3e76cd5e0f0c15f7bcdc02b339d088ac3998a07f05233fa4b0188efe6f0d594e`.
- v27 has no QA launcher and an empty normal native purchase allowlist. Website/server changes do not require an AAB rebuild. Ordinary member TEST checkout requires a separately restricted test-capable allowlist/build and an authenticated Play licence-test environment. The disconnected Samsung's prior successful v27 tests were not repeated.
- Planned public territory remains Australia. No Production track or country rollout was activated; Console currently prevents preparing the final release through its locked setup workflow.

## Exact remaining actions

1. **Reviewer readiness:** finish verified free-Core/eligible-round access and authorised paid-content testing, then the owner securely enters the existing password directly in Console. Do not send it in chat or recreate the account. Only attest full access when true; finish target audience (adult-only actual policy) and Data Safety. Support access through the full review window, including after the existing beta deadline if necessary.
2. **Billing infrastructure approval:** queue migration approval is complete. Authorize the prepared topic-only Pub/Sub publisher and scoped keyless push-identity grants. Existing Vercel/Supabase can host the endpoint and minute worker; no new paid host is proposed. Verify available no-charge Pub/Sub quota, configure alerts and observe real test notification plus refund delivery.
3. **Ordinary customer TEST acceptance:** use a dedicated confirmed test member with bounded admission, isolated funding/inventory and a test-capable native configuration. Complete wallet, pack reveal, refund-before/after-spend and duplicate protection. A real Play test environment is required for the final checkout boundary; the disconnected phone does not block the completed server work.
4. **Public configuration:** approve the final release-policy/consent versions, eligible AU registration and free-Core programme configuration; then verify the full new-member email-confirmation → consent → free gameplay → deletion journey in the protected public-mode environment. Current public-mode deletion integration passed locally with mocked Auth, not against a disposable hosted Auth member. Registration stays closed meanwhile.
5. **Commercial decisions:** settle player/data/card rights for public use; legal/platform classification of paid random cards, rarity-based performance and marketplace resale; spent-credit refund recovery/notices/appeals; final commercial retention and processor obligations. Paid products remain part of the proposed model, not removed. A free/no-prize release still needs its own accurate rights, privacy, reviewer and registration acceptance.
6. **Final approval:** once the exact free/paid feature configuration passes and Console permits it, request explicit owner approval for the Australian public submission/rollout. Payment activation, withdrawals and prizes remain separate decisions. Do not submit the QA build publicly.

Google's [payments guidance](https://support.google.com/googleplay/android-developer/answer/10281818) ordinarily requires Play Billing for digital goods and distinguishes unsupported peer-to-peer/gambling payments; it does not establish Docked's classification. [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) require in-app and external deletion-request paths and appropriate handling of associated data. The current retention/process limitations are disclosed; no external legal or Google approval is claimed.

**Decision:** website and protected engineering deployment complete; Google public submission and paid launch remain **NO-GO** for the specific outstanding items above. No final public-release approval is requested prematurely.
