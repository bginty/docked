> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# News research — Phase 5C

This architecture stores reviewed structured sporting assertions, not article bodies. CONFIRMED, REPORTED, RUMOUR and MODEL_DERIVED are distinct evidence classes. Reliability tiers describe reviewed provenance, not a fabricated numerical confidence score or a licence to reuse a publisher's work.

Source reviews explicitly separate public display, commercial use, storage/retention, derived/model use, automation, robots and request etiquette. Unknown, expired, permission-required and prohibited sources cannot be fetched automatically. Manual approval authorises only the reviewed manual use. A source URL or official logo is not permission. Reviewed URLs reject userinfo, query parameters, non-HTTPS and obvious local/IP hosts; the separate network adapter must still enforce its fixed endpoint, DNS/SSRF protection, rate/quota budget and current authority before each request.

News may support only one of the declared structured fact types with mapped entities and provenance. Raw prose, LLM conclusions, sentiment and predicted probabilities cannot enter the independent model input contract. A possible future LLM extractor would produce untrusted candidate facts requiring validation and authorised review; no LLM provider or extractor is configured here.

`researchContentDraft` creates DOCKED_RESEARCH, MATCH_UPDATE or LINEUP_UPDATE drafts from public-permitted, current, non-conflicting, non-rumour facts. Drafts retain their snapshot hash, fact IDs, as-of time, source attribution and DISPLAY_CONTEXT_ONLY label. It returns null when there is no suitable evidence. A draft is not a DOCKED_EDGE and cannot imply model confidence, a betting recommendation or guaranteed profit. Publication must use reviewed CMS authority and the current source display check; repeated changes do not automatically publish or notify.

Source fact payload retention, chronological corrections, current authority and missingness remain visible to staff. Post-match facts are separate from immutable pre-match snapshots. Historical knowledge cannot be backfilled into a prior decision by changing effective dates or treating a later download as earlier knowledge.
