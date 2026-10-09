> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Community architecture — Phase 3 preview

Prepared 3 October 2026. This is an isolated preview implementation, not evidence of hosted authentication, provider rights or a launched community. Existing canonical Docked pricing/publication and prospective strategy controls remain authoritative.

## Identity and authority

`private.social_profiles.id` is a durable pseudonymous identity. Its nullable `user_id` links the existing verified Supabase account. The fixed UUID `00000000-0000-4000-8000-000000000001` owns `@docked`; no member owns that identity. Official badges derive from this database identity, never a submitted name, handle, emoji or image. ASCII handles, Unicode normalization, common confusable mappings and mixed-script/badge restrictions protect official/support/admin names. These conservative checks are not a complete Unicode impersonation detector; reports and manual review remain necessary.

Every member write uses a verified remote Auth user, confirmed email, active session, enabled account, same-origin request and rate limit. Trusted transactions set claims from that verified session and call `private.community_actor`, which repeats session, current region, age, terms and social status checks. Existing 18+ attestation cannot satisfy a 21+ policy. Roles come from the private role table. Moderation writes require owner/admin/editor and MFA; auditor has read-only moderation access.

All social tables live in `private`, enable RLS and revoke direct browser/anonymous/member grants. New functions are security invokers with empty search paths and revoked public execution; they do not add privileged browser-callable RPCs. The server owns parameterized queries and explicit safe projections. Secret keys, provider payloads, notification settings, report identities and Auth IDs are absent from feed/profile/search responses.

## Records and read models

The social schema stores profiles and handle reservations; follows, bilateral blocks and mutes; discussion/analysis/question/celebration posts; bounded replies; reactions; private saves; private media; reports and immutable moderation events; in-app preferences, inbox rows and durable fanout jobs. Counts reflect stored records and are not seeded with activity.

An Edge post references exactly one canonical official tip or community Edge. A database trigger projects a live official publication exactly once. Community confirmation inserts its projection in the same transaction as its permanent ledger record. Social input cannot submit a verified flag, author override, stake, odds or settlement. A screenshot is commentary and never verification.

Social removal clears commentary/media links and leaves a tombstone. The canonical Edge ledger, corrections and performance denominators survive moderation, privacy changes, blocks and account erasure. Canonical ledger readers independently control identity disclosure; social visibility must never be reused to exclude losing ledger records.

Server contracts are in `src/server/community-social.ts`; types and strict action schemas are in `src/core/community-social.ts`. Read results distinguish ready, unconfigured, unauthenticated, restricted and unavailable states. No unavailable state simulates successful activity. `communityFeed`, `communityPost`, `communityProfile`, `communitySearch`, `communityNotifications`, `ownCommunityMedia` and `communityModeration` serve explicit projections. Member-only media uses an authenticated no-store route. `community-discovery.ts` supplies relationship pagination and Most Followed.

## Feed and discovery rules

Community Edge detail pages provide an authenticated, no-store PNG download containing the permitted handle (or pseudonym), event/selection, verified standard odds, one-unit benchmark, outcome, submission/status times and COMMUNITY branding. The request reads canonical data and rechecks regional/account access; anonymous crawlers receive no record-specific metadata or card. Downloading does not send a message or publish anything externally. All new profile, discussion and Edge surfaces are noindex until a separately approved public privacy/quality policy exists.

- Latest is reverse chronological `(created_at,id)` with a strict keyset cursor, 20 records per page.
- Following uses the same order and includes followed accounts plus the official account.
- For You uses the same order over followed accounts, selected sports, the member's own posts and the official account. With no follows or sport preferences it falls back to Latest.
- All feeds apply current typed feature gates, profile visibility, bilateral blocks, moderation and mutes. A profile/detail request may deliberately show a muted account; blocking still denies it.
- Most Followed orders visible members by actual recorded followers and a deterministic ID tie-break, separately from performance rankings. Relationship lists show only visible profiles.

No rule uses losses, wagering amounts, chasing or compulsive signals. Social discovery never changes ledger results or leaderboard formulas. Twenty posts currently project at most 100 earliest visible comments in one batch; comment counts may exceed the inline excerpt. Deep comment pagination is a future scaling improvement, not a claim that all replies were displayed.

## Preview media and scale

Authenticated, eligible uploads are rate limited before bytes are parsed or decoded. Actual streamed body limits are enforced independently of Content-Length. Only static JPEG/PNG/WebP up to 5 MiB and 16 million decoded pixels are accepted. Sharp normalizes orientation, strips metadata and encodes bounded WebP. SVG, animations, scripts and arbitrary external URLs are rejected. Images remain private quarantine until staff approval and must belong to the attaching author. The preview uses bounded private database bytea storage; a production storage rollout needs a reviewed private bucket, signed serving, malware scanning, lifecycle rules and capacity tests. None has been falsely activated here.

Durable fanout jobs are committed with posts and processed in bounded SKIP LOCKED worker batches. No request enumerates an unbounded follower list. See NOTIFICATIONS.md and PRIVACY_RETENTION.md.

## Validation and release dependencies

Additive migration order is membership/rewards → social core → community Edge ledger. Local PGlite executes the complete ordered PostgreSQL schema and permission probes. Tests cover direct access denial, identity spoofing, current policy/session denial, bilateral blocks/private profiles, media ownership/approval, reply boundaries, queue atomicity, pseudonymization and ledger-reference survival. API tests reject anonymous upload/notification requests before body access. These checks do not claim a real hosted Supabase signup, browser Auth lifecycle, Storage policy or hosted advisor run.

Before hosted preview: verify the dedicated Docked project identity, apply ordered migrations through the documented preview procedure, perform real Auth/role/RLS/browser QA, review policies/advisors, configure moderation staffing and legal retention, then enable only explicitly approved features. No unrelated Supabase project, production DNS or live deployment was touched.
