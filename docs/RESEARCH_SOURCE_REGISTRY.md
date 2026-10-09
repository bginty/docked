> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Research source registry

`private.research_source_versions` is append-only. A new source version points to the immediately prior review, has a canonical configuration hash, and records the current owner/admin MFA actor and reason. No source is registered by the migration.

Rights states are `APPROVED_AUTOMATED`, `APPROVED_MANUAL_ONLY`, `PERMISSION_REQUIRED`, `REVIEW_REQUIRED` and `PROHIBITED`. Public display, commercial use, storage, derivation, model use and automation are independent permissions. A successful HTTP request, provider plan, source reliability tier or staff login cannot infer a missing permission.

The exact latest review controls current use. Review/effective expiry, revocation and a replacement review withdraw older source evidence from current publication. Re-recording or an explicitly governed correction is required under a new approved version. Historical snapshots retain evidence identities/hashes and use currently permitted retained payloads; expired licensed values are not copied into an indefinite snapshot.

The source catalogue describes CC0 OpenFootball EPL JSON snapshots at a reviewed commit. It is not an executable activation list. Runtime registration is audited separately, and schedules plus the environment/database automation switches remain disabled until independently enabled through authorized operations.

Source health reports measured request attempts, unfinished reservations, last HTTP success/failure and safe failure codes. Null clocks/statuses mean unobserved. Only free pinned requests are supported by the current adapter; there is no measured billable-credit balance or monetary monthly-cost projection. Request counts must not be relabelled credits or costs.
