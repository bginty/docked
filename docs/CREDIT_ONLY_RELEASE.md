# Credit-only economy — 13 October 2026

Docked Credits are the sole pack, marketplace and swap currency. 100 credits = A$1;
1 credit = 1 AUD cent at funding/payout boundaries. Fantasy salary remains an unrelated
roster budget. No entry, Core or gameplay charge. This release is nonwithdrawable testing.
Real deposits, withdrawals, prizes, commercial grants and direct AUD checkout remain off.

## Existing architecture extended

The existing CreditsSandboxStore, private aggregate, immutable SQL journal and balanced
postings remain the only wallet. Additive policy credit-only-2026-10-13-v1 uses existing
audit/history; no SQL schema migration or parallel wallet. No old journal is rewritten.
FIFO: acquisition timestamp then lot ID. Resale preserves original payment reference and
adds parent-lot links. Historical provenance stays unchanged, without fabricated backfills.
Available, pending and reserved are disjoint; restricted/withdrawable are subsets.

Confirmed captures create provider receivables; separate verified settlement records net
funds and processing fees. Customer allocation is the full confirmed amount. Pending
credits cannot spend. Existing PayPal signature and authenticated merchant/order/capture
readback remains. Tests simulate events; actual PayPal acceptance is NOT performed.
The hosted friends API denies funding, withdrawal and grant commands. No provider or bank
balance is claimed verified. No paid services or external-store workaround added.

Seller commission: 7.5%, nearest whole credit, halves up, no minimum; 1000 = 925 + 75.
Ownership transfers retain the shared seven-player advisory lock and database entry guards.
Financial swaps default to 50 each. Owner/AAL2 can append future bounded free windows with
reason, actor, UTC timestamps and Sydney display. Start inclusive, end exclusive. Database
server time controls acceptance. No fee means no balance required. Fee increases require
a new offer and both participants' consent; recipient quote must match current fee too.
Other pack/market fees remain. Existing free swaps outside the financial sandbox remain free.
No free window is activated by migration.

Unused purchased-credit withdrawal stays disabled. Simulated eligible resale proceeds test
reserve/review/submit/unknown/paid/failed/cancel. Unknown stays reserved. Verified duplicate
results cannot pay/release twice. Disputed original funding blocks related transferred lots
and payout submission; unrelated lots are not confiscated. Refund-after-spend creates a
recovery exception, not a silent card reversal. Refunded/disputed funds cannot count as
eligible backing. Settlement of disputed funding fails closed for operator review.

Owner reporting includes source payments, receivables, settlement, fees, refunds, lots,
balance components, circulation equation, turnover, commission, swaps, pack spending,
payout obligations/completions and exceptions. Test records are excluded from commercial
totals. Fees/net receipts are not labelled profit. CSV reuses formula-safe export and owner
MFA. Reconciliation balance means available provider/bank funds; reserves are separate:
available + reserves - ledger cash. External cash remains unverified until reconciled.

## Preservation and rollback

Pre-change revision 33: 103 card records; 11 entitlements including 4 legacy; zero deposits
and withdrawals. Barry's prior grant stays test-only with no repeat grant or paid conversion.
Standard 900/Premium 1800 test-credit prices remain. Legacy sealed rights retain old terms;
new legacy deposit-bonus offers are retired, not remapped to nine-card products.

Migration credit-only-policy-20261013-v1 adds one audited policy event. The migration receipt
records identical before/after protected aggregate hashes. No balance or ownership edits.
Rollback uses the saved pre-release Vercel deployment while retaining additive metadata and
all transactions. Never restore a stale wallet, reset grants or erase history. If an older
app omits quote-consent protections, pause transactions before rollback. No initial free
window is scheduled, reducing compatibility risk.

## Verification

Focused units cover exact conversion, pending/settlement, merchant binding, duplicates,
rounding, FIFO, multiple resales, disputes, unrelated funds, legacy entitlements and fee
boundaries. Local PostgreSQL covers concurrent payments/purchases/withdrawals and immutable
balanced postings. Hosted rollback acceptance exercises the actual allocator and store:
two dedicated QA nine-card packs then zero-balance free swap; original fingerprint restored.

Full platform: 318 tests, 310 pass, 8 Windows TEMP/git sandbox failures. Both affected files
rerun with filesystem access: 10/10 pass. Additional focused credit/member: 10/10 pass.
Database regression: 151/151 pass. Typecheck, lint and production web build pass. Candidate
and domain acceptance are recorded separately in docs/qa/credit-only when executed.

v22 uses https://docked.com.au/app. No native change or APK rebuild required; fully close and
reopen to load this web release. Physical S24 and owner visual acceptance remain pending.

## Remaining commercial decisions

| Decision | Current safe setting / recommendation |
|---|---|
| Unused purchased-credit withdrawal | Disabled until explicitly approved with provider-supported refund/withdrawal distinction. |
| Rounding | Whole-credit half-up/no minimum tested; approve commercially before real sales. |
| Free window dates | No active dates; owner can schedule test windows. Commercial cadence/dates require approval. |
| A$49/A$99 legacy bonus mapping | Preserve old rights; no conversion to nine-card packs without approved economics. |
| Provider/app-store product | Obtain approval for exact credit funding/resale/payout model and store payment design; ordinary checkout access is not proof. |
| Provider integration | Secure server-side sandbox merchant/webhook configuration and genuine provider settlement/payout acceptance still needed. No credentials in chat. |
| Customer/cash policies | Approve refund, chargeback, unused-funds and applicable regulatory/accounting treatment before activation. No commercial readiness claimed. |

No messages, invitations, subscription or new service. Additional cost $0.
