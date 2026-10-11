# Docked v20 pack reveal and invited test wallet

## Scope and progress — 11 October 2026

Reference video inspected at eight timestamps before implementation. Original Docked CSS effects replace the previous short transition: floating metallic pack, blue tunnel, controlled burst, rotating card and readable details. No reference footage, third-party branding or music is included. Six-second animation, Skip, reduced-motion/simple mode, background interruption, multicard Reveal all and persisted replay remain supported.

Hosted test wallet is separate from beta fantasy inventory and scored teams. Only the designated owner and verified Barry account are enabled. The existing audited aggregate, immutable balanced journal and allocator are reused. Browser identities never supply the actor. Owner access still requires MFA. No live payment or deposit workflow is connected.

Barry was verified against the recorded invitation, Auth identity, accepted admission and enabled roster. Exactly 100,000 non-withdrawable TEST credits were added once using reference `owner-authorized-barry-test-100000-20261011-v1`; resulting balance 100,000. See `qa/android-v20/barry-grant.json`. Existing ordinary cards and profiles were unchanged. Repeating the operation produced no additional grant.

Financial test cards are fictional, finite and labelled. Premium uses existing RARE tier (4,900 test credits); Elite uses ELITE (9,900). Twenty inventory units per test product; no future official supply consumed. Resales and swaps retain non-withdrawable test-credit provenance. Normal free-beta cards and swaps are separate. Real deposits and deposit bonuses remain disabled.

## Verification before deployment

- 288 application tests passed.
- Four responsive/reduced-motion pack browser checks passed (fixture harness, not hosted evidence).
- Real local PostgreSQL: duplicate grant, purchase contention, finite scarcity, repeated opening, private projection and database privilege denials passed.
- Production grant and runtime admission-write denial verified.
- Application build, TypeScript and client secret scans passed. Hosted acceptance and APK delivery are recorded separately after completion.

## Samsung installation

Downloading an APK does not install it automatically. After the download finishes, open **My Files → Downloads**, tap the Docked `.apk`, then **Update** (if already installed) or **Install**. Android may ask for permission to install from that specific source. Keep the current app installed; do not delete app data or disable global security controls. If blocked, report the exact Android message.

Alternative: open `https://docked.com.au` in Chrome or Samsung Internet, sign in with the invited account, then use the browser menu’s **Add to Home screen** / **Install app** if offered. This uses the same account and server records and avoids sideloading. Do not share owner credentials or Vercel access tokens.

Physical Samsung S26+ and S24 installation/performance acceptance remains pending; browser emulation and APK manifest/signature checks do not establish device acceptance.

## Hosted release acceptance

Application commit: `885de1b440d670b539f1577590f4e601ab2f469c`.
Deployment: `dpl_FCT6gGG2ZSou1YKh3K1UKiEhb2AR`.
Live entry: https://docked.com.au/app/login. Wallet: https://docked.com.au/fantasy/test-wallet.

Both private candidate and genuine custom-domain acceptance passed with the existing synthetic ordinary-member account: password login without MFA, anonymous denial, owner issuance/withdrawal/foreign-receipt denials, persisted purchase, lost-response recovery after reload with one debit, repeat opening with the same card, accessible mobile/desktop reveal and ownership persistence. No owner or Barry passwords, MFA factors or sessions were accessed. Barry's own human session and physical phone remain untested.

The synthetic QA account received one idempotent 19,600-credit non-withdrawable fixture, separate from Barry's grant. Its finite test purchases and receipts remain in immutable history; its temporary roster/wallet access was disabled after tests. Owner and Barry normal cards/profiles and Barry's test balance were verified unchanged by acceptance.

The first staging harness attempts failed on origin forwarding. One test purchase remained safely persisted, with its response unresolved by that harness; no user account was affected. The harness was corrected, and both candidate and genuine-domain tests passed. This was not treated as application acceptance until the subsequent real results passed.

Vercel's CLI initially had an expired session and refreshed normally. The local development OIDC token could not access this production candidate. A CLI curl attempt unexpectedly generated an automation token; it was never used/shared and was revoked without replacement. After explicit owner approval, one temporary private candidate link was used for testing and then revoked. Barry's domain access uses no hosting bypass or Vercel account.

The live domain serves the exact tested commit; HTTPS/www redirects, closed registration, foreign-origin denials and anonymous private-data denials passed. The public landing page was preserved. Rollback deployment is recorded in `qa/android-v20/rollback.json`.

Five Edge browser tests passed, including a six-second reveal and page-background interruption. Real local PostgreSQL purchases/openings were tested across eight independent restricted-role connections. Final hosted Vercel build passed; a redundant sandboxed Windows build could not canonicalize its path because of filesystem sandbox permissions (not reported as a passing local build).

## Short test script

1. Barry signs in with his own invited account, opens **Cards → Open test wallet**, and checks 100,000 test credits before spending.
2. Buy a test Premium pack. Open it, try Skip or simple mode, then replay. Reopen the app: the same card and balance must remain.
3. Inspect the card's ownership history. List it using test credits, or propose a swap with another admitted wallet participant who owns a test card. Review both sides and the displayed test fee before accepting. Reject/cancel a separate offer; ownership must not change.
4. Owner tools must remain unavailable to Barry. Normal free-beta cards, teams and swaps are outside this test wallet.

The owner has not received an unrequested credit grant. Two-person financial swaps require both participants to own eligible test cards and sufficient test credits; the owner's currently empty test wallet cannot supply a swap side. The normal free-beta swap experience remains available and unchanged.

No invitations/messages, real payments, subscriptions, certificate changes, public signup or unrelated-system changes were made.

## Android delivery

- File: `artifacts/android/Docked-v20-NFL-Friends-Beta.apk`.
- Version: **1.19-beta**, build **20**; 11,035,942 bytes.
- SHA-256: `fb42ea45d9170d21660420dee047a09b5813221230fd94ada2e45933fc294006`.
- Package: `au.com.docked.app.preview`; signature matches both the original v8 Desktop APK and v19. Minimum SDK 24, target SDK 36, arm64 included, debugging/cleartext disabled.
- Hosted environment manifest binds the tested commit and deployment above to `https://docked.com.au`.
- APK content audit and complete 988-entry extraction/secret scan passed. Private-bucket download was fetched without authentication and its hash matched. Link expires 18 October 2026 at 10:45 UTC (21:45 Sydney).
- Hosted recording: `qa/android-v20/Docked-v20-pack-reveal.webm` shows the saved, persisted synthetic test card. `Docked-v20-simulated-visual-preview.webm` is a separate mocked multicard visual demonstration, not hosted evidence.
- Installation instructions and the downloadable link are in the ignored delivery folder, ready to forward. No message was sent to Barry.
