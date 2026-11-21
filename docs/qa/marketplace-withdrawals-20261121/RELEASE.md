# Marketplace with cash withdrawals — release candidate

**Status: implemented and locally verified; not deployed or activated.**

**Publication status:** automatic approval review rejected the attempted GitHub tree upload because `bginty/docked` is public and explicit approval to publish this unpublished source/migration/operational package was not established. No remote branch or pull request was created. The complete local commit and patch are the reviewable deliverable. Explicit approval for public repository publication is required before retrying that upload; the rejection must not be bypassed through another transport.

The Owner asked to proceed with the Marketplace and then clarified, “we need withdrawals.” This release implements cash withdrawal of eligible settled card-sale proceeds. It supersedes the cash-free scope of the earlier fixed-price Marketplace candidate. That earlier candidate's reports remain historical evidence, not a description of this cash release.

The Owner has authorised the work toward activation. A written Google support response is not imposed as a new blanket technical gate. The policy records must describe the real assessment basis: reported advice and an Owner decision, or an actual written determination if one exists. No external approval, provider account, payout-bank arrangement, numeric withdrawal schedule or retention approval has been invented.

## Preserved live baseline

- Repository: `bginty/docked`.
- Live application source observed: `83794e9ac31c54960bfc76b9a07b36047f20486b`.
- Live deployment observed: `dpl_2k3nw6ZuhxCT5SyAdBwbCiiq4JyU`.
- Candidate branch base: `58841a60b4e4c57d9c410c4f1c2e315ee8bf20d2`, which adds three Owner-routing QA evidence files to the same application source.
- Candidate local branch: `codex/marketplace-withdrawals-20261121` (not yet published remotely).
- The Owner login/MFA/Android resume routing fix is already live and is preserved.
- Production was inspected read-only. No production SQL write, migration, flag change, customer sale, payout, provider onboarding or deployment was performed for this candidate.
- Production configuration metadata contained no Sumsub, Veriff, withdrawal, redemption, KYC or identity-provider variables. Values were not decrypted; the provider reported zero hidden production variable entries.

## Customer flow

Customers can trade existing issued cards at fixed prices in the app and website when the Marketplace controls admit it. The seller commission remains 5%, rounded half up to whole credits, capped at 2,000 credits, with no minimum. This candidate does not change card issuance, serials, permanent supply, the pack catalogue or top-up products.

`/profile/withdrawals` shows spendable, cash-eligible and reserved credits, the actual configured conversion/limits/fee, verification status, masked bank destinations and withdrawal history. Native customers see the website handoff. Web customers can complete hosted identity verification, submit their Australian bank details for separate ownership review, request a withdrawal and cancel an eligible request before payment begins.

Only eligible settled sale proceeds are supported. Unused purchased credits are handled through the applicable original-payment-method refund process; they do not become voluntary cash withdrawals. TEST, beta and promotional credit provenance cannot become real withdrawal funding. The paid-pack purchase exchange rate is not silently treated as an approved cash redemption rate.

The withdrawal schedule must explicitly supply its rate, minimum, maximum per request, rolling 24-hour maximum, fee and identity-check age. A request freezes its policy version, amount, fee, identity revision and verified bank destination. Confirmed unpaid and returned payments restore the corresponding credits and withdrawal-fee allocation through new source-linked compensation lots.

## Owner flow

`/admin/withdrawals`, linked from Commercial operations, provides:

- A queue prioritising unresolved obligations, with exact reference retrieval for older requests.
- Separate bank ownership verification with an evidence reference.
- Review, approval, rejection, payment claim and exception handling.
- An audited temporary bank-details display. Payment details require the current claimant and a recent authenticated Owner session with MFA.
- Recording of an EFT that a human has actually sent, with a unique bank reference and explicit confirmation.
- Reconciliation, confirmed-unpaid release, actual bank return and source-loss review.
- Actual bank cash-backing records and an immediate stop for new requests and new payment claims.

**The software does not send a bank transfer.** An uncertain payment keeps its credits reserved. Stopping new activity leaves existing payment resolution available. Do not make another bank transfer solely because a browser response was lost; recover the original operation and check the bank evidence.

Source refunds, recovery changes and funding revocations are checked again before a payment claim. Exposure remains visible after payout. A previously recorded remedy applies to its observed loss version; a later larger loss reopens the hold.

## Migrations

All three migrations are additive and leave activation controls OFF. Apply the release as a complete migration set after the usual backup, drift and isolated acceptance checks:

1. `20261121074228_commercial_manual_withdrawals.sql`
2. `20261121074659_commercial_withdrawal_account_lifecycle.sql`
3. `20261121075714_commercial_cash_policy_compatibility.sql`

The compatibility migration admits the explicit `commercial-cash-withdrawals-2026-11-21-v1` scope without weakening the original closed-loop scope. Prizes, paid entry and NBA remain outside both scopes. The restricted commercial runtime role, supply checks, custody checks and existing transaction guards are preserved.

The account lifecycle migration provides private export and cleanup intent, preserves unresolved financial facts and prevents queued cleanup from being reported as completed deletion. Encrypted bank payloads are separate from immutable financial facts. Retention policies are deliberately unconfigured. Provider erasure requires actual evidence; a queued intent is not a completed provider deletion.

## Actual setup needed before activation

### Identity provider

The implemented adapter is for Sumsub. Supply the real provider account, client ID and configured verification level, and verify the contract, data region, required identity/selfie/residence checks and deletion arrangements. The code tests use mocked HTTP responses; they are not a successful Sumsub Sandbox enrollment.

Configure these as server-only production variables through the hosting secret controls:

```
DOCKED_SUMSUB_APP_TOKEN
DOCKED_SUMSUB_SECRET_KEY
DOCKED_SUMSUB_WEBHOOK_SECRET
DOCKED_SUMSUB_IDENTITY_HASH_KEY
DOCKED_SUMSUB_CLIENT_ID
DOCKED_SUMSUB_LEVEL_NAME
DOCKED_SUMSUB_WEBHOOK_ALGORITHM
DOCKED_WITHDRAWAL_BANK_KEY_ID
DOCKED_WITHDRAWAL_BANK_KEYS
```

The API, webhook and stable identity-hash secrets must be distinct. Bank data uses a separate rotatable 32-byte key registry. Do not paste production credentials into chat, source control, logs or the browser. Do not reuse production keys in acceptance.

The production provider return URL is fixed to `https://docked.com.au/profile/withdrawals`; the signed callback route is `/api/webhooks/commercial-identity`. Configure the algorithm to match the provider's actual HMAC setting. Acceptance uses the separate `DOCKED_ACCEPTANCE_SUMSUB_*` and `DOCKED_ACCEPTANCE_WITHDRAWAL_BANK_*` variables plus the fixed isolated `DOCKED_WITHDRAWAL_ACCEPTANCE_ORIGIN`.

### Schedule and actual money

The Owner must choose the actual credit/AUD conversion, withdrawal minimum, maximum, rolling 24-hour limit, fee and identity freshness. No competitor's withdrawal limit or fee has been substituted as an approval.

Confirm the operating bank account, the human payment process, bank ownership evidence and reconciliation process. Allocate actual settled cash once, with source-receipt and bank evidence. Google gross purchase charges are not a cash balance in Docked's bank. Funding must account for fees, refunds, tax and the chosen redemption promise. A separate reconciliation record is required for any allocation of a bank batch across receipts; do not count the same bank credit again under renamed references.

### Published scope and consent

The new, unpublished candidate packet is `config/cash-policy-content.json`. Inspect its wording against the actual provider, bank process and schedule before publishing it. New cash notices are selected only with:

```
DOCKED_COMMERCIAL_CASH_POLICY=true
TERMS_VERSION=2026-11-21-terms-market-withdrawals-v1
PRIVACY_POLICY_VERSION=2026-11-21-privacy-market-withdrawals-v1
```

Retain this published document selection after a stop so accepted cash obligations remain visible. Use the separate request/payment controls to stop new activity. Existing members must accept the new required versions through the normal consent flow.

Review the actual Play listing, Payments scope, Data Safety, content-rating and applicable financial-feature answers for the complete app and linked website. Update and submit changed answers. Website placement does not establish an exemption, and another app's listing does not establish Docked's classification. Record the true assessment basis without inventing a Google approval. No support request or store submission has been sent by this work.

### Hosted acceptance and release

Use protected disposable acceptance with two independently authenticated synthetic members, fictional already-allocated cards and synthetic funding. Do not test a Production sale or cash payout. Existing shared Preview fixture permissions must not be expanded casually; use a dedicated reviewed acceptance scope. Preserve the current commercial admission and restricted runtime role.

Exercise the real hosted auth/consent flow, a provider Sandbox review and signed callback, bank review, sale-to-withdrawal reservation, competing spend, expiry/revocation, unknown/retry recovery, refund before claim, return and immediate stop. Verify export/deletion and provider cleanup handling. A permitted browser and physical Android pass remain required because this executor could not launch Chromium.

Once the real inputs and hosted evidence are complete, deploy a production-target candidate without promotion, verify it, then promote that same production build. Preserve exact source, migration and configuration evidence. Use the independently controlled environment and database flags for new withdrawal requests and payment claims; do not change the unrelated live features.

```
DOCKED_COMMERCIAL_WITHDRAWAL_REQUESTS
DOCKED_COMMERCIAL_WITHDRAWAL_PAYMENTS
DOCKED_COMMERCIAL_MARKETPLACE
```

The commercial billing control must carry the explicit cash scope, `withdrawals=true`, the matching immutable withdrawal policy version and truthful decision references. The withdrawal database controls must also admit the corresponding operation. Code, a public notice flag, or one environment variable alone is insufficient authority.

## Verification record

- Integrated Next.js production build: passed after restoring existing baseline assets omitted by the sparse checkout.
- Full project TypeScript: passed, including the production build's check.
- Full repository ESLint: passed before the final bounded-reference presentation addition; final root results are recorded in `VERIFICATION.json`.
- Focused platform run: 71 tests passed, zero failures/skips, covering receipt verification, KYC, policy selection, cash policy/crypto, lifecycle export, fixed-price market and existing Owner view.
- Native PostgreSQL 17.12 / Node 22 withdrawal run: 10 reported tests passed (nine scenarios and their parent), zero failures/skips. This includes concurrent reservations, actual pack-spend races, original/cash-policy issuance, direct SQL invalid-scope denial, MFA, claim/retry/stop, refunds and immutable records.
- Native lifecycle and existing Marketplace suites: one test each passed, zero failures/skips.
- Native AFL and NRL compatibility regressions: one test each passed, zero failures/skips.
- New server-secret canaries: absent from 114 generated browser assets. The five withdrawal/Sumsub marker values were supplied during the integrated build.
- Actual bundled React components: synthetic in-memory API interactions passed; see `MOCKED_COMPONENT_UI.json` for the exact checks and source hashes.
- Real Chromium/layout/screenshots: **not verified**. Chromium was blocked before launch by the executor's process-singleton socket permission. No restriction was bypassed.
- Hosted signed-in acceptance, real provider connectivity, actual bank settlement and live payout: **not performed**.

The A$7/A$19 top-up candidate and its separate Android product-ID update are not part of this release.
