# Google Play reviewer access — preparation record

Status: dedicated account now created by its owner, email confirmed and normal consent accepted. A genuine reviewer browser sign-in has been observed. Its password remains owner-held and is not stored in this repository. No authentication exemption or owner permissions granted. Console credential submission and full reviewer acceptance remain pending.

Current update, 1 November 06:28 UTC: the signup failure was not an expired invitation. The exact nominated address was missing from the approved-beta outbound-email allowlist. The existing four recipients were preserved and only the nominated reviewer added; all other secret digests stayed unchanged. Resending through the normal UI produced one accepted provider delivery (HTTP 202) at 06:18 UTC; the user then confirmed their email and signed in. Existing account/password preserved. Normal consent was accepted at 06:19:19 UTC. The invite expiry is the deadline to accept the invitation, not an ongoing trial deadline after acceptance.

Genuine reviewer sign-in exposed a separate access gap: signup admission existed, but `credits_sandbox.access`, `sports_feed.sport_sandbox_access` and the legacy shared `sports_feed.nba_beta_access` registry had no member row. The nominated ordinary reviewer was added to these existing registries at 06:27:50 UTC, following the same beta programme deadline as existing testers (2027-01-31 UTC). This legacy table name does not activate NBA: server customer-sport gates still admit only NFL/AFL/NRL. Wallet revision/hash, inventory, peers and feature controls were unchanged. Zero credits/cards/privileged roles were granted; the account's visible wallet correctly reads zero. Public review after the beta programme deadline needs a separately approved supported access programme; do not promise perpetual access.

## Exact owner setup

Account creation, password entry, confirmation and normal onboarding are complete. Do not recreate the account or reset its password. Ordinary members follow the existing member security policy; owner MFA requirements remain intact. Keep credentials out of source control, logs, screenshots and this document. Public registration remains closed.

Use Play Console → Docked → App content → App access → restricted functionality instructions. Enter the dedicated login securely there. Explain the actual verification steps and ensure reviewers can complete them without waiting for the owner's personal device. If normal MFA cannot provide a reviewable workflow, return this as an access blocker; do not bypass it or conceal different reviewer behaviour.

Confirm the exact account can access the same enabled NFL/AFL/NRL features as normal members, using the store-installed candidate. An already-signed-in owner session is not dedicated reviewer acceptance.

## Observed customer browser acceptance

- Reviewer Profile identifies the nominated confirmed Gmail account, with no Owner dashboard shortcut. The real wallet loads zero, and collection counts are zero rather than another member's inventory.
- NFL, AFL and NRL Play load. AFL has 22 slots; NRL 13; NFL seven. NBA remains absent, and the authenticated `/api/nba-beta` response is `allowed:false` after the membership repair.
- The NRL picker has no eligible cards. The free-Core gameplay programme has not been enabled. NFL currently opens closed Week 7 with no next week available. No draft or entry was saved.
- Each sport displays its six correct pack variants and an existing weekly four-Core starter entitlement. No pack was purchased, claimed through an action, or opened. Existing normal weekly issuance may initialise entitlements while reading the pack view; this is distinct from issuing/opening collectible cards. Four starter cards alone cannot fill a complete seven/22/13-player formation.
- NRL Market and unified Social load through the real reviewer session. No listing purchase, post, comment, reaction or follow was submitted.
- Direct owner operations navigation exposes only the security gate, not owner data; the account has no privileged database role. This is not a claim of an AAL2 owner-role penetration test.

Google's full-access checkbox remains unticked. A zero-balance, unplayable new-member account is not sufficient evidence for it. The exact remaining customer prerequisites are a verified eligible free-Core roster/round configuration and, for paid-pack review, an authorised test-funding/checkout workflow. The Console password field remains empty for secure owner entry when the full access declaration is truthful. Android reviewer-specific acceptance is still pending; the observed checks above used desktop Chrome.

## Instructions to paste after credentials have been verified

1. Install Docked from the supplied review build and open it. Sign in with the dedicated credentials entered above. Complete the documented account security flow.
2. PLAY: select NFL, AFL or NRL; inspect the competition and selected Week/Round, lineup, salary cap and rankings. Traditional uses the saved cap; All-Star is uncapped. Test seasons and awaiting statistics are labelled. NBA is unavailable.
3. CARDS: My Cards shows recorded owned inventory only. PACKS has Standard and Premium 1/3/9 products, unopened packs and history. Inspect quantity, rarity pool/chances and confirmation before any authorised test transaction.
4. MARKET: Browse, My Listings and Activity support credit sales. No offer/swap workflow is available.
5. SOCIAL: inspect posts, comments and reporting/blocking controls. Use only authorised test content if a mutation is required.
6. PROFILE: inspect sport-specific records, account settings, support@docked.com.au and the deletion request path. External deletion resource: https://docked.com.au/account-deletion.
7. The current candidate is invitation-only and uses non-redeemable test credits. Real payments, withdrawals, prizes and public registration are disabled. Do not promise a paid checkout that the supplied build cannot perform. Public paid-release instructions must be updated after that exact configuration passes acceptance.

## Optional supervised license-test access

This is a separate expiring server grant for authorised Google test accounts, not special reviewer approval. Google must clearly show a test payment method and no charge. The customer TEST receipt route rejects real purchases and binds each receipt to the signed-in member. The v27 normal native allowlist is empty. A separate v26 native paired harness has now verified genuine Google TEST purchases, hosted shared-member-engine pack settlement and refunds against a fixed synthetic subject; it did not provision the reviewer or establish an ordinary customer-authenticated checkout. That temporary environment is closed. See `HOSTED_MEMBER_BILLING_ACCEPTANCE_20261101.md` for evidence and the remaining boundary.

Required evidence before marking reviewer setup complete: fresh login, security steps, all visible sports, free-Core eligibility in an approved round, pack review and assigned inventory, signed-in hosted screenshots without secrets, logout/relogin and server denial of owner routes. No real account/balance mutations during preparation.
