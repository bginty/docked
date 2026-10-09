> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Production database role readiness

Prepared 4 October 2026. **Source and local PostgreSQL validation only. No production role, password, project or account has been provisioned by this work.**

The additive migration `20261003214310_production_community_runtime_role.sql` prepares the `docked_app` connection role for a community-only production web server. It is the thirteenth migration in the current repository. It does not activate registration, email, jurisdictions, providers, publications, paper operation, commercial features or a worker.

## Authority boundary

`docked_app` starts with `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`. It owns no application object and has no role memberships, permanent schema creation privilege or default privileges for future objects. Its password is deliberately absent from tracked SQL. Applying this migration to Preview does not replace Preview's connection or enable the role.

This is a trusted backend connection role, never a browser JWT role. Existing anonymous/authenticated grants are unchanged. Tables retain RLS, but the explicitly enumerated server SELECT policies permit the web server's necessary read models. The current application obtains a verified Supabase identity before its own-user queries and repeats transactional session, role/MFA and jurisdiction checks on sensitive mutations. Some identity queries necessarily run before SQL request claims have been set. These server policies therefore do **not** claim database isolation between end users if the entire backend credential is compromised. That credential remains a high-value server secret; it cannot be sent to a browser or APK.

The role can maintain account preferences, consent receipts, ordinary social content, moderation, in-app notifications, rate limits and account erasure. It can read the enumerated existing admin/derived-ledger projections. It cannot assign roles, approve legal regions, change feature flags, publish or settle sporting records, run scanner/provider jobs, create preview invitations, or rewrite immutable audit/consent records. Ordinary social INSERT policies exclude official identity and ledger-linked posts. Existing immutable and identity triggers remain active.

Provider payloads, full quote evidence, Auth credential hashes and refresh tokens are not readable. Operational counts receive only `community_quote_evidence.classification, created_at`; recognition receives only `odds_snapshots.id, evidence`. A private security-barrier view projects six Auth-user columns for account/session checks and analytics exclusions: `id`, `email`, `email_confirmed_at`, `is_anonymous`, `raw_app_meta_data`, `banned_until`. Another private view projects only session `id`, `user_id`, `not_after`, with DELETE for revocation. The views use their migration owner's existing SELECT/DELETE and RLS-bypass authority; they grant no direct Auth-table or Auth-schema access to `docked_app`.

This design follows the read-only hosted catalog receipt in `docs/qa/production/supabase-auth-catalog.json`: managed Auth tables have RLS and a separate `supabase_auth_admin` owner; postgres has the required data privileges but cannot delegate Auth schema usage or session deletion or add Auth policies. The migration changes no Auth schema/table/function permissions. A private invoker claim reader replaces `auth.uid()` only inside the existing community access and post-visibility helpers, preserving their other checks. The existing own-session SECURITY DEFINER helper retains its Auth access. Production source uses fixed private relation names; Preview keeps its existing direct Auth relations and does not require this new migration merely to run the updated web source.

Existing `FOR SHARE` authorization queries need PostgreSQL UPDATE privilege. The migration grants only UPDATE of the identity column on region policies and preview grants, with an UPDATE RLS check that is always false. Row locking works; even `UPDATE ... SET id=id` fails. This is tested, not a permission to edit approval records.

The only private SECURITY DEFINER function executable by the role is the existing own-session boolean helper, with an empty fixed search path. Privileged strategy/scanner/raw-purge/preview-administration helpers are not granted. Existing invoker helpers cannot acquire permissions the connection role lacks.

Review also found that the ordinary-region success branch checked session validity before its authorization locks but did not repeat it afterwards. The new migration adds the same post-lock wall-clock check needed by that branch; a deterministic delayed policy-row regression verifies a session that expires during the wait cannot proceed.

PostgreSQL may retain database TEMP privileges inherited from PUBLIC. This migration does not revoke shared Supabase platform privileges globally. Temporary session objects do not confer ownership of permanent tables or bypass the fixed search paths. The restriction asserted here is **no permanent DDL**, not a claim that all temporary SQL objects are impossible.

## Exact production provisioning sequence

An operator must perform these steps only after the dedicated Docked production project and hosting manifest have been independently verified. Do not reuse the Preview project, its accounts, grants, invitations, mail-capture schema, fixture records or private credentials. Do not copy any unrelated project.

1. Verify the project name, organization, project reference, database version, billing choice and application manifest match the approved production target. Save a sanitized receipt and a protected schema/data preimage. Confirm the production database has no Preview Auth identities or fixture evidence.
2. Review the complete ordered migration list and a linked Supabase CLI dry-run. Apply only the reviewed pending migrations. An existing `docked_app` role deliberately stops this migration: investigate its attributes, memberships, ownership and grants instead of replacing it blindly.
3. Verify all six allowlisted Auth-user columns and three session columns exist, and the private projections return the expected fixed shape under the restricted role. For managed Auth schemas the migration rejects missing columns or missing projection-owner SELECT/DELETE/RLS-bypass privileges before creating the role. Only nonmanaged minimal embedded-test schemas permit typed null fallbacks. Verify Auth table policies/ACLs remain unchanged, all application RLS policies, role attributes, zero memberships, zero object ownership and denied permanent schema creation.
4. Confirm anonymous/authenticated private-table privileges have not widened. Exercise real Auth sessions through the production application, including member versus other member, expired/revoked sessions, staff MFA and read-only auditor. Repeat direct protected-ledger/role/feature/region writes and secret-column denials using the restricted role. Local PGlite tests are not a substitute for this hosted acceptance.
5. Provision a new high-entropy role password and enable LOGIN through the privileged operator connection, keeping the value only in a protected secret store. No password should appear in SQL files, command arguments, terminal output or evidence. Bind `DATABASE_URL` to that exact project's `docked_app` role and the reviewed direct/session endpoint. The production manifest requires this role; a postgres connection is rejected.
6. Use the shared verified TLS helper with the correct certificate and hostname. Keep `DATABASE_RUNTIME=serverless` only for the explicit small-pool deployment. Verify a real query with certificate verification enabled; never use `rejectUnauthorized:false` or a URL SSL override. Confirm client/static/APK scans contain no database or Auth administration credentials.
7. Keep registration, `AUTH_EMAIL_ENABLED`, external sending, data ingestion and publication off until their independent readiness requirements are met. Auth transactional SMTP is separate from notification delivery. Configure exact production callbacks, current approved terms/privacy versions and actual operator details before enabling account creation. No real email has been sent as part of this preparation.

If the role needs an additional operation, add a reviewed explicit grant/policy with a regression. Do not change it to BYPASSRLS, an owner, postgres, or ALL TABLES to make a failing query pass.

## Deliberate limits before an interactive production release

- The current monolithic worker also leases external-delivery queues and performs CMS, scanner and provider operations. Its scheduled-article lock fails before account-erasure draining under this role. Use the new `scripts/community-maintenance.ts` one-shot runner instead. It drains at most ten account-deletion jobs, purges at most 1,000 records per retention category and processes at most 100 recipients of one ordinary social post job. Official/Edge/leaderboard fanout, providers, CMS, publication and external delivery are excluded. No scheduler has been configured or activated.
- Direct account deletion can complete through the application's Auth Admin API, after SQL revocation. If that API fails, access remains revoked and the restricted maintenance runner retries the existing durable job. After five failed/crashed attempts the job remains visibly dead with an operator action; it is not silently dropped. Production still needs a reviewed schedule, alerts and an observed successful invocation before claiming unattended retries or retention.
- Account signup spans Supabase Auth and PostgreSQL. A username race uses a savepoint and preserves the newly created account for username selection. An unrelated database failure never guesses that it is safe to delete an Auth identity; it leaves a repair audit marker when possible and returns a setup failure. Repair requires verified ownership and operator review. This is not represented as an atomic cross-service transaction.
- Admin read models and community moderation are supported by the role. CMS publishing, sports/strategy/data configuration, scanner actions, preview administration and commercial mutations are intentionally denied. Their UI presence does not imply activation or permission. Those future capabilities need separate permission and launch reviews.
- Backup recovery, hosted Supabase role semantics, actual SMTP delivery, real-device acceptance and production load are not established by the local tests. Registration can remain closed while those dependencies are resolved.

## Local verification

Focused checks use embedded PostgreSQL through PGlite and isolated fictional identities only:

```powershell
npx tsx --test tests/database/production-runtime-role.test.ts tests/database/production-signup.test.ts
```

The full existing database suite is safe locally and does not require a hosted URL or running Docker database:

```powershell
npx tsx --test --test-concurrency=1 tests/database/*.test.ts
```

Tests cover role attributes/ownership/DDL, unchanged browser grants, secret/raw-data denial, privileged helper denial, account/consent creation, real session and authorization locks, expired-session denial, social writes and durable in-app queue creation, official/ledger impersonation denial, restricted queues, account revocation and pseudonymization. The Auth-specific tests cover unchanged existing profiles, consent versions, active/historical handle collisions and rollback on unrelated integrity errors.

Final local database result: **126/126 passed, zero failed or skipped**. See `docs/qa/production/database-results.json` and `database-results.tap`. The initial run's three isolated recognition-adapter failures and the passing focused rerun are retained alongside the final result. The adapter was updated to support the two fixed Auth relation names; recognition assertions were unchanged. Whole-project type checking passed.

The runtime-role harness gives managed Auth tables and schema a separate owner, enables their RLS with no policies, and executes the new migration through a non-superuser migration role with RLS bypass and existing SELECT/DELETE but no Auth schema or DELETE grant options. It also rejects a missing managed Auth column. These are stronger local checks of the observed Supabase boundary, not a claim that the migration has been applied or accepted on the new hosted project.

The prepared maintenance entry point is:

```text
node --conditions=react-server --import tsx scripts/community-maintenance.ts once
```

It requires the actual reviewed production runtime binding, including the exact project/platform values checked by the shared deployment guard and a live `docked_app` database connection. It is not a local dry-run command. Do not fabricate Vercel system values to bypass that guard. A future scheduler must invoke it in the properly bound runtime; this document does not authorize or create that scheduler. The output contains aggregate counts only, and any failure returns a nonzero exit status without credential, identity or provider-error logging.
