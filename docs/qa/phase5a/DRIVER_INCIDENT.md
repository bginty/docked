# Preserved first-request failure

On 4 October 2026 (Sydney), the first manual Phase 5A request was a documented zero-credit sports catalogue operation. The Preview endpoint returned HTTP 409. Its immutable ledger row retains `FAILED`, reservation **0**, and **unknown** reported charge/remaining balance. No canonical sporting records were imported by that attempt. No automatic retry occurred.

The failure exposed two integration defects that the earlier in-memory database checks did not cover:

- The pinned `postgres` 3.4.9 client exposes `begin()` on its pool but not on a reserved connection. The trial quota recorder and existing current/legacy importers called the missing method. A read-only check against Docked Preview reproduced `rootBegin=function`, `reservedBegin=undefined`.
- Passing an already stringified object into an inferred JSONB parameter through `unsafe()` made the driver serialize it again. The original completion diagnostics are therefore the JSON string `"{}"`, rather than an object. The same read-only check demonstrated the difference between encoded-string and native-object parameters.

[Read-only evidence](driver-diagnostic.json) records no provider requests or database mutations. The original failed request does not contain response headers or a stage diagnostic, so its measured provider charge remains unknown. The documented free endpoint and zero reservation are not substituted for a missing usage observation.

The repair uses explicit `BEGIN` / `COMMIT` / `ROLLBACK` on the existing reserved lease, including one-connection pools; completion supplies a typed JSON object. A pinned-driver regression exercises actual PostgreSQL wire serialization against an isolated in-memory database, commits, rollback, nested-use refusal and lease reuse. New failure diagnostics use fixed stage, HTTP status and SQL-state fields without raw URLs, messages, payloads or credentials.

Migration `20261003232606_phase5a_reviewed_driver_recovery.sql` preserves migration 14 and all original evidence. One append-only review may acknowledge only the first legacy failed free catalogue request with its exact failure signature, with current administrator MFA, repair commit and evidence hash. It does not change the request, charges, cumulative budget, attempt count or circuit deadline. Paid requests still require a fresh known quota observation. Other failures and all over-budget reported charges remain blocking. A deleted, disabled, banned or demoted permit issuer cannot execute an unused permit.

The private preimage and [hash receipt](driver-repair-preimage.json) precede migration 15. Hosted repair/deployment and any subsequent request outcomes are recorded separately in the operator receipts and final trial report. This incident must not be represented as an entirely successful first trial or omitted from total-attempt reporting.
