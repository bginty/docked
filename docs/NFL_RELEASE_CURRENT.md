## Latest authoritative update — 12 October 2026

**Current: friends v22**, [rarity member-round release](NFL_RARITY_MEMBER_RELEASE.md), website `dee17493`, release evidence `dffcb2e6`. The domain, callback, ordinary-member and APK acceptance are complete; do not repeat cutover or return to v20. Follow-up at 12:46Z verified the latest scheduled weekly and roster downloads with matching HTTP 200, revisions 6/7 and retained hashes. Latest PBP job returned cooldown, arriving 536ms before its lease expired; its earlier scheduled download at 00:10Z produced retained revision 4. That earlier HTTP receipt is no longer present in the queried response store, so full three-source acceptance remains REVIEW_REQUIRED. All retained sources were under 24 hours old. Exact evidence: `qa/friends-cutover/collector-followup-current.json`. Next existing PBP attempt: 13 October 11:10am Sydney. No forced download or schedule change. Genuine Week 6 results remain pending. Automatic approval review blocked deletion of the completed one-shot Codex follow-up; it remains unchanged pending the specific cleanup question. Database collector jobs remain active. No release action or additional cutover is required.

### Superseded earlier follow-up summary

Friends **v20** remains live at https://docked.com.au/app/login; see [v20 release](DOCKED_V20_REVEAL_RELEASE.md). The older v17 preparation/cutover statements below are historical. The single collector follow-up found all three 11 October source jobs failed with HTTP 503. A reproduced Deno Buffer dependency defect was fixed and collector version 12 deployed; scheduled reconciliation then passed as **idle**, which is not source-download acceptance. Source collection and genuine member-round observation remain pending. No DNS, mail, account or APK rollback occurred. See [actual evidence, repair, retry times and delivery](NFL_COLLECTOR_FOLLOWUP_2026-10-12.md).

Invitation update — 11 October 2026: the owner-authorised first friend invitation was submitted once by Docked support (Graph HTTP 202). Inbox delivery and recipient acceptance are unverified. Eligibility only: no account, password, consent or cards created. The restricted transactional-recipient list includes this authorised recipient. Earlier “no invitation sent” or “send approval pending” statements are superseded.

# Consolidated NFL friends release — 11 October 2026

**Current release:** [Friends v17](FRIENDS_V17_RELEASE.md) is live at https://docked.com.au/app. Domain/callback/member checks and connected APK passed. Scoring collection and genuine round observation remain pending under the authorised staged release. Earlier holding-page/disabled-mail/owner-only APK blockers below are superseded.

**Latest steering:** [customer-style staged friend release](CUSTOMER_FRIENDS_RELEASE.md) supersedes the collector-before-gameplay gate below. The existing 23:20 follow-up is unchanged; fresh collection remains pending but does not block independently verified login/cards/teams/free swaps. Fresh hosted self-signup and connected APK evidence are still required.

This is the current status authority. It supersedes generic mailbox/sign-in and paid-service blockers in older release reports. Branch: `pivot/fantasy-cards-preview-v1`; starting checkpoint `12e10d3e`. Existing deployment approval remains valid. No new release-scope, support/operator, retention-intent or player-eligibility approval is requested.

Implementation checkpoint: `70f9c3b4` (policy packet, release identity and tested atomic consent transition). No new hosted application deployment is claimed by this report.

## Domain and APK preparation update — 11 October, afternoon

The existing 23:20 Sydney automation `verify-docked-nfl-collection` was **updated, not duplicated**, to execute [the concrete cutover runbook](FRIENDS_CUTOVER_EXECUTION.md) after a genuine collection pass, rather than merely report it. Its time and single-run schedule are unchanged. It must continue the authorised deployment/domain/Auth acceptance and accepted-host Android build, or name the exact failed step.

Fresh read-only checks at approximately 15:38 Sydney confirm HTTPS holding page, original web/mail DNS, four exact domain callbacks, closed signup, signed email hook, zero tester slots used and closed friends/swap gates. DNS/Auth rollback hashes are unchanged. A private candidate config changes **Auth site_url only**; it was prepared, not applied. Vercel's recommended apex/CNAME values were rechecked and agree with the saved plan. No sign-in or mailbox checks were reopened.

Collector observation at 15:37 Sydney confirms scheduled reconciliation at 15:30 was `idle`; all source caches remain within their intentional 12-hour cooldowns. The repaired observer retains executions per job and correlates scheduled source receipts with HTTP outcomes and retained revisions. Tonight's required proof and failure consequences are explicit in the runbook. An absent completed member round does not block this beta; a temporary feed outage leaves scores pending but does not satisfy the first unattended collection acceptance.

Additional operational detail: mail dispatch is still disabled, pending queue is empty, the existing Vault signing entry is present, and no mail cron job exists. This is separate from the resolved mailbox/privacy evidence. Recipient-restricted dispatch and domain recovery must be configured/verified during cutover before calling invited-account recovery operational; no invitations or resets were sent in preparation.

The next Android version is reserved as **v17 / 1.16-beta** and its output name is now derived from Gradle. The actual v16 package/signature baseline and installed SDK/JDK were checked; no Android device is attached. No new APK, deployment, browser login, emulator or physical S24 acceptance is claimed by preparation. Domain acceptance now has a dedicated non-sending boundary-check runner; positive authentication remains a separate check, not inferred from anonymous denials.

Preparation implementation: `a343dcf6`. Typecheck and lint pass. All 265 platform cases are resolved passing: the sandbox run passed 257 and blocked eight on Windows TEMP/Git permissions; the two affected files then passed all ten tests with authorised filesystem access. No assertions or security controls were weakened. The targeted release/auth/Android suite also passed 22/22. Changed/deployable-surface credential scan: 310 files, zero findings/errors. The broader operator-script scan's four pattern hits were reviewed as existing runtime URL/parser patterns, not embedded credentials; its original result is retained. Actual evidence: `qa/friends-cutover/preparation-validation.json`. No fresh web/Android build or hosted positive-login pass is inferred from these checks.

## Completed in this reconciliation

- Preserved Exchange evidence from `12e10d3e`: Default MRM assigned, litigation hold Off, archive Disabled, no forwarding, approved synthetic-message EML export passed, Deleted Items recovery controls available. No checks repeated, mailbox contents reopened, settings changed or messages sent.
- Prepared the exact seven-document [2026-10-11-beta-rc3 packet](policies/2026-10-11-beta-rc3/privacy.md), bundled in `config/friends-policy-content.json`. Digest: `5df788e2d827b973160b9965d5f566e77f4ef07285cffd8e0ff75c2348b5a9c9`. Historical policy/consent bytes remain unchanged. The deployed owner QA still uses its historical packet until the reviewed friends release is activated.
- Fixed the friends release identity endpoint to use the isolated beta target and actual deployment ID, rather than the unrelated commercial-host manifest. Guard tests reject wrong targets, roles, flags, packet versions and incomplete evidence.
- Found and fixed a real policy transition defect: updating admission consent alone left gameplay using the old version and denied valid new members. The operator-only transactional helper now updates both stores, audits prior/result/actor/reason/digest once, and refuses open admission. No owner consent or actual hosted settings were changed by testing.
- Hosted rollback-only two-user acceptance passed with the new packet: AAL1 ordinary member admission, ten real NFL starter cards each, own collection, zero-fee swaps/cancellation/idempotency/stale-offer rejection, saved/locked lineups, actual historical player breakdowns and 71.24 team totals each, shared rankings and appended synthetic +0.04 correction. All QA users/cards/entries and policy changes rolled back. Expanded fingerprints also verify profiles, consent events and policy audit/settings remain unchanged.

## Privacy classification and final wording

The exact final prepared notice is [Privacy Policy](policies/2026-10-11-beta-rc3/privacy.md). It implements already-approved active-record targets and operator handling; it does not claim automated Microsoft expiry controls exist. No new material owner decision is identified.

The provider qualification reads:

> We have not verified this mailbox's data-at-rest geography or every provider recovery, security-quarantine, backup or hold setting. We do not promise Australian-only processing or a fixed date when every provider-held copy is erased. We will update this notice when material location or preservation information is confirmed.

> Recovery, quarantine, backup and applicable holds may preserve copies after active deletion. We investigate relevant restrictions for each request, explain known limitations, restrict unnecessary continued use and reapply completed deletion requests before restored data returns to active use. We do not promise immediate or guaranteed complete provider erasure within the active-record targets above.

The complete notice keeps immediate access revocation; eligible active account/posts/media removal within a 30-day target; active support cases 12 months after closure; operational logs maximum target 30 days/security 90 days; documented exceptions reviewed at least every 90 days; account-to-game links removed within 30 days after relevant competitions/disputes close, followed by beta-end review and deletion/further de-identification within 12 months. Linkable records are not called anonymous.

Mailbox geography, effective MRM tags/recovery periods, non-litigation holds and security/backup preservation remain **provider follow-up**, not automatic free-beta blockers. A material contradictory hold/obligation would require a specific revised commitment; none was established by the checks. The concrete [GoDaddy enquiry](GODADDY_MAILBOX_EVIDENCE.md) remains unsent. Do not buy Purview or request another Exchange sign-in.

## Current deployed state and actual remaining gates

| Area | Current evidence / required action |
|---|---|
| Public site | https://docked.com.au still serves the HTTPS holding page; www redirects to apex. No friends release or DNS change is claimed. |
| Existing owner QA | Protected `https://docked-production-ma0j6h6we-briant-s-projects.vercel.app`, deployment `dpl_2hC7cKyP7cAChXqLfxovhPzQkhhK`, source `5ffa6eaa`. Accepted owner authentication preserved. |
| Registrar access | **RESOLVED.** Sign-in and DNS table both verified. Owner reported the page recovered; agent inspected all 26 records and saved a hashed private rollback snapshot, including four apex A records (600-second TTL), www CNAME (one-hour TTL) and untouched mail/service records. Earlier zone-load failure is historical, not a current blocker. No DNS edit submitted. |
| Domain target | Exact existing Docked Vercel project/team verified. No custom domain attached yet; current project-specific DNS recommendations retrieved. Preserve all mail records. No new service needed. |
| Admission | Current hosted friends/tester/swap execution gates closed; zero tester slots used. Ten-person AU18+, ordinary AAL1 and owner/admin MFA controls remain enforced. Recipient list is not needed for preparation. |
| Callback/recovery | Domain callback paths allowlisted. Site URL/mail pin still point to older QA and must be switched together at cutover. Positive admitted-member browser and domain recovery acceptance remain outstanding; SQL acceptance is not a substitute. No resets or recovery emails were sent. |
| Unattended collector | Latest read-only preflight observes scheduled reconciliation at 03:15:01 UTC, `idle`. That proves scheduled reconciliation, not a source download. Existing source retrievals are due 23:05/23:10/23:15 Sydney tonight; preserve the existing 23:20 follow-up. No cooldown bypass or duplicate automation. |
| Genuine member round | Week 6 is prepared with 14 fixtures and Friday 16 October 2026 11:15 am Sydney lock. No completed genuine member round observed. That future observation alone does not prevent a labelled post-game beta; missing/conflicting scores remain pending. Historical QA never becomes competitive results. |
| Android | v16 remains protected owner QA. A friends APK is not yet built/distributable: it requires actual accepted domain identity. Use the existing package/signing identity, increment beyond 16 and verify the live domain before publishing it. |
| Human acceptance | Owner visual approval and physical S24 remain pending. No emulator/device pass is claimed. |

## Executed verification

- Full platform tests: **261 passed, zero failed/skipped**.
- Typecheck and lint: **PASS**, including the final transition helper.
- Fresh credential-free production compilation: **PASS** (384 exported files).
- Hosted rollback-only two-user new-policy/gameplay test: **PASS**, with extended post-rollback fingerprints.
- Known-credential scan: **432 files, zero findings/errors**, including fresh browser build and release reports.
- Read-only external preflight: **PASS as inspection**, not as a launch certificate. Public registration remains false; email confirmation and signed hook enabled. Domain holding status and closed admission confirmed.
- Full browser/domain invitation/recovery and new Android acceptance: **NOT EXECUTED / pending cutover**. Earlier owner MFA acceptance is preserved, not claimed rerun.

Receipts: `qa/friends-cutover/reconciled-validation.json`, `hosted-two-user-policy.json`, `web-build.json`, `reconciled-secret-audit.json`, `preflight.json` in that same directory.

## Release, rollback and remaining owner actions

Continue the existing [cutover runbook](NFL_FREE_BETA_CUTOVER.md) after actual due source-job evidence and domain access. Do not mark the readiness manifest passed to bypass those checks. Stage the exact committed build, perform the atomic policy transition, bind domain/Auth/mail settings, verify admitted-member browser and public denials, then issue the domain-connected APK. Keep commercial features disabled.

Existing DNS/Auth preimages remain in ignored `private-data/friends-cutover/`; retain the working holding page. If cutover fails, close admission/mutations and restore a compatible deployment/holding route without resetting accounts/cards/journals or reverting additive data history. Source/report repairs are committed separately from any future activation.

Only current owner actions:

1. Domain-owner sign-in and DNS table access are **complete**. No immediate owner action or new approval is required. Leave the signed-in records tab available for the authorised cutover after technical checks. No GoDaddy support enquiry is needed for the resolved loading issue.
2. When ready to invite, provide each recipient email and explicit authorisation (up to ten Australian adults). No invitations sent yet.
3. Once the actual friends APK is supplied, install via **Update**, then check login/session reopen, five tabs, NFL team save/free swap, post-game/pending labels, keyboard/Back/safe areas and offline recovery. Visual/S24 approval remains yours.

No new policy/scope approval, subscription or cost is requested. Additional purchases: **$0**. Existing capacity and its ordinary usage charges remain. Payments, paid packs, cash trading, prizes, KYC collection and withdrawals stay disabled; EPL remains unavailable.
