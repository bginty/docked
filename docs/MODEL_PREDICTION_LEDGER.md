# Prospective model prediction ledger

## Phase 5D first retained cohort

Model football-goals-v1.0.0 / code 9d2a40cde05b198cd8c0462965265d9de581d7f8 has six prospective attempts: five READY and one ABSTAIN (insufficient team sample). The first prediction is d68803aa-8c29-4938-9885-7ea33b99ed1e, recorded 2026-10-04T05:22:22.308Z for an upcoming mapped fixture, before any market comparison. Values are private research evidence, not official recommendations. No outcomes have been appended.

Training manifest a0db4666-143f-43fb-bb26-371538658d59 preserves the 398 accepted source-reported FT rows, source/mapping/config/code hashes and fitted state. Model-fit permission does not include settlement authority.

Phase 5B separates model evaluation from selection performance. Record every eligible model evaluation before kickoff, including abstention and missing input state; candidate qualification is not the inclusion criterion. The database attempt statuses are READY, ABSTAIN and NOT_CONFIGURED. Execution exceptions remain in the durable scanner/job audit rather than being fabricated as model rows. The pure calibration contract supports FAILED inputs for a future explicit failure projection; the current model dashboard must not be interpreted as a complete execution-failure rate.

Every ready record binds canonical event/teams/start/rules, model version and code commit, input snapshot/hash, configuration hash, as-of and calculation times, data cutoff, complete home/draw/away probabilities, fair odds and quality state. Database record time is authoritative. A unique event/model/decision-window identity prevents retry duplication; a refresh does not rewrite an earlier prediction.

Persist the prediction in its own committed transaction before reading Market Reference. A later provider failure or below-threshold comparison therefore leaves the prediction available for complete calibration. Missing sporting inputs produce a retained abstention, not a made-up probability or a zero-valued estimate. No member/public API accepts official probability inputs.

Outcome records append separately with authorised result identity, observed/received timestamps and correction provenance. Pending, void, disputed and corrected results remain explicit. Correcting a result never changes the original probability; calibration uses the latest eligible correction while retaining earlier revisions. An odds disappearance is not a result.

Private tables use RLS plus revoked browser grants. Worker authority is checked against the actual leased job; staff changes require current role/MFA/session checks. No predictive model, data source, approval or prediction is seeded by migration. Unknown deployment/database state fails closed.

This ledger cannot set the official record start. Only a genuine approved live Edge does that. See [calibration](FORWARD_CALIBRATION.md) and [official record](OFFICIAL_RECORD.md).
