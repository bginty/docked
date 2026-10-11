Invitation update — 11 October 2026: the owner-authorised first friend invitation was submitted once by Docked support (Graph HTTP 202). Inbox delivery and recipient acceptance are unverified. Eligibility only: no account, password, consent or cards created. The restricted transactional-recipient list includes this authorised recipient. Earlier “no invitation sent” or “send approval pending” statements are superseded.

# Customer-style friends onboarding — 11 October 2026

**Released update:** [Friends v17 release](FRIENDS_V17_RELEASE.md) is current. Domain/HTTPS, ordinary member hosted acceptance and connected v17 APK now pass. Transactional account emails are enabled under explicit owner approval; no named friend's invitation has been sent. Older outstanding/preparation statements below are historical.

Active continuation of the staged friend release. A recipient has been supplied privately; **sending has not been authorised**. Do not pre-create that person's account, choose their password, accept terms, open a pack or save a lineup for them.

The staged release instruction supersedes waiting for tonight's collector before login/cards/teams/free-swaps testing. Keep the existing 23:20 Sydney follow-up unchanged. Collection and a completed genuine member round remain pending. Privacy, admission, ownership and authentication checks remain mandatory. Payments, prizes, withdrawals, cash trading and unrestricted registration stay disabled.

## Changes

- Immutable, capacity-limited invitation eligibility creates no Auth account or consent. The narrow signup worker creates an identity only after the invited person submits their own password. Retries never overwrite that password. No privileged Auth key reaches the web app or APK.
- Verification GET does not consume its token; same-origin POST establishes the session. AU18+/policy/display-name acceptance follows. Onboarding resumes from a verified session without an internal admission code.
- Starter entitlement and opening are separate. The member opens ten NFL cards themselves: 2 QB / 3 RB / 3 WR / 2 TE. Issuance remains atomic and exactly once. Prior allocations, fictional history and commercial scarcity remain intact.
- Policy cutover has explicit existing-member reacceptance, preserving owner/admin MFA and old consent events. No owner password/factor changes.
- Protected acceptance can expose the same customer screens while all backend invitation/admission controls remain enforced.

## Executed evidence

- 149 database tests passed, including invitation cap, verified AU18+ admission, role isolation and separate pack opening.
- Full platform run: 267/269 passed initially. Two mail tests expected the superseded provider URL; updated to assert the exact new signup verification interstitial. The affected mail suite then passed 7/7. Initial sandbox temporary-file failures were resolved by the normal-permission run.
- Isolated browser scenarios passed at 360, 412 and 1366 pixels: signup failure/retry, unchecked consent, no internal code field, explicit pack opening, overflow and accessibility. Screenshots in `qa/customer-onboarding/` are component fixtures, not a friend's acceptance.
- Fresh credential-free production compilation, typecheck and lint passed.
- Hosted rollback-only two-user SQL acceptance passed: real historical results, 71.24 totals, immutable locked snapshots, standings and a labelled synthetic +0.04 correction. Owner policy resumption rejects AAL1 and appends once at AAL2. All acceptance records rolled back.
- Both additive migrations applied to the exact isolated beta project with unchanged fingerprints for existing accounts, MFA, profiles, consent, holdings, commercial scarcity and lineups. Signup worker deployed **disabled**. No account or email created by deployment.

## Hosted customer acceptance update

An isolated synthetic ordinary account now passed real Auth creation, non-consuming verification GET and token POST, original-password login without MFA, resumed AU18+/policy/display-name acceptance, an unopened entitlement surviving refresh, and explicit opening of ten real NFL beta cards once. No external email was sent: the QA verification token was generated privately; this is not new delivery evidence. The owner and named friend were not modified.

Hosted browser selection saved/reopened seven eligible cards and replaced the QB before lock. Pending points remained empty. Each unlocked internal draft was removed with its snapshot preserved in an audit event, before any genuine round lock. The internal QA reservation remains within the ten-account ceiling (nine remaining external slots); no permanent roster or scarcity guard was bypassed.

Console acceptance found a server/device date-format hydration mismatch. A shared local-time component now hydrates a deterministic UTC fallback before device formatting; its Sydney browser regression passed. A persisted beta-only team name was also added with input validation, own-account enforcement, request idempotency and audit history; the additive migration preserved existing holdings and commercial inventory. The focused database regression, typecheck and lint passed. The latest hosted browser acceptance passed: team name saved/restored, valid lineup saved/restored and replaced, all five mobile tabs, admin denial and no page errors.

## Outstanding release evidence

Domain/callback transition; accessible domain check; accepted-host Android build and credential/signature scan. Do not label these passed from SQL or component tests. No friends APK is released yet.

Keep DNS/Auth rollback preimages in `private-data/friends-cutover/`. The holding page and owner APK remain released until cutover passes. Do not distribute v16 as a friends build. No invitations until explicit send authorisation.

