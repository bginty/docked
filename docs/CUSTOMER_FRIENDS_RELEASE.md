# Customer-style friends onboarding — 11 October 2026

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

## Outstanding release evidence

Fresh ordinary-member hosted signup/token verification, interrupted onboarding and team restoration; domain/callback transition; accessible domain check; accepted-host Android build and credential/signature scan. Do not label these passed from SQL or component tests. No friends APK is released yet.

Keep DNS/Auth rollback preimages in `private-data/friends-cutover/`. The holding page and owner APK remain released until cutover passes. Do not distribute v16 as a friends build. No invitations until explicit send authorisation.
