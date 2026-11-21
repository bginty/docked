# Cash Marketplace candidate — release scope and remaining setup

## Status

This is a prepared release candidate. Marketplace transfers and cash withdrawals have not been activated in Production by this work. No live identity check, live bank payment, customer withdrawal or production schema migration has been performed. The existing live Owner landing release remains separate.

The owner has asked to proceed with Marketplace and withdrawals. That business direction permits implementation and preparation; it is not a claim that Google, Sumsub, a bank or a regulator has approved Docked's actual cash model. This candidate can record an honest `owner-reviewed-advice` decision basis. A written Google support response is not a universal prerequisite in the implementation. A response, if actually obtained, can instead be recorded as `google-written-determination`.

## Exact scope

- Existing digital cards can be sold at a fixed price through the commercial settlement ledger. The existing card and serial move; a resale does not mint another card.
- Withdrawable value comes only from eligible, settled card-sale proceeds with the required receipt provenance and recorded cash funding. Purchased credits, TEST/beta credits and promotional value are not a voluntary cash balance.
- Identity verification uses the configured Sumsub-hosted individual level. The server requires authoritative approved identity, age and Australian residence evidence. A browser result or webhook approval claim cannot grant eligibility.
- A bank destination needs a matching verified identity and a separate, attributable ownership review. A name match by itself does not verify bank ownership.
- A request reserves its credits and associated cash funding. Payment claims, actual transfer references, uncertain outcomes, confirmed unpaid/returned payments and refund exposure stay in an auditable ledger.
- Legitimate store refunds remain governed by the original payment method and applicable rights. A customer withdrawal does not replace a Google purchase refund.
- This scope does not add prizes, paid entry, NBA commerce, auctions, direct credit gifts, swaps or mixed offers. Those historical/private-beta paths remain outside the cash release.

The public withdrawal schedule is supplied by the configured and approved numerical policy: conversion rate, minimum, maximum, daily maximum and fee. This candidate does not invent those values or promise a payout time. The customer sees the applicable schedule and current availability before making a request.

## Database compatibility audit

`supabase/migrations/20261121075714_commercial_cash_policy_compatibility.sql` was generated with the installed Supabase CLI using `supabase migration new commercial_cash_policy_compatibility`. It replaces only two existing functions and repeats the existing denial of direct runtime access to the private lineup function. It updates no control row, feature flag, policy, balance, card, pack or competition and grants no new authority.

| Active boundary                                  | Original restriction                                                                                      | Candidate behavior                                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commercial_billing.card_guard()`                | The permanent issuance guard admitted only `commercial-closed-loop-2026-11-01-v1` with withdrawals false. | Preserves that branch and adds the explicit `commercial-cash-withdrawals-2026-11-21-v1` scope. Cash requires withdrawals true, finite future expiry, all existing reference strings, all cash decision references and a supported assessment basis. |
| `commercial_billing.lineup_inventory(uuid,uuid)` | Owned-card lineup projection admitted only the original policy and its current expiry.                    | Preserves the original branch and adds the separately checked cash scope. Authenticated session, competition eligibility, gameplay flag, ownership, opened-pack, lock and recovery checks are unchanged.                                            |

Cash decision references are `withdrawalPolicyVersion`, `ownerDecision`, `legalAssessment` and `playAssessment`. They must be actual nonempty reference strings meeting the shared core validator's minimum length after trimming. Existing `owner`, `legal`, `googlePlay`, `privacy`, `retention`, `refundRecovery`, `playerRights` and `supplyReconciliation` references remain required. `prizes`, `paidEntry` and `nba` must remain JSON false. The assessment basis must be exactly `owner-reviewed-advice` or `google-written-determination`; a general claim that approval is guaranteed is not accepted.

The migration preserves the mint transaction identity, unopened/current purchased pack, member ownership, committed draw, sport, slot, duplicate-player, approved definition, sequential serial, lifetime cap and deferred balanced-supply checks. It does not infer that a valid cash decision record authorizes a withdrawal: the withdrawal ledger separately checks the configured numerical policy, actual funds, identity, destination and current switches.

An audit of `supabase/migrations`, active `src` code, `scripts/lib` and operational configuration found these two active SQL hard-coded scope restrictions. The server's `member-commercial` checkout-session policy metadata was also reported for correction to read the actual control policy. The old `scripts/lib/paid-launch-configuration.mjs` generator deliberately remains a closed-loop release tool and must not be reused to activate this cash release. Historical fixture approvals, `config/mobile-store-release.json` approval metadata, beta flags and the unused `commerceReadiness` constant are not cash activation authority and have not been rewritten as approved.

## Documents and declarations

The full candidate policy packet is `config/cash-policy-content.json`; the existing published closed-loop packet remains unchanged. It is selected only when `DOCKED_COMMERCIAL_CASH_POLICY=true` and both exact consent versions are configured:

- Terms: `2026-11-21-terms-market-withdrawals-v1`
- Privacy: `2026-11-21-privacy-market-withdrawals-v1`

Document publication is persistent and separate from requests/payments switches. Stopping new requests or payments must not hide the cash terms that already apply to completed transactions and unresolved obligations. The publication flag is not evidence of provider or funds readiness.

Before publication, assess the actual enabled data flows and declarations: provider-hosted ID, selfie/liveness and proof of residence; encrypted bank destination details; purchase and withdrawal history; counterparty-visible listing/profile information; processors and overseas handling; retention and deletion. Update Google Data Safety, financial-feature declarations, rating answers and listing claims wherever the actual answers change. Website placement alone does not establish exemption from Google Play rules. Do not declare private financial records publicly shared when they are not.

The earlier `docs/qa/fixed-price-market-20261121/REVIEW.md` and `docs/FINAL_GOOGLE_RELEASE_READINESS_20261101.md` describe a release without withdrawals and without real identity-document collection. Preserve them as historical evidence. Their closed-loop reasoning and draft no-withdrawal Google question do not describe this candidate and cannot serve as cash-release approval.

Account deletion first revokes access. Required financial history and a pending provider/local sensitive-data review may need to remain while obligations are resolved. A queued cleanup request is not proof that provider records were deleted. Export is restricted to the member's own minimized status, masked destination and financial history; it does not disclose document images, name fingerprints or bank ciphertext. No new fixed retention duration is invented here.

Current official declaration references:

- [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271)
- [Content rating](https://support.google.com/googleplay/android-developer/answer/9898843)

## Remaining operational inputs

Production activation needs the actual provider account and level, environment-specific API/webhook/hash credentials, bank encryption keys, the published numerical withdrawal policy and its real decision references, recorded bank funding with evidence, and a protected hosted acceptance run. The environment names and provider restrictions are documented in `README.md`. No credentials or paid provider account were created for this candidate.

The hosted acceptance must use the separate acceptance environment, authenticated synthetic members, test-only provider identities and fake funding. It must exercise link creation, review/callback refresh, bank review, concurrent request/reservation, cancelled and uncertain payment outcomes, completed/returned payment records, purchase-refund exposure, session revocation and immediate stop. A local mock or a production customer's real sale must not be substituted for this controlled check.

Cash activation is a distinct audited action after the exact deployment and configuration are reviewable. Preserve current baselines for balances, lot provenance, cash funding, existing card custody, serial counts, supply counters, recovery cases and journals. Emergency stop prevents new settlement or payment as designed; existing completed obligations remain visible and require forward resolution.

## Verification record

The provider adapter has 37 passing HTTP-mocked tests, and the document-selection/customer-copy gate has four passing tests. The two existing paid-home tests also passed in the same run. Those tests do not claim that a live Sumsub account or bank flow works.

The withdrawal agent's final native withdrawal run passed **10 tests, zero failed or skipped**, including real permanent pack issuance under the cash policy, the original closed-loop initial issue, credit-spend/reservation races and direct SQL trigger rejection of invalid cash approvals. The new SQL compatibility migration was included.

`tests/database/commercial-lineup.test.ts` passed separately for AFL and NRL against **native PostgreSQL 17.12**, one test per fresh isolated cluster, zero failed or skipped. Fresh clusters avoid reusing the old fixture's cluster-wide runtime roles between sports; no production role check was bypassed. The fixture now creates genuine synthetic public profiles for the existing active-session check, and it no longer reinstalls the historical lineup function after loading all current migrations.

The direct lineup SQL assertions cover identical existing-card projection under both policies, false/string withdrawal flags, unsupported prizes/paid-entry/NBA scopes, expired/infinite expiry, malformed original reference types, missing/whitespace cash decision references, an invented assessment basis, both allowed real decision-basis labels and gameplay shutdown. The rest of the original test still exercises saved lineup validation, locked-card sale/transfer denial, cross-member privacy, custody movement and unchanged other rounds. ESLint passed for the modified test. A source comparison also confirmed byte-identical card update and issuance-switch checks and all pack/supply/ownership logic outside the approval predicate.

Commands used for the two lineup checks (each through the disposable local PostgreSQL runner):

```sh
node --import tsx --test --test-name-pattern '^AFL:' tests/database/commercial-lineup.test.ts
node --import tsx --test --test-name-pattern '^NRL:' tests/database/commercial-lineup.test.ts
```

Final integrated build, complete scoped lint and final source hashes belong to the root release verification. They must be recorded from that run before treating this as a deployment package; the checks above do not imply production deployment or live-provider acceptance.
