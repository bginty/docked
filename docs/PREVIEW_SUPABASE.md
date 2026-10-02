# Docked preview database and account lifecycle

Reviewed 2 October 2026. **No hosted Docked Supabase project is configured.** The configured connector's read-only project inventory returned only an unrelated Oura CRM UAT project. No keys, tables, migrations, advisors or data were accessed in that project. No remote writes were made. Only `.env.example` exists in Docked; no relevant process credential names were present. Docker was not installed/available on this host, so the local Supabase services and real GoTrue lifecycle could not be started.

The Phase 2 PostgreSQL tests apply both ordered migrations to a fresh embedded PostgreSQL database with a deliberately minimal Auth-schema test harness. These prove SQL/RLS invariants and migration order; they **do not prove hosted Auth, mail delivery, session refresh or a complete authenticated browser lifecycle**. The fixture accounts and paper selections exist only in an isolated test process, never in the application database or public results.

## Safe local setup

The CLI-generated `supabase/config.toml` is specific to `docked-preview-local`, uses PostgreSQL 17 and a local SMTP sink, requires email confirmation, disables anonymous sign-in, enables TOTP, uses 15-minute access tokens and requires 12-character passwords. It exposes only `public` and `graphql_public`, never `private`. Automatic grants for newly exposed tables are disabled; migrations grant only the reviewed member reads. No external SMTP credentials are configured. Signup/recovery handlers reject a non-loopback Auth URL in preview even if keys are supplied.

1. Install and run an approved local Docker-compatible runtime. Do not connect a shared or production database.
2. From this repository inspect `npx supabase start --help`, then run `npx supabase start`. This applies the ordered migrations on first startup. Read `npx supabase status` privately; do not paste secret keys into chat or commit them.
3. Copy `.env.example` to the ignored `.env.local` and supply only this local stack's URL, publishable key, secret key and database URL. Use `SITE_URL=http://localhost:3000`, `APP_ENV=preview`, `SUPABASE_ENV=preview`. Keep all odds, paper, public publication, sending and monetisation switches false.
4. For synthetic local account QA only, set `REGISTRATION_ENABLED=true` and enable `private.feature_flags.registration` in this local database. This permits test accounts; it is not a jurisdiction or live-publication approval.
5. Start the app on localhost:3000 and open the local SMTP inbox at localhost:54324. Use unique `@example.invalid` test addresses. Inspect every confirmation/recovery message in that sink; no external SMTP server should be configured.
6. Inspect `npx supabase migration list --help`, `npx supabase db advisors --help` and use their **local** targeting options for this stack. Save the real advisor output before release. Do not use an implicit linked remote target.

## Dedicated hosted preview creation

The owner must select the intended organisation and approve any provider charges before creating a new project named `Docked Preview`. Use standard PostgreSQL 17, not an experimental storage engine. Record project name/ref, organisation, region and purpose in the deployment record. Verify those identifiers again through project metadata and the database before linking or migrating. A familiar region or an available credential is not project identity.

Create a project-specific read/write deployment identity and secrets scope. Never reuse Oura credentials. For hosted preview, supply:

| Variable                                                          | Required value / handling                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV` / `SUPABASE_ENV`                                        | `preview` / `preview`                                                                                                                                                                                   |
| `SITE_URL`                                                        | Exact HTTPS preview application origin                                                                                                                                                                  |
| `NEXT_PUBLIC_SUPABASE_URL`                                        | Verified Docked Preview project URL                                                                                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                            | That project's browser-safe publishable key                                                                                                                                                             |
| `SUPABASE_SECRET_KEY`                                             | That project's server-only secret; needed for identity erasure                                                                                                                                          |
| `DATABASE_URL`                                                    | Direct or session-pooler connection to the same project; server-only. Polling uses a session advisory lock and must not use a transaction pooler. TLS is enforced for every remote database connection. |
| `REGISTRATION_ENABLED`                                            | `false` until an isolated Auth mail-sink path is verified                                                                                                                                               |
| `PUBLICATION_ENABLED`, `FORWARD_PAPER_ENABLED`, `SENDING_ENABLED` | All `false`                                                                                                                                                                                             |

Configure exact callback/recovery allowlist URLs, mandatory email confirmation, anonymous accounts off, strong passwords/rate limits, 15-minute JWT expiry and staff TOTP. At present Docked intentionally blocks signup/recovery against hosted Auth in preview because a hosted mail sink has not been proven. Use the local stack for the full email lifecycle, or implement and independently verify a hosted catch-all SMTP sink before changing this gate. Do not set production mode to bypass it.

## Migration, recovery and advisor procedure

Order: `20261002113546_docked_platform.sql`, then `20261002122714_phase2_security_and_validation.sql`. The original migration is unchanged. `db/schema.sql` preserves the original bootstrap snapshot; **both ordered migrations** define the current schema. Existing strategy timestamps do not silently become Phase 2 approvals: the additive migration leaves existing unfrozen strategies inactive with lifecycle DRAFT, and retires legacy frozen versions with an audit entry preserving their original evidence. A new reviewed version is required for Phase 2 operation.

For an empty verified preview, inspect CLI `link`, `db push` and `migration list` help; link only the recorded Docked Preview ref, inspect the planned migration list and a dry run, then apply. Never run a reset on an existing cloud project. On a populated environment first create a restorable backup and test restoration into another dedicated disposable Docked preview. Recovery prefers restoring the verified backup or a forward repair migration; do not drop ledger/audit tables or edit migration history to imitate rollback. Local-only `db reset --local` is destructive and is for a confirmed disposable test stack only.

Run Supabase security and performance advisors once a dedicated project exists; review findings rather than treating an unavailable check as a pass. Local tests inspect RLS on all application tables, private-table grants and the only narrow SECURITY DEFINER helper. The helper has an empty search path, accepts no arbitrary target user, verifies Auth's own session/user records and returns only the caller's active-session boolean. It is granted only to `authenticated`; protected private payloads remain inaccessible. Members cannot mutate profiles, roles, ledger or provider tables through the Data API. Staff role claims in editable user metadata have no authority.

## Account acceptance checklist

Record actual results/screenshots, not assumed success. Pending until a local Auth stack is available:

1. Visitor creates an account; age/terms/country/state are required and digest, education, alerts and analytics are unchecked. Unverified login/dashboard access fails.
2. Confirmation arrives **only** in the local inbox; follow it, sign in, and check the remotely verified user plus active `auth.sessions` record. Confirmation schedules one idempotent service welcome; optional education remains separate.
3. Set sports, bookmakers, timezone, odds format and notifications; verify persisted values and onboarding completion. Change jurisdiction and verify alert pause plus server-side reevaluation.
4. Confirm restricted users see no tips through UI or direct API requests. Save only an eligible synthetic local fixture; cross-user reads and direct protected writes must fail.
5. Pause/revoke communications and confirm already queued or leased optional jobs are suppressed. One-click unsubscribe requires a valid server-generated deterministic HMAC token, stores only its hash, and needs no account session. Determinism keeps retry payloads identical; the server secret must remain private.
6. Export only that account's profile, preferences, saved/personal entries, consent history and consented analytics events.
7. Delete account: profile immediately disabled; sessions revoked; preferences paused; mutable outbox payloads and delivery identifiers scrubbed; personal/saved data, tokens and analytics removed; durable identity-erasure job queued. Simulate remote Auth failure and retry through worker. Access stays denied while retry is pending. Successful Auth deletion cascades profile data.
8. Retained immutable consent, staff/publication and audit evidence uses pseudonymous identifiers, **not anonymous data**. A reviewed retention period and legal basis remain release requirements. Provider backups follow their separately reviewed expiry.
9. Assign analyst/editor/admin/auditor only from a trusted operator path, enrol TOTP and prove role boundaries. Auditors can inspect, not mutate; editors cannot publish tips; analysts cannot advance strategy or correct settlement. Verify revoked/expired/disabled sessions on API handlers and direct Data API reads.

References checked: [Supabase changelog](https://supabase.com/changelog), [local configuration](https://supabase.com/docs/guides/local-development/cli/config), [Auth sessions](https://supabase.com/docs/guides/auth/sessions), [server-side Auth guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide). The changelog's September PostgreSQL maintenance notice should be reviewed when selecting the preview project version; this repository does not use ltree, legacy PGP ciphers, floating-point btree_gist indexes or custom operators.

## Exact CLI commands after target verification

These flags were checked against installed Supabase CLI 2.119.0. The commands below are instructions; remote commands were **not executed**.

For the dedicated local stack, after Docker is running:

```powershell
npx supabase start
npx supabase migration list --local
npx supabase db push --local --dry-run --skip-vault
npx supabase db push --local --skip-vault
npx supabase db advisors --local --type all --fail-on warn
```

For a newly created, verified, empty Docked Preview project, substitute its recorded reference explicitly. Supply authentication/database passwords through the provider's secure login/prompt flow, not command-line literals or chat:

```powershell
$dockedPreviewRef = '<VERIFIED_DOCKED_PREVIEW_REF>'
npx supabase migration list --project-ref $dockedPreviewRef
npx supabase db push --project-ref $dockedPreviewRef --dry-run --skip-vault
npx supabase db push --project-ref $dockedPreviewRef --skip-vault
npx supabase db advisors --project-ref $dockedPreviewRef --type all --fail-on warn
```

Inspect the dry-run list before the apply command. The explicit ref prevents an accidental implicit linked-project target. `--skip-vault` prevents this migration workflow from updating configured vault secrets. A populated project additionally requires the backup/restore rehearsal above. Keep the advisor outputs private and review every warning before declaring readiness.
