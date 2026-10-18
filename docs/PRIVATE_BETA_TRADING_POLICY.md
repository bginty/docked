# Private beta trading policy — approval draft

Status: **NOT APPROVED / NOT ACTIVATED**. Prepared 18 October 2026 for the marketplace activation request. This supplements, and does not replace, the existing approved private-beta terms. It makes no new legal finding or cash-value promise.

## Existing rules retained

- **Accounts:** Owner, Barry and Luke only, identified by their existing verified account IDs in a reviewed operator record. Admission, an active session, account status and collection/privacy permissions must still pass. Owner actions require MFA. Enabling the marketplace does not admit anyone or enable public registration.
- **Credits:** existing eligible invited-test credits only. The current FIFO spending and restrictions continue. No new credits, deposits, purchased credits, withdrawals or cash redemption are enabled. Test credits have no cash value.
- **Cards:** existing eligible owned collectibles only, with permanent rarity and serials unchanged. Core/ineligible cards and cards reserved by current competition or swap rules remain unavailable. Already frozen competition snapshots retain their existing treatment; this policy does not create new competition locks.
- **Trades:** credit sales, private credit offers, card swaps and card-plus-credit offers, each separately switchable. A Both listing requires sale and swap permissions. Collection visibility, blocking, offer preferences, minimum prices and listing modes still apply.
- **Sale commission:** existing 7.5%, rounded half-up to whole credits, deducted from seller proceeds. Example: 1,000 credits → 75 fee and 925 seller proceeds.
- **Pure swaps:** existing 50 credits per member unless an already authorised swap-fee window applies. No card valuation is invented. No fee window is added by activation.
- **Combined offers:** the owner-approved 16 October rule remains `max(7.5% rounded commission, applicable per-member swap-fee floor)`, deducted once from the credit proceeds. The credit component must cover that fee. No additional pure-swap charge is applied to a combined offer.
- **Offers:** current seven-day private-offer expiry, three new offers per day, 21 outstanding offers and 24-hour declined-offer cooldown. Proposals do not reserve assets; acceptance rechecks cards, credits, fees and permissions. Existing legacy swap reservations and expiry retain their own rules. Listings remain until sold or cancelled.
- **Confirmation:** show the exact cards, credits and applicable fees before committing. A successful settlement is atomic and recorded once. Retry an uncertain request with its original request ID; do not submit a new trade to recover it.

## Decisions requiring owner approval

Approve the following operating procedure as a single versioned policy, or specify amendments:

1. **Finality and disputes:** a correctly authorised completed trade is final; no automatic change-of-mind reversal. A member can report a disputed trade to the owner with its receipt/reference. The owner records the case, preserves the evidence and investigates. Recording or resolving a case never changes assets by itself. No resolution deadline or reimbursement entitlement is promised by this draft.
2. **Corrections:** suspected errors or fraud trigger a trading pause where needed. Any asset correction needs a separately reviewed, explicitly authorised, journalled operation with recovery evidence. Never edit or delete a historical receipt, overwrite the live database, silently claw back a card, or generate compensation credits under this policy.
3. **Abuse and suspension:** retain existing admission, suspension, blocking, privacy and rate controls. The owner may pause trading while investigating suspicious activity; ordinary staff cannot resume it. An account removed from trading approval cannot start or settle trades. Cancellation/decline remains available to an otherwise admitted account; suspended accounts follow the existing account-access rules.
4. **Shutdown and recovery:** owner MFA can pause new listings, offers, purchases and acceptances immediately, using the same transaction lock as settlement. Cancel/decline, browsing and receipts remain available where account access permits. Reconcile uncertain outcomes and confirm current recovery coverage before resuming. Resume requires the approved policy, approved accounts, enabled trade types and deployment capability.

## Activation decision

The requested configuration is **Owner + Barry + Luke; sales + swaps + combined offers; external funding OFF; cash redemption OFF; public registration OFF**. The web role cannot record policy approval or add accounts. A reviewed operator transaction must record the approval reference, approved account IDs and modes under advisory lock 71820342. It must leave `paused=true` until acceptance gates pass.

Hosted acceptance is a separate asset-use decision. No real member card or credit may be used as a test fixture without explicit permission specifying the accounts, cards and fee/credit limits. No such permission is inferred from approval of this document. No additional paid service is required or authorised.
