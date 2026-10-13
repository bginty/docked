# Credit V2 — beta certification

Local certification complete, 13 October 2026; hosted candidate acceptance and
promotion await the approval required in Phase 10. No access expansion authorised.

Verified baseline: branch pivot/fantasy-cards-preview-v1, HEAD f617ac70, live code
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
| Hosted read-only ledger | Revision44 before/after aggregate, ledger and access fingerprints identical; SQL journals/postings exactly match aggregate; ordinary database role denied. |
| Live anonymous boundary | 15/15 domain, redirect, callback, privacy, private-data and closed-registration checks pass against dafb3949. |
| TypeScript/lint/production build | Pass after fixes. |
| Credential scan | 549 files, zero findings/errors; no new APK. |
| Hosted authenticated candidate | Prepared, not executed in this milestone until hosted-QA approval. Prior release evidence is not recertification of new code. |
| Physical S24 / owner visual | Pending owner. |

Local browser authentication is synthetic and NOT hosted authentication. No actual
PayPal, payout, bank settlement, email delivery or Android device acceptance claimed.

Real provider acceptance, physical S24 and owner visual review pending. No new APK
required: v22 receives promoted web changes. Live site remains the verified baseline
until this code passes protected candidate checks and required hosted-write approval.

## Release boundary

Keep existing ten-person AU18+ invitation boundary. Additional testers require owner
access approval; no invitations sent. Deposits, cash-outs, commercial issuance and
prizes remain disabled. No subscription/service purchase. Additional cost A$0.

The latest brief explicitly requires owner approval for hosted writes/financial
balance changes. Complete local/read-only checks first; request approval for the
specific tested candidate plus narrowly isolated hosted QA, not for commercial policy.

Related: [financial evidence](CREDIT_V2_FINANCIAL_RECONCILIATION.md),
[commercial decisions](CREDIT_V2_COMMERCIAL_POLICY_DECISIONS.md),
[official-source review and drafted enquiries](CREDIT_V2_APP_STORE_AND_PROVIDER_REVIEW.md),
[S24 checklist](CREDIT_V2_S24_ACCEPTANCE.md).

## Prepared release sequence

1. Owner approves only hosted synthetic QA and this tested code release. No human
   wallet/team actions, no expansion, no external payments or invitations.
2. Stage reviewed commit using existing `deploy-beta-staging.mjs --prepare --friends`
   and `--deploy --friends` (production target, skip-domain); inspect READY identity.
3. Obtain protected candidate access using existing Vercel mechanism. Run
   `credit-v2-hosted.mjs --approved-qa` and
   `credit-v2-hosted-rollback.ts --approved-qa`. Browser reuses existing synthetic
   pack request; no new grant. Temporary synthetic admission is audited/restored.
   Rollback-only QA allocations/zero-balance swap must leave no persistent records.
4. Only after candidate PASS, `promote-credit-v2.mjs <exact reviewed SHA>` saves alias
   rollback and promotes. Run domain boundaries and hosted browser `--domain`;
   verify protected account fingerprints. If any required check fails, retain the
   current working deployment or roll back code, never wallet history.
5. Owner completes S24/visual checklist; explicitly approve any additional tester
   access within the existing cap. Do not send invitations without recipient authority.

**Wider-beta certification is conditional, not PASS:** local integrity and current
live boundaries pass; new hosted candidate and owner access-expansion approval remain.

Implementation commit: ed4e670c. No persistent hosted writes in this certification pass.
