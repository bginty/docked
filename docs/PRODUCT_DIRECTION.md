# Docked — authoritative product direction

Owner decision, 10 October 2026: Docked is permanently a multi-sport fantasy sports card platform.

**COLLECT. BUILD. COMPETE.** The approved supplied fantasy assets in `public/brand/docked` are the brand. Do not redraw the logo or restore the former tagline, navigation or product.

The app destinations are Play, Cards, Market, Social and Profile. Authentication, MFA, invitation controls, moderation and account rights remain mandatory. Presentation does not grant gameplay access.

Permanent card identity, finite edition supply, ownership provenance and atomic server-side transactions are product invariants. Rarity and money must never multiply fantasy points. No client can issue cards, select its pack outcome, alter a score or transact as another account.

## Implemented scope versus ambition

The first external friends beta is NFL-only, explicitly approved by the owner on 11 October 2026. NFL now has a hosted current-player catalogue, audited isolated beta grants, seven-player/FLEX teams, future whole-round entry, locked snapshots and post-game scoring/standings. EPL is unavailable until its data and scoring are verified; it must not block NFL release. Historical football cards and simulations remain preserved separately, never renamed into real-player cards. See NFL_MEMBER_BETA_ACCEPTANCE.md for the current evidence and limits.

Preview test-credit pack purchases, sales and trades are isolated test mechanics. The production-compatible free-play implementation disables commercial marketplace transfers. Do not describe these as live-money features. Public signup and external admission remain closed. On 10 October 2026 the owner separately authorised protected Preview gameplay exclusively for the existing verified owner, enforced by exact account identity and MFA. This does not approve external beta activation.

## Supersession

All earlier plans for betting recommendations, price comparison, predictive probabilities, odds providers, betting performance, sports-pricing research and associated automated jobs are retired. Their source and historical tests are archived under `legacy/retired-product`; they are not active build instructions. Existing database migrations and audit records remain historical evidence and must not be deleted to perform a product rename.

Historical documents and signed policy packets may preserve earlier wording. They do not override this direction or authorize restoring a retired service. A replacement consent packet requires its own version and approval; never edit previously approved bytes.

## Delivery boundary

The owner authorises docked.com.au deployment for the free NFL-only invite beta once shared privacy, security and admission checks pass. No further release-scope permission is needed. Until those checks pass, preserve the public holding page and stage working improvements in protected Preview. AU18+, at most ten admitted testers, no public registration. Ordinary members do not require MFA; owner/admin MFA remains enforced. Payments, cash trading, prizes and withdrawals remain disabled. No invitation or message sending until the owner supplies and authorises recipients. No unrelated project access.

## Acceptance

Scoring follow-on, 10 October 2026: separate EPL, NFL half-PPR and AFL event-based
beta rules are implemented in an isolated scoring lab. They use authored synthetic
fixtures and fake cards; they do not activate live sport feeds, issue member cards,
change existing football competition rules or establish historical balance. See
`SCORING-V1-ACCEPTANCE.txt` for the exact versions and readiness of each sport.

Local functional/database/concurrency tests, responsive browser evidence, hosted protected-Preview checks, physical Android checks and owner visual approval are separate gates. Report missing capabilities and blocked checks explicitly. Screenshots with synthetic data are design fixtures, never real members, card ownership or live competition evidence.
