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
