# Credit V2 — beta certification

Released 14 October 2026 Australia/Sydney after the owner's explicit approval for
isolated hosted QA and this beta update. Hosted candidate and domain acceptance PASS.
No access expansion authorised. Physical S24 and owner visual acceptance remain pending.

Live code: `15a8bbd3adad44213f76e9520b5b0006714a976f` (same application code as approved
`d1a8a0f4`; latest commit adds official-source references only). Deployment:
`dpl_EtPaDiF7DPLTXwify5Sou2ebMb3J`. Wallet: https://docked.com.au/fantasy/test-wallet;
Market: https://docked.com.au/fantasy/market. No schema migration or native change.

Pre-release baseline: branch pivot/fantasy-cards-preview-v1, HEAD f617ac70, live code
dafb3949, deployment dpl_6q2Xx9WQpbwZ4wGTXDQXdoc8qNcr. Current site:
https://docked.com.au/fantasy/test-wallet. Vercel project prj_l0rpVDPRuIRp9UcBUkudeyUK5yST;
Supabase pojoymtniryarxxunyvz. Preview hosting remains protected; custom domain uses
application admission. Owner MFA retained, ordinary members AAL1. No public signup.

Read-only before-state: docs/qa/credit-v2/before.json. Both protected accounts verified;
revision44, no deposits/withdrawals, no free windows, financial fee50 each, live=false.
No owner/Barry actions or prior grants repeated.

## Narrow changes

- Completed transfers close superseded sale listings atomically. Existing version
  checks already rejected stale buys; the fix prevents misleading open offers.
- Reject orphan member-lot postings during ledger validation.
- Extend existing owner export with Sydney range, sources, transaction classification,
  gross movement, proceeds/commission and opening/closing liability. No new wallet.
- Correct wallet Market-tab selection, nested main landmark and low-contrast beta
  label. Preserve existing branding and layout. No native-shell change.

## Evidence

| Check | Actual evidence |
|---|---|
| Full platform | 326/326 pass; Windows TEMP permission needed, rerun outside sandbox succeeded. |
| Database/RLS regression | 151/151 pass. |
| Final credit regressions | 29/29 pass, including settlement source export. |
| Real disposable PostgreSQL | 6 grouped checks pass: duplicate capture, shared-wallet contention, withdrawal reservation/failure, immutable postings, same-card contention, forced rollback. |
| Local customer browser | Actual Docked shell/component and engine, visible pack buy/open/reveal, resale button, listing and interrupted retry. Android Chrome emulation and 360/412/1440 widths; axe zero violations, no overflow/console errors. |
| Hosted read-only ledger | Revision44→48: only synthetic QA request receipts/audit events changed. Holdings, balances, grants, supply and ledger unchanged; access fingerprint restored; SQL journals/postings exactly match aggregate; ordinary database role denied. See release-integrity.json and after.json. |
| Live anonymous boundary | 15/15 domain, redirect, callback, privacy, private-data and closed-registration checks pass against released 15a8bbd3. |
| TypeScript/lint/production build | Pass after fixes. |
| Credential scan | Final release scan: 559 files, zero findings/errors; no new APK. |
| Hosted authenticated candidate and domain | PASS on both: ordinary AAL1 login, private API/owner CSV denial, prohibited financial/admin actions rejected, same nine-card receipt on retries, reload/new-page restoration, logout denial, mobile/desktop, zero axe violations/overflow/console errors. Existing pack replay only, no new grant. |
| Hosted rollback-only transactions | PASS: two synthetic nine-card allocations, idempotency, server-time free-window swap and permissions. Entire transaction rolled back; unchanged fingerprint. |
| Physical S24 / owner visual | Pending owner. |

Local browser authentication is synthetic and NOT hosted authentication. No actual
PayPal, payout, bank settlement, email delivery or Android device acceptance claimed.

Real provider acceptance, physical S24 and owner visual review pending. No new APK
required: v22 receives the promoted web changes from docked.com.au. Close/reopen the
app without uninstalling or clearing data. No physical Android/emulator test was run
in this release; browser mobile emulation is separate evidence.

## Release boundary

Keep existing ten-person AU18+ invitation boundary. Additional testers require owner
access approval; no invitations sent. Deposits, cash-outs, commercial issuance and
prizes remain disabled. No subscription/service purchase. Additional cost A$0.

The Phase 10 approval was granted before hosted QA and promotion. It covered this
specific beta update and isolated synthetic QA, not commercial policy or invitations.

Related: [financial evidence](CREDIT_V2_FINANCIAL_RECONCILIATION.md),
[commercial decisions](CREDIT_V2_COMMERCIAL_POLICY_DECISIONS.md),
[official-source review and drafted enquiries](CREDIT_V2_APP_STORE_AND_PROVIDER_REVIEW.md),
[S24 checklist](CREDIT_V2_S24_ACCEPTANCE.md).

## Executed release sequence

1. Owner approved only hosted synthetic QA and this tested code release. No human
   wallet/team actions, no expansion, no external payments or invitations.
2. Staged reviewed commit using existing `deploy-beta-staging.mjs --prepare --friends`
   and `--deploy --friends` (production target, skip-domain); verified READY identity.
3. Obtained protected candidate access using existing Vercel mechanism. Ran
   `credit-v2-hosted.mjs --approved-qa` and
   `credit-v2-hosted-rollback.ts --approved-qa`. Browser reuses existing synthetic
   pack request; no new grant. Temporary synthetic admission is audited/restored.
   Rollback-only QA allocations/zero-balance swap must leave no persistent records.
4. After candidate PASS, `promote-credit-v2.mjs <exact reviewed SHA>` saved alias
   rollback and promoted. Domain boundaries and hosted browser `--domain` passed;
   protected-account and retained-history checks passed. If a later defect requires
   rollback, restore code only, never wallet history.
5. Still pending: owner completes S24/visual checklist; explicitly approve any additional tester
   access within the existing cap. Do not send invitations without recipient authority.

**Existing admitted beta release: PASS for automated acceptance.** Wider-beta
expansion, physical S24 and owner visual acceptance remain unapproved/unobserved.

Implementation commit: ed4e670c; released source 15a8bbd3. Synthetic admission flags
were audited and restored. Four existing-pack replay requests created only QA receipts
and events. No owner/Barry action, new grant, real payment or message occurred.

## Rollback

`docs/qa/credit-v2/rollback.json` saves both prior domain aliases. If required, use
the existing Vercel project's rollback/promotion operation to restore deployment
`dpl_6q2Xx9WQpbwZ4wGTXDQXdoc8qNcr` (code dafb3949), then rerun domain/member checks
against that identity. Do not restore old wallet/database state. DNS and email records
were not changed. Additional services/cost: none (A$0).
