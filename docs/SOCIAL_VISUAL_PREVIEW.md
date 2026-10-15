# Premium Social and profile photos — 16 October 2026

Implemented locally on top of `2cc6dae3`. **The new revision is not deployed.** The existing protected Preview is not yet compatible with the current application; the blockers below are verified, not assumptions. Production application, member accounts, assets and competitions were not changed.

## Visual result

The supplied `DOCKED_ The Ultimate Card Collectors Hub.png` was available and inspected. The updated Social home uses its dark navy/electric-blue hierarchy, a layered collectible-card hero, compact composer, circular member pictures, suggested members, collection thumbnails and community/offer panels. Hero cards come from the signed-in member's authorised inventory. Counts, profiles and posts are real application projections. Mobile prioritises the composer/feed and keeps Play in the existing navigation. No official team logos, invented follower counts or mockup player data were introduced.

This is an adaptation using Docked's existing logo and jersey components, not a pixel-identical recreation. Local fixtures have fictional player names and unavailable teams, so the screenshots truthfully show fallback jerseys. No fixture data was copied to hosting.

Screenshots:

| View             | Before                                                    | After                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Social desktop   | [Before](qa/social-visual-preview/before-social-1440.png) | [After](qa/social-visual-preview/social-1440.png)                                                                                                                                            |
| Social mobile    | [Before](qa/social-visual-preview/before-social-412.png)  | [After](qa/social-visual-preview/social-412.png)                                                                                                                                             |
| Shared card post | —                                                         | [Desktop](qa/social-visual-preview/social-cards-1440.png), [mobile](qa/social-visual-preview/social-cards-412.png)                                                                           |
| Profile picture  | —                                                         | [Desktop](qa/social-visual-preview/profile-photo-desktop.png), [mobile](qa/social-visual-preview/profile-photo-mobile.png), [crop controls](qa/social-visual-preview/avatar-crop-mobile.png) |

The authenticated local preview is `http://127.0.0.1:3033/fantasy/social` in the opened Edge QA session. It is not remotely accessible. A separate browser needs its own local QA login; no real-member credentials are shared.

## Profile-image implementation

- Choose JPEG/PNG/WebP, preview a circular crop, zoom/reposition, submit for private review, select an approved photo, replace or remove it.
- Existing private database-backed media storage and staff MFA moderation are reused. Uploading does not approve a photo. Members must select their approved image after review.
- Server decodes and validates pixels, bounds input to 4 MB/16 megapixels, rejects animation/non-raster data, strips metadata and stores a cropped 256px WebP. Crop coordinates are validated independently of the client.
- Explicit avatar mutation accepts only an owned, approved image. It is audited and cannot alter another profile. General profile edits preserve the current image.
- Authenticated image retrieval retains privacy, blocking and no-store rules. Shared avatars now appear in profiles, discovery, follow lists, composer, posts and comments. Failed images fall back to initials, including failures before hydration; failed post photos show an unavailable message.
- Local crop preview works under the existing CSP without widening allowed image origins. No new migration, public bucket, external image host or service was added.

## Verification and limitations

Evidence is in `docs/qa/social-visual-preview`:

- **376/376 platform tests passed**, including fantasy gameplay, rarity/pack probabilities, market/wallet behaviour and three new avatar codec/crop tests (`platform.txt`).
- **158/158 database tests passed in one uninterrupted run** (`database.txt`). These embedded tests do not claim independent PostgreSQL connection races.
- **13 integrated local HTTP/browser check groups passed** (`authenticated.json`): real GoTrue owner MFA and restricted-role PostgreSQL; ordinary-member authorisation, discussions, comments, community closure, denied unadmitted access; avatar quarantine, approval, privacy and cross-account selection denial; posting/retry recovery; five surfaces at 1440×960, 412×815 and 815×412. No serious/critical Axe A/AA findings on the five desktop surfaces.
- Fresh independent sign-in retained the avatar. Anonymous and disguised SVG uploads were denied without changing it (`photo-followup.json`).
- **5/5 separate reveal browser tests passed**: nine-card replay/resume at 360/412/1366px, reduced motion, duplicate taps and delayed compositor handoff (`reveal-browser.txt`). These use synthetic fixtures, not hosted purchases.
- Typecheck, lint, clean-environment build and client-canary boundary checks passed. Final home captures additionally exercise empty/draft/cancel states (`final-home.json`).

Retries are not hidden: the first image fixture used identical animation frames, which the codec collapsed; it was corrected to two distinct frames. Two crop browser attempts exposed a CSP-blocked blob preview and were fixed by the bounded data-URL preview. Later runs required scrolling a lazy-loaded avatar into view and allowing normal cold-server response time rather than a five-second assertion window. A standalone follow-up helper initially used unsupported top-level await, then was wrapped in an async entry point. The recapture correctly refused a duplicate QA post; it now reuses the existing post. Final successful results above were run after those corrections.

Physical Samsung S24, native WebView acceptance and genuine future-round observation remain pending. This pass did not perform hosted gameplay/social transactions.

## Security and Preview release status

Fresh read-only checks verified:

- Vercel project `docked-preview`, `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, team `team_tf6xweKKyVCj9bTppUKttJ4l`; deployment protection enabled. Anonymous `/fantasy/social` redirects to Vercel authentication.
- Isolated Supabase `bckkllmndoxzpzdqrevb`, certificate-verified connection, distinct from Production `pojoymtniryarxxunyvz`.
- Preview has only **19 applied migrations**, ending `20261007204317_fantasy_cards_preview_v1`; **41 current migrations are missing**, not merely the two new Social migrations. Its beta namespaces and credit sandbox do not exist. Full ordered gap is in `preview-schema.json`.
- Auth signup/anonymous access remain disabled. However, Auth still has a **localhost site URL and a database email-capture hook**, with no configured SMTP delivery. This is a QA capture setup, not a tester invitation channel.
- Existing verified invitation records identify all three testers. Preview contains the owner's confirmed account, but **Barry and Luke have no Preview Auth accounts**. No invitation was sent and no account copied from Production.
- The current admitted-beta runtime manifest is pinned to the Production project/database. It cannot be reused for this isolated Preview by substituting credentials or weakening the guard.

Therefore no app deployment or hosted migration was attempted. The old protected URL, `https://docked-preview-s24-briant-ginty.vercel.app`, is **not a URL for this completed revision**.

Required release work: establish and test an exact-target least-privilege isolated runtime; review/backup the full 41-migration dependency chain and apply it in order; configure a reviewed Preview invitation/callback delivery path; admit the three verified testers through the existing policy; then verify the protected deployment with authorised QA accounts. Existing deployment approval is recorded in the conversation; these are unsatisfied security/operational prerequisites, not a request to approve routine development again. No new paid service is required by this implementation.

The raw secret scan remains **FAIL with nine matches**: eight unchanged synthetic/runtime-generated matches and the old untracked signed APK capability. No new finding paths or scanner exclusions were added. The obsolete v20 capability was revoked by relocating only its private delivery object; the original path is absent and the APK remains private. The capability was not used, published or committed. This narrow authorised delivery-artifact operation did not change Production application/member data. See `secret-review.json` and `apk-capability-revocation.json`.

## Android and activation

The checked Preview package identity is `au.com.docked.app.preview`, targeting the isolated Preview origin above. Its deployment manifest was last verified 7 October and correctly fails the freshness gate. **No new APK was built or distributed**, and no stale approval or protection-bypass token was embedded. A verified new protected deployment/session flow is required before creating a signed Preview APK and checking its backend/allowlist/signature. Existing v22 points at Production and is not represented as this Preview build.

Real-money payments, cash redemption, identity-document collection and hosted private-offer settlement remain disabled. No real member inventory, balances, teams or history were used for QA. No messages or invitations were sent.

## Changed components

`social-home`, new `social-showcase`, `social-hub.css`: hero and compact data-backed panels. `member-avatar`, `avatar-editor`, `social-photo`: reusable pictures, crop workflow and fallbacks. Profile, discovery, composer and interactions consume them. `avatar-crop`, community codec/action/API enforce server validation and privacy. Local acceptance, image tests, Preview audits and capability-revocation helpers retain review evidence. No fantasy scoring, pack configuration, economy or migration files changed.
