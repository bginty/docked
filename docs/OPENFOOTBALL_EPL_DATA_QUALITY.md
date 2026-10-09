> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# EPL training-data review — Phase 5D

Reviewed 4 October 2026. Scope: the two Phase 5C approved resources at OpenFootball revision `e6744429ee395bc86f247348c6184bb08d4eb361`, unchanged local hashes. See [machine-readable study](qa/phase5d/data-study.json) for every exclusion, resource URL, observation clock, hash and team mapping.

| Season | Fixtures | Teams | Explicit FT results accepted for research | Unlabelled scores excluded | No score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2025/26 | 380 | 20 | 353 | 27 | 0 |
| 2026/27 | 380 | 20 | 45 | 5 | 330 |

The parser rejects unknown fields, invalid dates/times, non-integer or negative goals, identical teams, duplicate directed pairings and half-time scores exceeding full-time scores. The study checks season date bounds, future reported scores, exactly 380 distinct pairings and 38 appearances per team. No such failures were detected. All 23 names across the seasons have explicit aliases; no fuzzy identity repair occurs. Coventry, Hull and Ipswich have no prior-season EPL observations in this scope. Eight accepted matches per team are required for a prediction; shrinkage alone does not override that requirement.

**Research acceptance:** the 398 explicitly FT-labelled records are suitable for an initial source-reported, goals-only research fit. This is an engineering assessment of a limited baseline dataset, not verification against an official competition feed. We retain the actual scheduled date and dataset observation timestamp. Original publication times, UTC kickoff times, postponement/abandonment flags, finality certification and correction lineage are not supplied. We do not invent them. A same-day score cannot establish completed-match availability and is excluded by the training contract. No historical as-of probability claim is possible from this snapshot.

**Settlement remains unavailable:** these records are not promoted to authoritative regulation settlement. An authorised source with the exact market's final-score semantics and corrections is still required for prospective outcomes. Dataset completeness does not establish operational fixture freshness. Upcoming canonical fixtures must separately retain their existing source and UTC kickoff provenance.

The exact [pinned CC0 licence](https://raw.githubusercontent.com/openfootball/football.json/e6744429ee395bc86f247348c6184bb08d4eb361/LICENSE.md) permits reuse, adaptation and commercial use to the extent of the contributor's rights. It provides no accuracy or trademark guarantee. The existing source registry retains this narrow research approval and its review deadline; no additional dataset is authorised by this study. No paid service, external email, publication or scheduler is enabled.

No historical Docked tips, betting record or retrospective ROI are created. The source data informs a new prospective research model only.
