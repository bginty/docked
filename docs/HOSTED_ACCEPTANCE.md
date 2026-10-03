# Phase 4 hosted acceptance — 3 October 2026

Target: **Docked Preview** `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, Sydney, Free plan. The frontend runs only at `http://localhost:3000`; this is a hosted backend acceptance run, not a public frontend deployment. Production, DNS and Oura remain untouched.

## Capture and quota closure

The owner explicitly approved 30 capture-only Auth events/hour for this target. Original quota **2/hour** was recorded at 03:02:25 UTC. The temporary **30/hour** setting was recorded at 03:02:58 UTC. It returned to **2/hour** at 03:12:46 UTC and was independently verified at 03:12:49 UTC. Other rate limits were preserved. Sanitized before/temporary/restored/independent receipts are in [Phase 4 evidence](qa/phase4/).

Only reserved `example.invalid` identities were used. Supabase's SQL Send Email hook captured signup/verification and recovery capabilities; no SMTP credentials or external delivery were used. Capture closed at 03:13:19 UTC, its proof was cleared, and ten signup captures plus one recovery capture were purged. This count is of messages, not ten new people. No marketing messages were sent. The hook remains installed and rejects requests while capture is closed, preventing SMTP fallback.

Closed configuration deliberately uses global signup disabled **and email provider enabled**. Disabling the email provider also denies existing password login. SMS and anonymous signup are disabled, email confirmation remains required. An initial broad config edit briefly enabled the SMS signup setting; this was corrected immediately before account testing, no SMS provider was configured or used, and a subsequent hosted query found zero phone accounts. The current section-specific configuration and safe inspection fields prevent that edit pattern recurring.

## Genuine account evidence

Seven distinct reserved identities completed actual GoTrue signup, captured verification/PKCE callback and onboarding: two members, restricted-region member, analyst, editor, administrator and auditor. There are no synthetic Auth rows or forged acceptance sessions. Age/terms, jurisdiction, timezone, sport/odds preferences and separate unchecked marketing consent were exercised. [Signup receipt](qa/phase4/signup-results.json).

Member lifecycle checks passed password login, export, alert pause, real captured recovery, replacement-password login and one-click unsubscribe from a genuine capability prepared without dispatch. [Lifecycle receipt](qa/phase4/lifecycle-results.json). Email change is not implemented; the API must explicitly reject that unsupported action rather than send an email or claim success.

The REST runs used actual access/refresh tokens and publishable credentials. All 53 initial assertions passed before migration 7, including two active members' cross-user boundary; the final expanded run passed **69/69**, adding GET/POST/PATCH/DELETE denial for the four new private tables. The original active-pair receipt is preserved because member A was already disabled by the time of the final run. Checks cover anonymous denial, own-row/cross-user boundaries, protected writes/functions/payloads, untrusted role-metadata escalation and session revocation. Test credentials, MFA seeds and raw failure diagnostics are ignored local files, never evidence artifacts. Browser traces, videos and authenticated screenshots are disabled.

Social acceptance first ran incrementally across genuine attempts. Repeated profile edits reached the existing daily limit; the recorded continuation covered later security controls without resetting or relaxing that limit. A subsequent **complete lifecycle passed** using existing member B and editor accounts; the editor used ordinary password assurance without MFA elevation. It exercised posting, comments, reactions, saves, follow/unfollow, per-follow consent, notifications, private visibility, export isolation, block/mute, reports, privilege denials, image quarantine and restricted-region rejection. [Complete social receipt](qa/phase4/community-complete-results.json). The failed/interrupted attempts are not relabelled PASS.

Actual deletion revoked member A's second active session. After the remaining native attempt ended without entering credentials, the temporary social-only QA region policy was revoked and member B immediately lost community access while retaining account export. All eight reserved identities, including the capture canary, were then erased through the existing account-erasure service. Final inspection found zero Auth users/sessions, member profiles or identifiable social profiles; pseudonymous erasure audits remain. See [policy revocation](qa/phase4/revocation-results.json), [eight-account erasure](qa/phase4/account-erasure-results.json), [final database state](qa/phase4/final-hosted-state.json) and [final closed Auth configuration](qa/phase4/auth-final-closed.json). No provider keys or real user accounts were needed for these checks.

## Material findings corrected

| Finding                                                                                              | Correction / verification                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local clock ahead of database caused valid capture to be treated as missing                          | Capture checkpoints and comparisons now use the database clock; actual verification/recovery passed.                                                                           |
| Closed Auth config disabled password login                                                           | Keep email provider enabled while global signup and capture are closed; explicit regression covers this distinction.                                                           |
| Optimized image upload crashed because a dynamic package resolver became a numeric module identifier | Statically import pinned Sharp; actual codec tests cover resize, metadata removal, malformed formats, byte and pixel limits. Hosted quarantine/review verifies the built path. |
| New reference evidence could omit cohort members or invent a probability without source evidence     | Database independently reconstructs cohorts and validates canonical configuration, rules and source hashes; regression tests reject these writes.                              |
| Lock delays and SQL NULL comparisons could bypass freshness or supported-rule checks                 | Freshness is evaluated after locks; missing required scalars fail closed.                                                                                                      |
| A recovered market price contradicted the no-reactivation rule                                       | Record the movement as SUSPENDED; the original benchmark remains unique and immutable.                                                                                         |
| Optional personal price notes could remain visible for a suspended author                            | Mutable notes follow current social visibility; immutable benchmark history remains intact.                                                                                    |
| New observation collector briefly allowed a five-minute lateness window                              | Preserve the existing 60-second target tolerance; unavailable samples remain missing.                                                                                          |

## Database changes and recovery

The single additive seventh migration was reviewed independently, tested on fresh PostgreSQL, dry-run, hash-matched against the private application preimage and applied with certificate/hostname verification. All 83 application tables have RLS. Old bookmaker records retain their original version. No official publication, market reference or community Edge was present after migration.

The ignored preimage contains application rows and function/constraint/trigger/policy definitions; its [public hash receipt](qa/phase4/migration-preimage.json) contains no account data. It excludes Auth-managed records and storage and is **not a certified full disaster-recovery backup**. A transactional migration failure rolls back. After success, prefer a reviewed forward repair; never delete ledger evidence or edit migration history to imitate rollback. A restore rehearsal remains a prerequisite before accepting real user or licensed sporting data.

## Final execution receipts

Completion receipts, final advisors, fixture rollback counts, account teardown and native limitations are recorded in [Phase 4 QA](qa/phase4/README.md). Deterministic sporting fixtures test software integrity only and are always rolled back. They are not genuine research, performance, strategy validation or forward-paper evidence.
