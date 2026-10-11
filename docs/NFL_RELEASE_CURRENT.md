# Consolidated NFL friends release — 11 October 2026

This is the current status authority. It supersedes generic mailbox/sign-in and paid-service blockers in older release reports. Branch: `pivot/fantasy-cards-preview-v1`; starting checkpoint `12e10d3e`. Existing deployment approval remains valid. No new release-scope, support/operator, retention-intent or player-eligibility approval is requested.

Implementation checkpoint: `70f9c3b4` (policy packet, release identity and tested atomic consent transition). No new hosted application deployment is claimed by this report.

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
| Registrar access | **Sign-in completed and verified**, 11 October approximately 14:42 Sydney. The signed-in Docked domain portfolio was reached. Its DNS Records panel reports “We're having trouble loading your zone file”; reload/fresh-tab recovery failed with an empty response. This is a DNS-page availability problem, not a missing sign-in. No DNS edit was submitted. Preserve the authenticated session and retry the known records page when available. |
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

1. Domain-owner sign-in is **complete**. No repeat sign-in or new approval is requested. Leave the signed-in domain tab available; the agent still needs the DNS record table to load before safely editing. If the same zone-file failure persists in the owner's normal browser, the precise provider issue is: “My signed-in docked.com.au DNS Records panel cannot load the zone file; please restore access without changing any DNS or email records.” No support enquiry has been sent.
2. When ready to invite, provide each recipient email and explicit authorisation (up to ten Australian adults). No invitations sent yet.
3. Once the actual friends APK is supplied, install via **Update**, then check login/session reopen, five tabs, NFL team save/free swap, post-game/pending labels, keyboard/Back/safe areas and offline recovery. Visual/S24 approval remains yours.

No new policy/scope approval, subscription or cost is requested. Additional purchases: **$0**. Existing capacity and its ordinary usage charges remain. Payments, paid packs, cash trading, prizes, KYC collection and withdrawals stay disabled; EPL remains unavailable.
