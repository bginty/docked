> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Future competitions and prizes — disabled

`COMPETITIONS_ENABLED=false` and `PRIZES_ENABLED=false`; configuration refuses activation. No competition is open, no entry is accepted, no winner is declared and no prize has been purchased or awarded.

The scaffold stores competition identity/description, jurisdiction, minimum adult age, Free/future-Pro eligibility, start/end/entry cutoff, sports/markets, ranking-rule version, minimum non-void settled sample and active days, prize/value/currency, sponsor, official-rules version, entry limits, exclusions and mechanics. Rules/configuration hashes are frozen at draft creation and append-only; revisions require a new draft. Draft creation and every sensitive record include actor, server timestamp and reason.

Only standard verified performance or non-wager prediction mechanics are accepted. Wager amounts, deposits, losses recovered, gambling volume and follower counts are not valid mechanics. Competition eligibility does not become a way to include promotional or unverified odds. Minimum performance sample is at least 20 settled Edges and 7 active UTC days; this safeguard is not proof of skill.

The proposed competition tie order is frozen explicitly as net units, ROI, settled count, then earliest qualifying record. This is a separate competition rule, not a silent amendment to the Top Docked rule. A future competition must identify the exact ranking version and cutoff in its official rules, and test its candidate export from canonical eligible Edge/settlement IDs. Corrections retain previous exports and trigger a fresh review; they never overwrite a winner.

Prepared tables cover immutable rule versions, qualifications, ranking exports, prizes and award events. The award state machine permits CALCULATED → INTEGRITY_REVIEW → ELIGIBILITY_REVIEW → APPROVED → AWARDED, or a documented DISQUALIFIED outcome before awarding. Skipped steps and substitutions after an award are rejected. In this release database triggers prohibit inserting qualifications, competition rankings or award events at all; the future workflow is implemented as a tested transition model, not an active prize service.

Before any separately authorised activation, record jurisdiction-specific legal review, official rules, permit/tax/prize treatment, privacy, marketing, sponsor terms and responsible-design review, each with evidence, reviewer, effective dates and a review deadline. Unknown or expired approval fails closed. No legal conclusion about a particular competition is supplied by this scaffold. Free versus future Pro access must be separately assessed; payment never grants Top Docked rank or verification advantages.

Admin drafts are accessible through `/api/admin/benefits` with MFA and owner/admin role. Read-only auditors can inspect the disabled architecture. Public `/competitions` states the actual unavailable status. No notification, sponsor link or public performance claim is created by drafting.
