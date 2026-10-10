# External services and facts — reviewed 10 October 2026

This document records research and missing access, not purchases, commercial permission or live-feed acceptance. Existing credentials were inspected by **key names only**. No authorised commercial EPL/NFL player-statistics account, PayPal sandbox merchant configuration, verified bank details or identity-provider account was found in the configured release path. Retired odds credentials are not a fantasy scoring entitlement.

## Sporting data and real-player catalogue

| Sport    | Current state                                      | Candidate / evidence                                                                                                                                                                                              | What remains                                                                                                                                                     |
| -------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EPL only | Synthetic owner QA; no real catalogue imported     | [Sportmonks fantasy API](https://www.sportmonks.com/football-api/solutions/fantasy-football-api/) and [pricing](https://www.sportmonks.com/football-api/plans-pricing/): Starter begins EUR29/month, five leagues | Confirm EPL selection, commercial hosted fantasy and storage rights, every required statistic, correction cadence and costs; test completed and upcoming matches |
| NFL      | Synthetic QA and existing individual-offence rules | [SportsDataIO licensing](https://sportsdata.io/help/data-rights-and-licensing-questions): personal Discovery Lab is not the commercial product                                                                    | Commercial fantasy quote **UNKNOWN**; exact player-stat coverage, delayed/live cadence, identifier and correction acceptance                                     |
| AFL      | Fixture scoring only                               | Live feed outside this release                                                                                                                                                                                    | Do not present synthetic statistics as current AFL scores                                                                                                        |

Recommendation: request Sportmonks EPL coverage/rights confirmation before paying EUR29/month; request a scoped NFL commercial quote. No subscription bought and no provider terms accepted. Photos, player likeness, club logos and collectible-card marketing/sale rights require separate verification; a statistics licence is not sufficient evidence. Keep supplied Docked artwork.

The new catalogue manifest validates stable provider IDs, current team versus edition history, source evidence, freshness and approved rights. Replacement is an auditable proposal; it does not rename old fictional cards, burn assets, mint cards or change caps. Existing first-year eligibility and formation validation are retained. Without an approved complete real roster, it is impossible to certify valid real-player starter teams; synthetic competitions remain labelled and isolated from normal external beta activation.

`authorised-scoring-feed.ts` is a strict adapter input boundary, not an operational feed. It checks commercial/storage approval, review expiry, EPL-only scope, known fixture/player mappings, freshness, missing player coverage and existing sport-stat validators. The synthetic scorer remains separate. No public ingestion endpoint or cron was enabled. Provider-specific fetching, raw revision archive, durable live reconciliation/finalisation and actual live observation remain required.

EPL needs playing-time/ordered substitution evidence, goals, assists, saves, penalty saves/misses, yellow/dismissal distinctions, own goals and goals conceded while on pitch. NFL needs every field in the existing versioned offence schema, including return/defensive/bonus exceptions as defined there. Null/missing statistics stay pending. No FPL totals are imported.

## Verified next fixtures and deadlines

Checked 10 October 2026, after 11:45 UTC. Times below are **Australia/Sydney (AEDT)**, not UK/US dates. Official schedules may be revised.

- EPL: four 15:00 UK fixtures on 10 October start **11 October, 01:00 AEDT**. Arsenal–Leeds at 22:30 AEDT on 10 October had already begun. Next full listed round starts Everton–Chelsea **17 October, 22:30 AEDT**. [Premier League published fixture list](https://www.premierleague.com/en/news/4675097).
- NFL: Eagles–Jaguars next scheduled game is **12 October, 00:30 AEDT** (11 October, 09:30 EDT). [Official Eagles schedule](https://www.philadelphiaeagles.com/schedule/?lang=en).
- **Docked live lineup deadlines: UNSET for both sports.** No live competition has been created or mapped. Fixture kickoff is not an invented active Docked deadline. Operator must map the competition, approved lock policy and all fixtures before publishing a deadline; never create a full round after its first fixture has started.

## Payments

[PayPal Orders v2 standard checkout](https://developer.paypal.com/studio/checkout/standard/integrate) is the integration path. Fixed sandbox host, server-owned amounts/currency/payee, idempotent create/capture and [verified webhook signatures](https://developer.paypal.com/docs/api/webhooks/v1/) are implemented as an adapter. Current evidence is mocked HTTP contract tests and real local database concurrency, **not a PayPal sandbox purchase**.

Required server-only configuration: sandbox client ID, client secret, merchant ID and webhook ID. Guest card checkout depends on merchant/product eligibility and has not been verified. Live activation requires the approved product model and applicable [PayPal acceptable-use review](https://www.paypal.com/au/legalhub/paypal/acceptableuse-full?country.x=AU), not merely successful API credentials. No account created or agreement accepted.

[AU published merchant pricing](https://www.paypal.com/au/business/paypal-business-fees) as reviewed: standard domestic commercial transactions 2.90% + A$0.30; international and other services differ. This is not a confirmed Docked merchant quote. At those standard domestic rates, A$49 and A$99 receipts incur approximately A$1.72 and A$3.17 respectively, before other adjustments. The dashboard reports reconciled supplied fees only; it does not substitute these estimates as actual fees.

Direct transfer remains unavailable until verified merchant account name/BSB/account number and a trusted reconciliation process are supplied. Server-issued references and expiry, awaiting-payment states, and duplicate/partial/excess/late payment review are implemented in the sandbox. Uploaded receipts never confirm funds. No bank details were invented.

## Identity / withdrawals

Candidate: [Veriff self-serve](https://www.veriff.com/plans/self-serve), advertised $0.80/check with $49 monthly minimum; the public page inspected did not explicitly identify dollar currency, so confirm billing currency and Australia/product scope before approval. Hosted verification avoids Docked document uploads. [Raw-body HMAC requirements](https://devdocs.veriff.com/v1/docs/hmac-authentication-and-endpoint-security) underpin the tested webhook boundary. Actual session creation/provider mapping and network sandbox acceptance remain unconfigured.

Alternative: [Sumsub](https://sumsub.com/pricing/) advertises Basic $1.35/verification, $149 minimum monthly commitment; verify currency, Australian coverage and product contract. Neither provider was subscribed. Recommendation: defer purchase until an approved withdrawable earning mechanism exists, then compare a Veriff hosted trial against the specific requirements.

KYC session binding, versioned provider status, current verified identity, beneficiary ownership, eligible-fund reservation, review/cancel/fail and duplicate request protection are tested with synthetic identities/balances. Real payouts remain hard-disabled. Pack spending, points and beta credits never become withdrawable funds. KYC alone does not establish payment-provider or regulatory permission.
