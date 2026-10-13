# Credit V2 — financial reconciliation

13 October 2026. Existing wallet, lots, immutable journals and SQL postings retained.
No migration, balance adjustment, grant or historical rewrite required by these fixes.

## Units and reconstruction

All postings are whole credits (one AUD cent at the boundary). No floating-point
wallet arithmetic. 7.5% uses integer half-up with no minimum; commercial approval
remains outstanding. Transfers move existing funding lots using acquisition-time/ID
FIFO; resale never creates a new payment. Parent lots retain original capture provenance.

- Per transaction: sum(posting credits) = 0.
- Customer closing = opening + sum(member-lot postings during period).
- Lifetime issued − extinguished − outstanding = 0. Internal balance reservations
  and transfers do not create additional value; fees reduce customer circulation.
- Available + pending + reserved = total. Withdrawable/restricted are eligibility
  subsets, not additional spendable balances. Gameplay points/salary are unrelated.
- Confirmed gross payment = settled net receipt + processing fees, where settled.
  Captured but unsettled value is provider receivable, not bank cash.
- External available balance + external reserved funds − ledger provider cash =
  reconciliation difference. External balances remain unverified without statements.
- Withdrawal reservation prevents spending; verified success extinguishes liability;
  verified failure releases once; unknown outcome remains reserved.

## Owner export

Existing owner/AAL2 CSV now accepts inclusive Sydney calendar From/Through dates.
DST-aware boundaries map to UTC. It reports one row per transaction, underlying
immutable postings/hashes, actor and internal user references, funding/capture/
settlement references, type, debit/credit movements, seller proceeds, commission,
adjustment class, customer-liability movement and opening/closing balances.
The PERIOD row covers empty periods too. Never sum running opening/closing balances.
Gross movements include clearing/reservation movements: they are not cash receipts
or revenue. Current funding exception status is labelled current, not historical.
Formula injection is escaped; no email/identity documents included; ordinary users
cannot export. Invalid/reversed dates return a safe error.

## Worked local simulation

A$10 confirmed -> 1000 credits. Purchase existing fictional card for1000 -> seller925,
commission75. Resell that card for900 -> seller832, commission68. Simulated verified
payout832 -> remaining customer liability25, total commission143, simulated cash168.
25+143=168. Resale does not add deposits. Source: credit-only worked-example receipt
and repeatable financial unit tests. This is NOT a beta cash-out entitlement.

## Certification and limitations

Tests cover partial withdrawal, refund/dispute after resale, targeted funding holds,
unknown payout, duplicate failure/success, fee boundaries, insufficient funds,
double-spend/same-card races and rollback. New validation rejects missing member-lot
postings; hash checks reject altered history. Hosted aggregate and SQL postings are
read-only compared; no simulated provider account is described as real approval.

Commercial credits: unavailable. Hosted lots: nonredeemable test grants/proceeds.
Historical bonus rights: preserved and not converted. Cash backing: not asserted.
Operational commissions are not formal accounting revenue or profit.

## Rollback / forward recovery

Code-only changes. Restore previous release dafb3949 / deployment
dpl_6q2Xx9WQpbwZ4wGTXDQXdoc8qNcr if this candidate is later promoted and fails.
Retain ALL state, history and postings. Closed listings remain closed under old code.
Never restore an old aggregate to undo customer transactions. Reapply fixed code
after inspection; successful request keys retrieve existing results. No DNS/email change.
