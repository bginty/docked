# Beta-credit request and review workflow

The Rewards & Credits workspace now lets the verified owner find an admitted recipient, enter a positive integer test-credit amount and a reason, review the exact proposal, and confirm a saved request. Saved requests can be approved, declined or cancelled with a separate decision reason and confirmation. An approved request may subsequently be cancelled. Every status explicitly states that credits have **not** been issued.

## Existing policy and safe boundary

The existing promotion engine in `src/core/credits-sandbox.ts` already uses the authoritative credit journal, campaign restrictions, idempotency and owner/reviewer AAL2. Its policy in `src/core/credits-policy.ts` remains `PROPOSED_SANDBOX_ONLY`; it is not an approved hosted discretionary issuance policy. The present promotion authorisation does not require a second owner, so this review-record feature does not invent that policy. It also does not imply that self-review authorises a future financial transaction.

This feature stores administrative proposals and decisions only. It has no execution endpoint, no `issued` status, no ledger adapter call and no access grant to the existing wallet tables. There is no second wallet, balance, funding account or issuance ledger. Amount bounds of 1–1,000,000,000 match existing credit-command technical input validation; that upper bound is **not** an approved funding/campaign limit. The recorded policy version is context for the review, not evidence of activation approval. Requested credits are described as non-redeemable test credits throughout.

Hosted issuance must stay disabled until an approved funding/campaign policy, applicable limits, operator separation-of-duties requirements and an audited execution path through the existing journal are explicitly reviewed. An approved proposal must never be treated as an issuance receipt. No grants, retroactive rewards, wallet balances, existing packs or card ownership were changed by this implementation.

## Security and persistence

- Owner-only server authorisation and AAL2; existing live-session/admission/account checks remain enforced.
- The database independently verifies the active session, AAL2 and persisted owner role for every read, mutation and idempotent replay.
- List and recipient queries perform no domain writes, but use a normal transaction so the existing admission guard can take `SELECT FOR SHARE` locks. PostgreSQL SQL `READ ONLY` transactions reject those required authorisation locks; no privilege or guard is relaxed.
- Recipient search returns admitted enabled accounts by display name, handle or exact member reference; no email addresses are returned. Admission/account eligibility is checked again when creating or approving a request.
- The request proposal and requesting actor are immutable. Status changes use an expected revision and constrained state transitions. Audit events are append-only with actor, server timestamp, action, reason and original command.
- Each command has an actor-scoped idempotency UUID. An advisory transaction lock serialises retries, and a unique audit constraint prevents duplicate command recording. Reuse with different content is rejected.
- The client disables duplicate submission. When a response is interrupted or uncertain, it retains the same command/key for retry and prevents cancelling the unresolved confirmation. Opening or cancelling a review never sends a mutation.
- All tables use RLS with no direct app/public/authenticated/service-role table grants. Only tightly scoped list/mutate functions are executable by the existing application role. Internal helper functions cannot be invoked directly by that role.
- Same-origin POST checks, bounded request bodies, rate limits, four-second SQL timeout, 25-row paging and `private, no-store` responses apply.

Migration: `20261016220005_beta_credit_requests.sql`. It creates proposal/audit tables and guarded functions without changing existing wallet data. This workstream applied no hosted migration and made no deployment. Disable the route or revoke runtime execute privileges to roll back access; preserve the audit tables rather than dropping review history.

## Verification

- `tests/database/beta-credit-requests.test.ts`: actual migration on isolated SQL fixtures, create/review/cancel, exact retry, conflicting idempotency key, stale revision, terminal transitions, strict input validation, admission restriction, owner/staff/member/AAL1/inactive denial, direct privilege denial, immutable audit and unchanged credit-state snapshot.
- `tests/platform/beta-credit-requests.test.ts`: strict input shape, confirmation, amount/reason bounds and rejection of execution/redeemable fields; all UI statuses say credits were not issued.
- Both tests passed after correcting an initial SQL variable-qualification error. PGlite verifies sequential retry/state constraints; this is not a claim of real multi-connection concurrency acceptance.
- Existing owner-reference-reporting test passed with the complete migration sequence. The final migration additionally enforces JSON types for reason and revision.
- `scripts/beta-credit-request-browser.ts`: actual UI against a clearly isolated synthetic API at 1440, 412 and 360 pixels. It verifies preview/cancel causes no POST, an interrupted response retries the identical command ID without a second request, and approval remains visibly unissued. Screenshots and checks are in `docs/qa/beta-credit-requests/`.
- Actual authenticated local and hosted deployment acceptance are tracked separately. No physical-device acceptance is claimed.
