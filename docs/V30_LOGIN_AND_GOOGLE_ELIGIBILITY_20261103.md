# Samsung v30 login and Google offer eligibility — 3 November 2026

Public launch remains **NO-GO**. This continuation fixed a genuine native login reset and completed the missing Billing Lab check. It did not complete a Google checkout, pack purchase or refund.

## Observed phone result

The Google Play-installed `docked.fantasy` v30 / 1.29 reached the isolated QA customer wallet through normal authentication. No owner account was used. The email/password form initially reset because every connected-network notification called `router.refresh()`. Instrumentation showed connected → document leaving → new mount, with no launch deep link present. This was not a keyboard failure.

The fix ignores initial/duplicate connected notifications, refreshes member screens only on a genuine reconnection or resume, and preserves authentication/MFA forms. Existing session checks remain intact. The Samsung then retained both fields, signed in normally and displayed the correct zero-credit isolated wallet. Repeated connected events no longer replaced the page.

Diagnostic implementation: `b8c44983`, `e214c682`. Clean fix without diagnostic UI: `da24e69d6e78bd4a1dbe53b740881386088a340e`, also integrated into the main working branch as `f6a5e399`. Android was not rebuilt.

## Google response

- Official Billing Lab: authorised licence-test account, temporary Australia override valid until 22:11 Sydney; response simulation and real-payment testing off. No permanent country change.
- Publisher readback at **10:07:28 UTC**: both exact `buy-au` options ACTIVE, Australia AVAILABLE, AUD49/AUD99, legacy compatible. No added offers or changed pricing.
- Actual v30 query: both `docked_credits_4900_v1` and `docked_credits_9900_v1` returned `UnfetchedProduct.statusCode=4`, including **10:10:31 UTC** after clearing only Play Store cache (0 B confirmed; app data retained).
- No native checkout sheet opened. No purchase, pack issuance, refund or new genuine RTDN occurred. These acceptance steps remain pending; older verified TEST results are not relabelled as today's v30 success.

Google documents code 4 as no eligible purchase option. The exact unmet eligibility predicate is not exposed. Active AU configuration, the Billing Lab override and cache refresh did not resolve it; no evidence justifies another product toggle or Android rebuild. The updated [support request](GOOGLE_NO_ELIGIBLE_OFFER_SUPPORT_20261102.md) asks Google to investigate the serving-side eligibility. It has not been submitted; explicit permission to send is pending.

## Checks and cleanup

- Diagnostic candidate: 14 targeted checks passed. Clean Production-based patch: **12 native/navigation/listener tests passed**, typecheck and targeted ESLint passed. These are separate overlapping runs, not a new full-platform regression.
- Protected hosted normal login/product mapping passed. Actual physical member login and wallet rendering passed. They do not prove purchase acceptance.
- At 10:11:54 UTC the isolated wallet was 0 available/held/withdrawable, receipts and reconciliation jobs empty, issued cards 0, packs 0.
- Both Google options confirmed INACTIVE by Publisher API at **10:12:46 UTC**. Isolated sales, issuance and transfers closed; audit records retained.
- Samsung exited TEST and returned to Welcome back. Temporary BillingClient verbose logging restored to default. No further phone work is required until eligibility is corrected.
- All **39 monitored Production table counts and full-row fingerprints matched** the before snapshot, including protected wallets, ownership, historical records and schedules. Retention cleanup disabled, archives 0. No migration applied.

## Production fix

The application-only candidate `da24e69d` is built from the safe `f0eb28e7` baseline. Only two source files and the targeted regression test differ. It contains no input diagnostics, acceptance transport, schema change or billing activation. Published policy v2 is unchanged. Deployment evidence is in `qa/native-login-release-20261103/`.

The clean fix is **deployed** to `https://docked.com.au`, deployment `dpl_DPuRZZ6E86VURysBJJmieGEVZ3zW`. All eight candidate route checks passed; live readback confirms `da24e69d`, public registration false and the commercial purchase API disabled (404). No diagnostic panel is included. The phone verification was performed against the equivalent isolated fix before promotion; no second signed-in Production test is claimed. Rollback is the existing closed-gate `dpl_6kKiZfN6qcin6HFJ3psRLs2qeakv`; no database rollback is needed.

## Remaining gates

1. Google must identify/correct the failed offer eligibility; then finish the pending v30 A$49/A$99 customer purchase, pack and refund/reconciliation journey using TEST transactions only.
2. The prior specific paid-pack/transfer/value-pathway commercial assessment and operational retention/key-custody decisions remain outstanding. Owner business-model and player-name approvals are already accepted and are not requested again. Proprietary statistics feeds stay disabled without documented rights.
3. Keep real-money settlement, public registration, withdrawals, paid entry and prizes disabled; NBA hidden. Do not submit publicly while mandatory gates remain unresolved. No submission or publication occurred here.

Primary evidence: `qa/google-eligibility-20261103/native-query.json`, `native-refresh-diagnosis.json`, `customer-active-catalogue.json`, `final-closed-catalogue.json`, `native-wallet-no-offers.png`; and the current `qa/v30-customer-billing-20261102/` ledger and integrity snapshots.
