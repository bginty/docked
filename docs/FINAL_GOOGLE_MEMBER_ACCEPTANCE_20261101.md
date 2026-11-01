# Google Play ordinary-member acceptance — 1 November 2026

**Real Google TEST checkout, both nine-card pack families, and genuine refund notifications were observed. Public/paid launch remains NO-GO.** This supersedes the earlier “ordinary-member purchase pending” checkpoint, not the outstanding commercial approval or reviewer/deletion requirements.

## Actual hosted and physical evidence

Samsung SM-S921B, Google Play-installed `docked.fantasy`, version **28 / 1.27-member-test**, installer `com.android.vending`, HTTPS `https://docked.com.au/app`. Testing used the existing confirmed ordinary QA member ending `…96db7`, not the owner's account. Passwords/tokens are absent from this report. Its prior 400 test credits and 52 isolated cards were preserved as the baseline rather than reset.

Three genuine **A$49 / 4,900-credit Google licence-test orders** displayed “Test card, always approves” and “you will not be charged”. The real Google server verified the signed-in account binding. Each receipt was consumed once by the outbox. No real payment method was used.

| Journey (UTC) | Observed result |
| --- | --- |
| First purchase 09:10:52 | Correct member wallet 400 → 5,300. Receipt prefix `56ff87fa`. |
| Refund before spending 09:15:09 | Google accepted the refund. Genuine void notification arrived 09:15:11. Scheduled processing reversed the 4,900 once; wallet returned to 400. Later void processing did not reverse twice. |
| Second purchase 09:18:36 | Wallet 400 → 5,300. Receipt prefix `feaa873c`. |
| NRL Premium 9 Pack 09:20 | Explicit 5,000-test-credit confirmation, nine cards opened, wallet 300. Seven Ultra Rare and two Legendary real-player **beta** cards. Collection/Profile showed nine cards and one opening. |
| Third purchase 09:23:59 | Wallet 300 → 5,200. Receipt prefix `0bae3456`. |
| AFL Standard 9 Pack 09:26 | 700 test credits, nine cards, wallet 4,500. Initial response timed out after server success; the existing pending-transaction retry recovered the same pack and reveal, without another charge or issuance. Eight Rare and one Elite. |
| Concurrent receipt replay 09:27:48 | Three authenticated posts of the identical token returned the existing PURCHASED result. Wallet, deposits, ledger and all ownership unchanged. |
| Refunds after spending 09:28:26 / 09:28:33 | Both Google requests accepted; genuine void notifications arrived 09:28:27 / 09:28:34. Hosted scheduled worker completed both at 09:30:38. |
| Final reconciliation | Three receipts CANCELLED, three consume jobs done once, all seven recorded purchase/void/scheduled notifications done with no errors. QA wallet retains 4,500 under recovery hold, spendable **0**, withdrawable **0**. No invented debt or card confiscation. QA inventory 52 → 70, exactly 18 new cards. |

The recovery-review cases intentionally remain audited and unresolved. This is existing TEST policy, not approval of a commercial clawback policy. Unspent reversal and spent-funding holds are distinct. Do not describe the remaining held balance as refunded cash or an automatically cleared debt.

All four unrelated wallet fingerprints and the complete unrelated ownership fingerprint match the pre-test baseline. No unrelated customer balance/card mutation, permanent issuance, team entry, prize or withdrawal was performed. See `qa/final-play-acceptance-20261101/hosted-refund-reconciliation.json` and `receipt-replay.json`.

Ordinary-member **9,900-credit** checkout was not observed: its temporarily active Google option did not appear in the app's product query. Earlier operator-ledger 9,900/delayed-approval evidence is not relabelled as this ordinary-member acceptance. Genuine duplicate/out-of-order event delivery beyond the observed sequence is not claimed; those failure cases retain automated coverage. After the owner unlocked the phone, the actual wallet breakdown showed 4,500 total and zero spendable. Screenshot: `qa/final-play-acceptance-20261101/member-refund-hold.png`. The wallet previously omitted a plain-English hold reason; a presentation-only explanation and On hold row were added and rendered in isolated mobile/desktop fixtures. No ledger calculation changed.

## Root cause and Production correction

Correctly admitted QA members could not see checkout because `src/server/member-google-test.ts` selected the admission JSON using reserved SQL alias `grant`. PostgreSQL rejected the query with 42601; the API safely returned unavailable. The production query now uses `as admission` through `src/server/store-admission-query.ts`, and the database test executes that exact query. Commit **c5018bdaba1346e9e2ac7a3396e1cb78c8516b0d**.

The supervised deployment enabled TEST checkout only for a bounded admission and rejected real receipts. After acceptance, both Google options were deactivated. Read-only Publisher API confirmed both INACTIVE at 09:44 UTC. Production was promoted to the **closed-test-window** build at 09:33:55 UTC:

- https://docked.com.au
- `dpl_BbdkpEEK6eT78bgL5JiBiEW7hnMY`
- https://docked-production-q3xjbfzdy-briant-s-projects.vercel.app
- commit `c5018bdaba1346e9e2ac7a3396e1cb78c8516b0d`
- `DOCKED_MEMBER_GOOGLE_TEST=false`; normal paid products, registration, withdrawal and prize gates closed; NBA hidden.

Eight staged and eight Production HTTP checks passed. The unauthenticated TEST route returns 403; member/mobile endpoints require authentication; unsigned notifications and unauthorised worker calls are rejected. Scheduled reconciliation continued on the closed deployment at 09:35 UTC with zero pending/attention jobs.

The wallet hold explanation was subsequently deployed at commit **73634b6c3a24558f9b52014488eeec4476edac28**, deployment `dpl_Hfmytkg94otry2eXzeA6j3C58MSy`, https://docked-production-jpn473yaa-briant-s-projects.vercel.app, promoted to https://docked.com.au. It uses the existing authoritative `heldAvailable` field; it makes no financial or ownership writes. The release retained all closed payment/registration/prize/NBA gates. The saved rollback points to the preceding closed-gate deployment. Its own staged and Production guard results are in `qa/final-play-acceptance-20261101/final-release/`.

The separate owner-approved roster migration was applied after billing acceptance (details below). The release helper's stale historical migration list was corrected: application releases now report no applied migrations and warn against rolling back into a temporary checkout-enabled deployment. The legacy shared NBA infrastructure flag is not customer NBA visibility. Temporary QA wallet/roster/TEST admission flags were restored disabled at 09:55 UTC; all refund receipts, inventory and recovery cases remain preserved.

## Android candidate

Prepared signed **v29 / 1.28**, package `docked.fantasy`, min SDK 24, target SDK 36, normal Production HTTPS origin. The version is newer than internal v28 and excludes the member-test product allowlist and lab launcher/certificate. It does not activate purchases.

- `artifacts/android/Docked-public-candidate.aab` — 9,213,929 bytes.
- SHA-256 `ea1b27589e06300da0886aa30b7485c846c75248d4184fe96138d1ee06773a77`.
- Existing upload certificate verified by the build; AAB signature and APK signature verified.
- APK manifest confirms version 29/1.28; native lint: 0 errors, 34 pre-existing resource/icon/manifest warnings.
- Packaged configuration and known server-secret scan passed; NFL/AFL/NRL only; debugging, mixed content and cleartext off.
- The previous v27 artifacts are archived separately. v28 remains the physically accepted Google Play build; v29 physical acceptance is not claimed.
- Uploaded v29 to the existing internal track and saved **29 (1.28) — payments-disabled candidate** as a draft. Google accepted the bundle with no errors and two non-blocking warnings: no obfuscation mapping and no native debug symbols. No devices were removed relative to v28. No rollout/public submission was made. Candidate notes and screenshots are retained in the evidence folder.

## Reviewer access and migration readiness

The nominated `briantginty21@gmail.com` account has completed normal signup, email confirmation, consent and password login. No owner role/MFA bypass was added. Existing Profile, all three sport screens, products, Market and Social were inspected in its genuine session during the preceding checkpoint.

Full review access remains blocked by free-Core configuration. Production has zero eligibility rows, three disabled programmes, no opted-in future AFL/NRL rounds, and no future NFL competition. The current AFL/NRL verified registry contains **545 players/18 teams** and **337 players/17 teams** respectively. The old Core foreign key references another registry, so enabling it alone would not solve the picker.

Applied owner-approved **20261101090955_free_core_verified_roster_adapter.sql** at 09:55:43 UTC. It is additive and disabled, preserves the NFL path and uses the existing verified AFL/NRL identities without issuing collectibles. Encrypted backup/readback and all 15 protected table fingerprints passed; the adapter remains empty. See `FREE_CORE_ROSTER_ADAPTER_APPROVAL_20261101.md` for exact impact, receipts and rollback. Reviewed eligibility and suitable no-prize saved round configuration are still separate activation steps. Do not rewrite locked NFL Week 7 or confirmed entries to make the reviewer appear ready.

The three previously approved migrations remain applied: `20261031123611`, `20261031123931`, `20261031234304`. No duplicate logical migration was applied.

## Console and policy status

Console still shows three declarations needing attention: **Sign in details, Target audience and content, Data Safety**. The Data Safety questionnaire's categories/purposes are filled and saved as draft; its preview explicitly blocks submission until target audience is completed. App access still needs full reviewer gameplay acceptance and owner-held password entry in Console. The full-access assertion remains unticked. No legal attestation, new agreement, public release or commercial approval was submitted.

The Target audience page was also inspected: Google explicitly blocks that questionnaire until **Sign in details** is complete. Therefore the exact dependency is reviewer access → Sign in details → Target audience → Data Safety, not three unrelated forms. The owner's reviewer tab and Console credential draft remain available for secure password entry when access is complete.

Production country targeting is now saved with **Australia as the sole targeted country**. Google confirmed the change is saved but requires Publishing overview submission for review; that submission was not made. The Production track remains Inactive. Screenshot: `qa/final-play-acceptance-20261101/google-australia-targeted-draft.png`.

Existing privacy/refund/retention/commercial draft publication at `2026-11-01-release-preparation-v1` remains the current test-service description. Commercial card/data rights, paid random-content/platform classification, the beta-to-paid wallet transition, refund-after-spend resolution, retention and staffed moderation decisions remain external approvals. The TEST-only financial sandbox cannot become a production-money ledger by flipping a feature flag.

Public-mode deletion retains successful disposable PostgreSQL/mock-Auth evidence, not genuine hosted Auth erasure acceptance. The earlier isolated Auth project `bckkllmndoxzpzdqrevb` is unavailable: management access denied, its Auth hostname does not resolve, and the connected project inventory lists only Production. No Production customer deletion or new paid service was used as a substitute. A no-charge isolated hosted Auth environment is needed to close this acceptance item.

## Tests actually executed in this continuation

- Full platform: **693 passed, 0 failed/skipped**.
- Full database/migration: **228 passed, 0 failed/skipped**.
- Free-Core adapter: four targeted tests passed; separate native PostgreSQL AFL and NRL runs passed. Initial combined native run failed due to retained cluster roles; the corrected fresh-cluster NRL run passed. This failure is retained in evidence.
- Exact admission-query and store-access tests passed; typecheck and targeted lint passed.
- Signed Android bundle/APK build, native lint, package/backend/version inspection and credential scans passed.
- Hosted HTTP guards, ordinary QA checkout/receipt binding, two pack openings, concurrent receipt retries, Google refunds and genuine scheduled RTDN processing passed as described above.
- NFL/AFL/NRL and NBA rarity/scoring regressions passed within the platform/database suites. This is not a new physical journey through every screen/sport.
- Subsequent hold-display check: real shared component rendered with isolated held and normal wallet states, 360px and 1440px, no horizontal overflow. Nine related wallet/member-binding/settlement regression tests passed; typecheck and targeted lint passed after the change. The held message was not re-tested against the now-disabled QA account; the earlier physical screenshot verifies the financial state, not the newly deployed wording.
- Broad repository secret heuristic reported eight existing fixture/local database-URL files. It was **not** an overall pass. No changed production source, new migration or acceptance receipt was among its findings. The Android packaged credential check passed separately. No matched credential values were printed.
- Post-migration Supabase security review retained the existing leaked-password-protection warning; direct adapter table/function access remains denied. This warning is not hidden by the migration's passing grants checks.

## Exact remaining owner/external actions

1. Complete and authorise reviewed free-Core eligibility and no-prize reviewer rounds without changing historical results. The additive adapter is already approved/applied. Full reviewer gameplay still needs actual hosted acceptance.
2. Once access is complete, enter the existing reviewer password directly in Console; complete truthful full-access and target-audience declarations, then final Data Safety. Do not send credentials in chat.
3. Restore/provide an authorised no-charge isolated hosted Auth environment for public-mode account-deletion acceptance.
4. Resolve the commercial/policy/rights decisions and implement the approved real-money wallet separation before any paid activation. Repeat the exact ordinary-member 9,900-credit test if that product is part of the launch scope.
5. Final owner approval for Australian public submission/rollout, public registration and payment activation remains separate. Withdrawals and prizes remain disabled.

**Go/no-go:** ordinary 4,900-credit TEST purchase/pack/refund pipeline — GO for the observed supervised test scope. Public paid release — NO-GO. Public submission — NO-GO until full reviewer access, remaining declarations, deletion acceptance and required approvals are complete.
