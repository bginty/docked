> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Community privacy and retention — review draft

Prepared 3 October 2026. This describes implemented behavior and decisions requiring legal approval; it is not a legal conclusion or an activated production privacy policy.

Profiles expose only a durable social ID, handle, display name, short bio, approved avatar, permitted relationship counts, status and member-visible timestamps. No public Auth UUID, email, precise location, age/date of birth, provider payload, private saved list, block/mute list, notification preference or report identity appears in discovery. Profiles are either visible to eligible signed-in members or private to their owner. There is no anonymous profile index in this preview.

Saved posts, blocks, mutes, reports, notification settings and inbox rows are private. Member export includes the member's social profile, posts/comments and immutable Edge references, follows, blocks, mutes, saves, notification settings/inbox and media metadata. Media bytes and another member's private settings are excluded. Existing account export and behavioral-analytics consent controls remain in place.

## Implemented erasure

The existing account-disable/delete transaction triggers social pseudonymization before Auth revocation completes. It clears the user's handle history, bio, avatar, social text, stored media bytes and alt text; deletes private reactions/saves, follows/blocks/mutes, inbox entries involving the identity and notification settings; removes reporter identity and report narrative submitted by that member. The durable social ID becomes `Deleted member` with a non-personal reserved handle and no Auth link. Other members' content and settings are preserved. Existing session revocation and analytics deletion still run.

Canonical community Edge records, official records, verification, settlement, corrections and standardized performance remain append-only and reference the durable pseudonymous ID. Privacy or blocking cannot selectively hide losses from canonical history. Ledger readers redact author identity when necessary. Legal review must confirm the permitted basis, duration and safeguards for retaining these research/integrity records; this implementation does not assert indefinite retention is lawful.

## Retention controls

| Data | Implemented behavior | Approval needed |
| --- | --- | --- |
| Unapproved uploaded image bytes | Private quarantine; expires after 7 days; protected worker clears expired bytes | Production scanning/storage policy and capacity |
| Rejected media | Bytes erased immediately; bounded metadata retained | Metadata retention duration |
| Approved media | Retained until rejection/account erasure; private authenticated serving | Ordinary deletion/orphan cleanup schedule and rights process |
| In-app inbox | Expires after 90 days; worker deletes expired rows | Confirm lawful/operational duration |
| Completed fanout jobs | Worker deletes after 90 days | Operational audit duration |
| User social text | Tombstoned on deletion/moderation; no full text copied to audit | Any legal hold procedure |
| Reports/moderation audit | Private; originating member's reporter identity/narrative removed on erasure; immutable action history retained | Case retention, lawful holds, appeal access |
| Canonical Edge/performance evidence | Durable pseudonymous reference survives account erasure | Jurisdiction-specific lawful retention and erasure exceptions |

Administrative audit reasons and third-party reports may mention personal information. Staff must avoid unnecessary personal data. A scoped legal-review and redaction workflow is still needed for third-party narratives and lawful holds; account erasure does not falsely claim it has identified every occurrence of a person's name in other users' text.

Local tests verify pseudonymization, session revocation, personal-content purge, other-member preservation and surviving referenced ledger rows. Hosted Supabase backup retention, point-in-time recovery, provider erasure, data residency and advisor checks remain deployment-specific dependencies. No unrelated or production project was inspected or altered for this work.

## Phase 4 optional price claims

Personal bookmaker names, claimed promotional odds and promotional flags are stored in private `community_edge_personal_notes`, outside immutable Edge accounting. They are social commentary only, included in the owner's export and erased when the account is disabled or deleted. Canonical benchmark references and pseudonymous settlement history retain no copy of those optional claims. Their display follows social visibility/blocking rules; their absence never removes a loss or changes performance.
