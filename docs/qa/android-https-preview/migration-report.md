# Docked Preview migration verification

Verified 3 October 2026 against **Docked Preview**, project `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, region `ap-southeast-2`, PostgreSQL 17.11.0.002. The project was independently confirmed `ACTIVE_HEALTHY`. No unrelated project was read or changed.

Applied through the linked Supabase CLI, each after an exact single-file dry run and protected preimage:

1. `20261003061548_hosted_preview_tester_community.sql`: constrained policy marker, private exact-UUID tester grants, scoped app/database checks. No policy, grant, account or content inserted.
2. `20261003062615_session_wall_clock_revalidation.sql`: fixes inherited transaction-start session-expiry behavior. The existing own-session helper now re-evaluates wall-clock time, including calls after policy/grant lock waits. Its single narrow SECURITY DEFINER and existing browser privileges are preserved; PUBLIC/anon execute remains denied.

The second migration was created separately after the first had already applied. No applied migration was rewritten. Dry runs and applies explicitly skipped Vault updates and did not include seeds or roles.

## Recovery evidence

Private preimages are in ignored `private-data/hosted-preview/android-preview-before-migration.json` and `android-session-before-migration.json`. Tracked hash receipts are `migration-preimage.json` and `session-migration-preimage.json`. Each read-only repeatable-read snapshot contains application rows and function, column, constraint, trigger, policy, index and grant definitions plus local migration hashes. They exclude managed Auth rows/storage and are **not a full disaster-recovery backup or restore certification**. Prefer reviewed forward repair; do not run a destructive down migration against ledger history.

## Verified results

- Nine hosted migrations, latest version `20261003062615`.
- 84 public/private application tables have RLS; zero unprotected tables.
- Anonymous/member read or insert on the new tester table and direct execution of the tester helper are denied.
- Exactly one private SECURITY DEFINER remains. The session helper is volatile, contains `clock_timestamp()`, denies anonymous execution and returns false without a valid identity.
- Auth users, Auth sessions, member profiles, tester grants, approved policies, enabled flags, official publications, community Edges and MarketReference records all remained **zero** immediately after both applications.
- The full local PostgreSQL/PGlite suite passed **81/81**, zero failures/skips/cancellations, in 40.161 seconds. The new elapsed-time regression keeps a transaction open across session expiry and proves the previous `now()` comparison would allow it while the hardened helper and actual application access query reject it.

Security advisor returned only 80 informational [RLS-enabled/no-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for the intentionally private default-deny tables. Do not add permissive browser policies to silence them. Performance advisor reported 54 informational [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and 13 [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index); there is no traffic evidence here to certify workload tuning. Sanitized summaries are in `migration-advisors.json`.

## Separate operator provisioning

After review and explicit execution approval, `scripts/hosted-preview/provision-android-testers.ts` completed its read-only plan and both provisioning modes through Node with `--conditions=react-server --env-file=.env.local --import tsx`. Explicit `--provision-durable` or `--provision-acceptance` also requires `--confirm-project=bckkllmndoxzpzdqrevb`. Do not rerun completed modes: existing private output/roster intentionally blocks retries.

The helper uses the real Admin Auth API with reserved `example.invalid` identities and sends no email. Operator confirmation is labelled as such and is not evidence of email ownership verification. The durable tester retains blank jurisdiction, no age attestation, no terms acceptance and incomplete onboarding. Two disposable acceptance profiles have clearly labelled QA-only synthetic attestation records and completed onboarding. Neither mode grants a staff role or optional marketing/analytics consent. All three receive only seven-day UUID-scoped preview social/profile grants. Passwords are random and written only to ignored private output; a partial-creation journal prevents blind retries after an uncertain result. The safe count/expiry receipt is `tester-provisioning.json`. Genuine hosted/device acceptance remains distinct from provisioning and migration checks.

Post-provisioning Auth inspection confirmed signup disabled, anonymous and phone signups disabled, no custom SMTP and the unchanged email quota of 2/hour. The earlier SQL email hook remains installed/enabled as a deny-all sink boundary, while its private capture configuration is disabled and captured-mail count is zero. No capture recipient/configuration was reopened. Its legacy loopback Auth site URL is unchanged; this work did not authorize email callback flows from the new host.

## Final post-acceptance state

The aggregate cleanup receipt `qa-cleanup.json` was verified at **2026-10-03 07:38:35 UTC**, with additional read-only residue checks afterwards. QA B was deleted through the application; after explicit browser/native release the existing account-erasure service removed QA A. Their preview-only policy was withdrawn and private QA password copies redacted. The durable tester's profile, consent, preferences, grant and credential-file fingerprints were unchanged.

- Nine migrations remain, latest `20261003062615`; all 84 application tables have RLS, with no unprotected table or browser tester-table grant.
- One durable Auth user/profile/grant remains; zero sessions, staff roles, ordinary approved region policies or enabled feature flags. Its only approved policy is the exact-UUID social/profile preview marker.
- Zero sporting events, odds snapshots, MarketReferences, official publications or community Edges; zero sent outbox items, delivery attempts, enabled capture configurations or captured mail.
- Zero remaining QA identities, sessions/refresh tokens, active grants, personal commentary/media, notifications or behavioral analytics. Pseudonymous tombstones and three append-only consent audit rows remain according to the existing retention policy, without an Auth/profile identity mapping.

The initial three-account provisioning receipt is historical evidence, not the final account count. No account, policy or data was added during cleanup.
