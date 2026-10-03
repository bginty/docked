// Operator-only: wait for BOTH browser and native QA release before mutation mode.
// Exact fixed QA A/B roster only. The durable S24 tester is never a cleanup target.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import { previewDatabaseBound } from "../../src/core/preview-auth";

const project = "bckkllmndoxzpzdqrevb";
const durableEmail = "docked-preview-s24-tester-20261003@example.invalid";
const fixturePath = "private-data/android-preview/acceptance.json";
const credentialPath = "private-data/android-preview/tester-credentials.txt";
const journalPath =
  "private-data/android-preview/provision-acceptance-state.json";
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    const mode = process.argv[2];
    if (
      !["--plan", "--erase-released-qa"].includes(mode) ||
      (mode === "--plan"
        ? process.argv.length !== 3
        : process.argv.length !== 4 ||
          process.argv[3] !== `--confirm-project=${project}`)
    )
      throw Error("EXPLICIT_RELEASED_QA_MODE_REQUIRED");
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    if (
      connection.projectRef !== project ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      fixture.projectRef !== project ||
      fixture.qaFixture !== true ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !==
        `https://${project}.supabase.co` ||
      process.env.SUPABASE_SECRET_KEY !== connection.secretKey ||
      !connection.secretKey ||
      !previewDatabaseBound(process.env) ||
      process.env.APP_ENV !== "preview" ||
      process.env.SUPABASE_ENV !== "preview"
    )
      throw Error("EXACT_PREVIEW_CLEANUP_SCOPE_REQUIRED");
    const targets = [fixture.memberA, fixture.memberB];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (
        !target ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          target.id,
        ) ||
        target.email !==
          `docked-preview-s24-qa-${i === 0 ? "a" : "b"}-20261003@example.invalid`
      )
        throw Error("EXACT_DISPOSABLE_ROSTER_REQUIRED");
    }
    if (
      targets[0].id === targets[1].id ||
      fixture.memberB.disposable !== true ||
      !/^[0-9a-f-]{36}$/i.test(fixture.policyId)
    )
      throw Error("EXACT_DISPOSABLE_ROSTER_REQUIRED");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    if (
      journal.projectRef !== project ||
      journal.mode !== "--provision-acceptance" ||
      !Array.isArray(journal.entries) ||
      journal.entries.length !== 2 ||
      journal.entries.some(
        (e: { id: string; email: string }) =>
          !targets.some((t) => t.id === e.id && t.email === e.email),
      )
    )
      throw Error("QA_JOURNAL_SCOPE_MISMATCH");
    sql = db();
    const durable = (
      await sql`select p.id,to_jsonb(p)::text profile,
      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]')::text from private.consent_events c where c.user_id=p.id) consent,
      (select to_jsonb(n)::text from public.notification_preferences n where n.user_id=p.id) preferences,
      (select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]')::text from private.preview_tester_access g where g.user_id=p.id) grants
      from public.profiles p join auth.users u on u.id=p.id where u.email=${durableEmail}`
    )[0];
    if (!durable || targets.some((t) => t.id === durable.id))
      throw Error("DURABLE_TESTER_BOUNDARY_REQUIRED");
    const durableHash = hash(JSON.stringify(durable));
    const credentialsHash = hash(await readFile(credentialPath));
    if (
      (await sql`select 1 from private.feature_flags where enabled`).length ||
      (await sql`select 1 from preview_auth.configuration where enabled`).length
    )
      throw Error("PREVIEW_MUST_REMAIN_CLOSED");
    const policy = (
      await sql`select * from private.region_policies where id=${fixture.policyId} and preview_community_only and country='XX' and state='DOCKED_PREVIEW' and cardinality(operators)=0 and features<@array['community_social','public_profiles']::text[]`
    )[0];
    if (
      !policy ||
      (
        await sql`select 1 from private.preview_tester_access where policy_id=${fixture.policyId} and user_id<>all(${targets.map((t) => t.id)}::uuid[])`
      ).length
    )
      throw Error("QA_POLICY_MUST_NOT_COVER_ANOTHER_MEMBER");
    for (const target of targets) {
      const actual =
        await sql`select id,email from auth.users where id=${target.id} or email=${target.email}`;
      if (
        actual.length &&
        (actual.length !== 1 ||
          actual[0].id !== target.id ||
          actual[0].email !== target.email)
      )
        throw Error("QA_IDENTITY_MISMATCH");
    }
    if (mode === "--plan") {
      console.log(
        "Exact QA A/B cleanup plan verified. Durable tester, its onboarding, consent, grant and credentials excluded. No changes made; await browser and native release before erasure.",
      );
      return;
    }
    for (const target of targets) {
      const remaining =
        await sql`select 1 from auth.users where id=${target.id} union all select 1 from public.profiles where id=${target.id}`;
      if (remaining.length) {
        await sql`select private.disable_account(${target.id})`;
        await processAccountDeletion(target.id);
      }
      await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp() where kind='account_deletion' and dedupe_key=${`account-deletion:${target.id}`}`;
    }
    await sql`update private.region_policies set approved=false where id=${fixture.policyId} and preview_community_only and not exists(select 1 from private.preview_tester_access where policy_id=${fixture.policyId})`;
    const durableAfter = (
      await sql`select p.id,to_jsonb(p)::text profile,
      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]')::text from private.consent_events c where c.user_id=p.id) consent,
      (select to_jsonb(n)::text from public.notification_preferences n where n.user_id=p.id) preferences,
      (select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]')::text from private.preview_tester_access g where g.user_id=p.id) grants
      from public.profiles p join auth.users u on u.id=p.id where u.email=${durableEmail}`
    )[0];
    if (
      hash(JSON.stringify(durableAfter)) !== durableHash ||
      hash(await readFile(credentialPath)) !== credentialsHash
    )
      throw Error("DURABLE_FINGERPRINT_CHANGED_STOP_AND_REVIEW");
    const ids = targets.map((t) => t.id);
    const checks = (
      await sql`select
      (select count(*)::int from auth.users where id=any(${ids}::uuid[])) qa_auth,
      (select count(*)::int from auth.sessions where user_id=any(${ids}::uuid[])) qa_sessions,
      (select count(*)::int from public.profiles where id=any(${ids}::uuid[])) qa_profiles,
      (select count(*)::int from private.preview_tester_access where user_id=any(${ids}::uuid[])) qa_grants,
      (select count(*)::int from private.social_profiles where user_id=any(${ids}::uuid[])) qa_identifiable_social,
      (select count(*)::int from private.social_posts p join private.social_profiles s on s.id=p.author_id where s.status='deleted' and (p.body<>'' or p.deleted_at is null or p.moderation_status<>'removed')) retained_deleted_commentary,
      (select count(*)::int from private.social_media m join private.social_profiles s on s.id=m.owner_id where s.status='deleted' and m.content is not null) retained_deleted_media,
      (select count(*)::int from private.region_policies where id=${fixture.policyId} and approved) qa_policy_approved`
    )[0];
    if (Object.values(checks).some((v) => v !== 0))
      throw Error("QA_ERASURE_INCOMPLETE");
    const finalState = (
      await sql`select
      (select count(*)::int from supabase_migrations.schema_migrations) migration_count,
      (select max(version) from supabase_migrations.schema_migrations) latest_migration,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity) protected_tables,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity) unprotected_tables,
      (select count(*)::int from auth.users) auth_users,
      (select count(*)::int from auth.sessions) auth_sessions,
      (select count(*)::int from public.profiles) profiles,
      (select count(*)::int from private.preview_tester_access) tester_grants,
      (select count(*)::int from private.roles) staff_roles,
      (select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approved_policies,
      (select count(*)::int from private.region_policies where approved and preview_community_only) preview_approved_policies,
      (select count(*)::int from private.feature_flags where enabled) enabled_flags,
      (select count(*)::int from private.events) sporting_events,
      (select count(*)::int from private.odds_snapshots) odds_snapshots,
      (select count(*)::int from private.market_references) market_references,
      (select count(*)::int from private.tip_publications) official_publications,
      (select count(*)::int from private.community_edges) community_edges,
      (select count(*)::int from private.outbox where state='sent') sent_outbox,
      (select count(*)::int from private.delivery_attempts) delivery_attempts,
      (select count(*)::int from preview_auth.configuration where enabled) enabled_capture_configurations,
      (select count(*)::int from preview_auth.captured_mail) captured_mail,
      has_table_privilege('anon','private.preview_tester_access','select') anon_tester_read,
      has_table_privilege('authenticated','private.preview_tester_access','insert') member_tester_write`
    )[0];
    const expectedState = {
      migration_count: 9,
      latest_migration: "20261003062615",
      protected_tables: 84,
      unprotected_tables: 0,
      auth_users: 1,
      auth_sessions: 0,
      profiles: 1,
      tester_grants: 1,
      staff_roles: 0,
      ordinary_approved_policies: 0,
      preview_approved_policies: 1,
      enabled_flags: 0,
      sporting_events: 0,
      odds_snapshots: 0,
      market_references: 0,
      official_publications: 0,
      community_edges: 0,
      sent_outbox: 0,
      delivery_attempts: 0,
      enabled_capture_configurations: 0,
      captured_mail: 0,
      anon_tester_read: false,
      member_tester_write: false,
    };
    if (
      Object.entries(expectedState).some(
        ([key, expected]) => finalState[key] !== expected,
      )
    )
      throw Error("FINAL_BACKEND_STATE_REQUIRES_REVIEW");
    const recordedAt = new Date().toISOString();
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          ...fixture,
          memberA: { ...fixture.memberA, password: "[ERASED]" },
          memberB: { ...fixture.memberB, password: "[ERASED]" },
          cleanupCompletedAt: recordedAt,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    await writeFile(
      journalPath,
      JSON.stringify(
        {
          ...journal,
          state: "qa-erased",
          entries: journal.entries.map((e: Record<string, unknown>) => ({
            ...e,
            password: "[ERASED]",
          })),
          cleanupCompletedAt: recordedAt,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    await writeFile(
      "docs/qa/android-https-preview/qa-cleanup.json",
      JSON.stringify(
        {
          projectRef: project,
          recordedAt,
          checks,
          finalState,
          durableProfileConsentPreferencesGrantAndCredentialUnchanged: true,
          note: "Only exact disposable QA A/B were erased through the existing disable/account-erasure service. QA policy withdrawn; password copies redacted. Pseudonymous audit/tombstones preserved.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Disposable QA cleanup verified; durable tester and its credentials/consents unchanged. Safe receipt saved; no identifiers or passwords emitted.",
    );
  } catch {
    console.error(
      "Exact QA cleanup did not complete; inspect guarded scope before retrying. No credentials or identifiers emitted.",
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
