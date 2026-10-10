# Owner operations — friends release

Access: **Profile → Owner dashboard**, `/admin/operations`. Page, JSON and CSV all require the existing owner role, current member session and AAL2 MFA. Navigation is not the security boundary. SQL independently enforces the same checks. Members and other staff cannot use this owner-only report.

Default view is **Live**, with an honest unconfigured state. Select **Beta / test** to view the isolated hosted records. Sydney calendar dates are inclusive in the UI and half-open UTC timestamps in queries. Sport and staff filters are explicit. No live and synthetic figures are aggregated. No historical events are invented.

## Operational now

- Registered invitation-linked accounts, accepted admissions, newly created profiles, meaningful active members today/week/month/custom range.
- Meaningful activity: saved team update, opened pack, post or completed swap. Login alone does not count. Team updates have only their latest timestamp; the report does not pretend to reconstruct earlier engagement.
- Starter entitlements, teams, unique competitors, packs, offers, accepted trades and posts. All-time registered/admitted/starter counts are labelled separately from period activity. Sport filters omit unclassified pack/swap activity.
- Competition register: upcoming/deadline-overlapping rounds, locked/editable state, entries, scored entries, recorded ranks and rules version. Existing beta scores are simulations, not operational final winners.
- Current finite inventory by sport/player/edition/tier, permanent cap, issued count, remaining lifetime capacity and serial/issuance reconciliation. Transfers cannot replenish issuance capacity.
- Open moderation reports and failed outbox messages with links. No email addresses or identity documents in exports.
- Inventory CSV quotes cells and neutralises spreadsheet formula prefixes, including whitespace/control characters. Responses are private/no-store.

Counts exclude owner/administrative admissions and profiles with roles by default. The SQL/HTTP authorization gate still requires the owner even when staff activity is included. Returned lists are limited to 500 competition/edition rows and 100 reports, explicitly disclosed; these are not silently called complete exports at larger scale.

## Not configured; not zero

Live scoring/feed health, active paid orders, captures/refunds/disputes/provider fees, bank reconciliation, KYC, withdrawals and prizes have no connected hosted record source. Their sections say Not configured. No fake cash, wins or metrics. Full onboarding event funnel, weekly retention and return cohorts require additional durable activity history and are not claimed operational.

## Prize register foundation

`src/core/prize-register.ts`, `src/server/prize-sandbox-store.ts` and `sandbox/commerce.sql` provide an isolated, durable **synthetic-only** register. It records competition/sport/round/rank/member/display name, description/units/currency, rule/result versions, eligibility, verification requirement, award/due dates, operator, status/reason, reference/evidence and before/after audit history.

Only complete final results plus an explicitly approved schedule generate obligations. Stable award identity and a locked PostgreSQL transaction make repeated generation idempotent. Missing tie policy means held obligations. A corrected result holds existing awards for review, preserving fulfilled references and never paying again or silently creating replacements. Same-revision mutated results are rejected. Previously fulfilled obligations cannot re-enter payment; separate approved adjustment implementation is required.

Cash totals remain separated by currency; cards/packs have no invented valuation. A prize is never automatically wallet credit or withdrawable money. There is no activated prize scheme, hosted prize editor, payout button or scheduled awards job. Local sample register tests do not establish real prize eligibility.

## Finance and identity foundations

Sandbox order/KYC/withdrawal state is transactionally persisted under row locks with immutable before/after journal. Financial reporting separates captures, refunds, chargebacks and supplied provider fees; net receipts are not profit. No live wallet or earning mechanism exists. Buying a pack does not produce withdrawable balance.

The dashboard intentionally offers read-only operations until real source-specific adapters and approved workflows are connected. It cannot mint cards, edit balances, settle payments, alter locked rules or bypass KYC.

## Acceptance boundaries

See `qa/friends-release/real-postgres.json` and `commerce-postgres.json` for disposable PostgreSQL tests; `hosted-apply.json` for the precise additive hosted checks; browser screenshots are explicitly synthetic fixtures. Owner visual approval and physical Samsung S24 acceptance remain pending.
