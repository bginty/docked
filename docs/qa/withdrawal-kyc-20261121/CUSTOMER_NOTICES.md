# Marketplace and withdrawal notices

Status: **prepared, unpublished candidate**. The original `config/launch-policy-content.json` is unchanged. `config/cash-policy-content.json` contains the separate candidate Terms, Privacy, Purchases/refunds and Retention notices. Preparing this file does not publish or activate the release.

## Publication and consent

`cashWithdrawalPolicyPublished(env)` in `src/core/commercial-cash-presentation.ts` returns true only when all of these are present:

- `DOCKED_COMMERCIAL_CASH_POLICY=true`.
- `TERMS_VERSION=2026-11-21-terms-market-withdrawals-v1`.
- `PRIVACY_POLICY_VERSION=2026-11-21-privacy-market-withdrawals-v1`.
- `DOCKED_BETA_STAGING` is not `true`.

The boolean is safe to expose through the existing environment presentation context. It means the new notices were selected; it is not proof that provider verification, bank ownership, funding or payments are ready. The root withdrawal service also requires this selection before admitting new KYC, destination or withdrawal requests. It must independently enforce the current ledger and operational gates.

The publication setting is deliberately independent of Marketplace, request and payment kill switches. Once customers have accepted cash-capable documents, stopping new requests must not hide those terms or replace them with a claim that no withdrawal obligations exist. Leave the published policy selection and versions in place during an emergency stop. Do not modify earlier recorded consents. Require the new versions through the existing consent flow before transactions requiring them.

When publication is off or the versions do not match, policy pages and customer copy retain the current launch behavior. The candidate source remains available for review in the repository but is not selected for public pages.

## Customer meaning

The candidate notices and conditional app/site wording distinguish purchased credits from eligible settled card-sale proceeds. They explain provider identity checks, a separately verified Australian bank destination, funding/refund holds, reservations and payment reconciliation. A sale or displayed credit balance does not guarantee that an amount is available to withdraw. TEST and beta balances cannot become cash balances.

No withdrawal rate, minimum, maximum, daily limit or fee is invented in static copy. The withdrawal page must show the exact public fields from the configured policy: `version`, `currency`, `eligibleSource`, `rate`, `minimumCredits`, `maximumCredits`, `dailyMaximumCredits` and `feeCents`. It must show the calculated gross, fee and net before confirmation, bind the request to the reviewed version, and deny stale reviews. Provider-account references, approval records, keys, raw identity data and full bank details must not be included in that public policy projection.

The fixed-price card seller fee remains the implemented **5%, whole-credit half-up rounding, capped at 2,000 credits, with no minimum**. It is distinct from any configured withdrawal fee. Do not silently substitute a competitor's schedule.

Cancellation or rejection before payment releases the applicable reservation. A payment in progress or with an unknown outcome needs reconciliation before another payment or credit release. Confirmed unpaid or returned payments restore the corresponding credits and withdrawal fee through the recorded ledger outcome. Existing Google purchase refunds retain their original-payment-method process and applicable remedies. The notices promise no fixed payout time, provider licence, investment return or automatic bank charge.

Withdrawal requests are presented on the authenticated website. This placement is not treated as an exemption from Google Play requirements, financial obligations or accurate disclosure of functionality available through the app.

## Required publication checks

Review these against the actual enabled release before selecting the new versions:

1. Confirm the Terms, Privacy, refund and retention descriptions match the implemented controls, actual identity provider/account, destination-review process, actual bank arrangement and chosen schedule. The current candidate is not evidence that provider onboarding, payment capability or legal classification has been completed.
2. Inspect the configured Sumsub flow and provider notices. Verify what documents, selfie/liveness data and residence evidence are collected, which parties process them, the selected data region and applicable retention/deletion arrangements. Verify a real Sandbox integration before a production customer is sent to the provider. No real document uploads were used in the code tests.
3. Assess the Play listing, Payments scope, Data Safety answers, content-rating answers and any financial-feature declarations against the complete current app and linked website experience. The assessment must cover customer resale, respendable sale credits, cash withdrawals, identity images/selfie data, bank details and actual recipients. Update and submit the answers or listing that actually change; do not mark private financial/identity records as public Marketplace data or claim provider processing is exempt without checking the applicable criteria.
4. Record the actual owner decision and the basis of the platform/legal assessment. Advice to match another service is an owner decision basis, not a written Google acceptance. This release document does not require a blanket Google support letter as a technical prerequisite and must not fabricate one. Any applicable submission, review or access requirement still needs to be satisfied.
5. Verify export and deletion behavior against the lifecycle implementation. Access revocation is separate from completion; outstanding payout/recovery, provider-cleanup and sensitive-data review tasks remain pending. A queued cleanup intent is not proof of provider erasure. Preserve necessary completed financial and custody records and provide only the member's appropriately masked export.
6. Verify the candidate pages under the new exact consent versions, existing-member re-consent and default-off behavior. Then separately verify the hosted two-member sale, provider integration, backing/reserve reconciliation and payout/reversal acceptance before activating their controls.

## Verification scope

The focused presentation tests check the exact publication/consent gate, preservation of cash obligations after a stop, consistency of candidate version identifiers, selection of the correct rendered policy packet and unchanged default home behavior. They do not establish external approval or live payment readiness.

The React review covered server/client boundaries, minimal boolean serialization, unconditional hooks, existing semantic headings/links and retained beta copy. These changes add no provider SDK, client secrets, extra network request or effect-driven copy state.
