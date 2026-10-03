// Exact-target operator tooling. Never imported by application code.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import {
  hostedPreviewDisabledFlags,
  assertHostedPreview,
} from "../../src/core/hosted-preview";

const project = "bckkllmndoxzpzdqrevb",
  organization = "ernfnkcbalhyqpsrzdwa";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const directory = "private-data/phase5",
  journalPath = `${directory}/acceptance.json`;
const migrationName = "20261003143903_phase5_edge_scanner_market_data.sql";
type Sql = ReturnType<typeof db>;
type Account = {
  role: "member" | "admin" | "analyst" | "editor" | "auditor";
  email: string;
  password: string;
  id?: string;
  socialId?: string;
  erased?: boolean;
};
type Journal = {
  projectRef: string;
  organizationId: string;
  runId: string;
  state: "prepared" | "ready" | "erased";
  qaFixture: true;
  baselineIds: string[];
  baselineFingerprint: string;
  accounts: Account[];
};
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
async function save(j: Journal, exclusive = false) {
  await writeFile(journalPath, JSON.stringify(j, null, 2), {
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  });
}
async function receipt(name: string, value: unknown) {
  await mkdir("docs/qa/phase5/operator", { recursive: true });
  await writeFile(
    `docs/qa/phase5/operator/${name}.json`,
    JSON.stringify(
      { projectRef: project, recordedAt: new Date().toISOString(), value },
      null,
      2,
    ) + "\n",
  );
}
async function fingerprint(sql: Sql, ids: string[]) {
  const rows =
    await sql`select u.id,u.email,u.encrypted_password,u.raw_app_meta_data,u.raw_user_meta_data,u.email_confirmed_at,u.banned_until,
    (select to_jsonb(p) from public.profiles p where p.id=u.id) profile,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.role),'[]') from private.roles r where r.user_id=u.id) roles,
    (select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from private.preview_tester_access g where g.user_id=u.id) grants
    from auth.users u where u.id=any(${ids}::uuid[]) order by u.id`;
  return hash(JSON.stringify(rows));
}
async function closed(sql: Sql) {
  const [v] = await sql`select
    (select count(*)::int from supabase_migrations.schema_migrations) migrations,
    (select max(version) from supabase_migrations.schema_migrations) latest,
    (select count(*)::int from private.feature_flags where enabled) enabled_flags,
    (select count(*)::int from private.tip_publications) official_records,
    (select count(*)::int from private.events) real_events,
    (select count(*)::int from private.odds_snapshots) real_snapshots,
    (select count(*)::int from private.delivery_attempts) delivery_attempts,
    (select count(*)::int from private.outbox where state='sent') external_sends,
    (select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals,
    (select count(*)::int from pg_tables where schemaname in ('private','public') and not rowsecurity) unprotected_tables`;
  if (
    !(
      (v.migrations === 11 && v.latest === "20261003121502") ||
      (v.migrations === 12 && v.latest === migrationName.slice(0, 14))
    ) ||
    Object.entries(v).some(
      ([k, n]) => !["migrations", "latest"].includes(k) && n !== 0,
    )
  )
    throw Error("Closed Phase 5 baseline required");
  return v;
}
async function main() {
  let sql: Sql | undefined,
    stage = "scope";
  try {
    const mode = process.argv[2];
    if (
      !["--inspect", "--apply", "--provision", "--cleanup"].includes(mode) ||
      process.argv[3] !== `--confirm-project=${project}` ||
      process.argv.length !== 4
    )
      throw Error("Explicit exact-target mode required");
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    const target = new URL(connection.databaseUrl);
    if (
      connection.projectRef !== project ||
      connection.organizationId !== organization ||
      connection.supabaseUrl !== `https://${project}.supabase.co` ||
      target.hostname !== "aws-0-ap-southeast-2.pooler.supabase.com" ||
      target.port !== "5432" ||
      decodeURIComponent(target.username) !== `postgres.${project}` ||
      target.pathname !== "/postgres"
    )
      throw Error("Connection identity denied");
    Object.assign(process.env, {
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      DOCKED_HOSTED_PREVIEW: "true",
      SITE_URL: origin,
      DATABASE_URL: connection.databaseUrl,
      DATABASE_SSL_CA_FILE: resolve(connection.caFile),
      DATABASE_CONNECTION_MODE: "session",
      DATABASE_RUNTIME: "serverless",
      NEXT_PUBLIC_SUPABASE_URL: connection.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: connection.publishableKey,
      SUPABASE_SECRET_KEY: connection.secretKey,
    });
    for (const flag of hostedPreviewDisabledFlags) process.env[flag] = "false";
    assertHostedPreview(process.env);
    const management = JSON.parse(
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-File",
          "scripts/hosted-preview/auth-management.ps1",
          "-Mode",
          "--inspect",
        ],
        {
          encoding: "utf8",
          timeout: 30000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).replace(/^\uFEFF/, ""),
    );
    if (
      management.projectRef !== project ||
      management.organizationId !== organization ||
      !management.signupDisabled ||
      management.customSmtpConfigured ||
      management.beforeEmailQuota !== 2 ||
      !management.anonymousSigninsDisabled
    )
      throw Error("Management identity or closed Auth mismatch");
    execFileSync("git", ["check-ignore", "--quiet", "--", journalPath], {
      stdio: "ignore",
      windowsHide: true,
    });
    sql = db();
    stage = "baseline";
    const state = await closed(sql);
    const baselineIds = (await sql`select id from auth.users order by id`).map(
      (r) => String(r.id),
    );
    const baselineFingerprint = await fingerprint(sql, baselineIds);
    if (mode === "--inspect") {
      await receipt("inspect", {
        state,
        accounts: baselineIds.length,
        mutations: false,
        managementVerified: true,
      });
      console.log(
        "Exact Docked Preview closed baseline verified; values withheld.",
      );
      return;
    }
    if (mode === "--apply") {
      if (state.migrations !== 11)
        throw Error("Only reviewed eleven-migration preimage accepted");
      const linked = (
        await readFile("supabase/.temp/project-ref", "utf8")
      ).trim();
      if (linked !== project) throw Error("CLI linked project mismatch");
      const snapshot = JSON.parse(
        await readFile(
          "private-data/hosted-preview/phase5-before-migration.json",
          "utf8",
        ),
      );
      if (snapshot.projectRef !== project || snapshot.migrations.length !== 11)
        throw Error("Private recovery preimage required");
      const pending = (await readdir("supabase/migrations"))
        .filter((n) => n.endsWith(".sql") && n.slice(0, 14) > state.latest)
        .sort();
      if (JSON.stringify(pending) !== JSON.stringify([migrationName]))
        throw Error("Unexpected pending migration");
      const cli = [
        "node_modules/supabase/dist/supabase.js",
        "db",
        "push",
        "--linked",
        "--skip-vault",
      ];
      const env = {
        ...process.env,
        SUPABASE_DB_PASSWORD: decodeURIComponent(target.password),
      };
      stage = "cli-dry-run";
      const dry = spawnSync(process.execPath, [...cli, "--dry-run"], {
        env,
        encoding: "utf8",
        timeout: 120000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (
        dry.status !== 0 ||
        dry.error ||
        !(dry.stdout + dry.stderr).includes(migrationName.slice(0, 14))
      )
        throw Error("CLI dry-run failed");
      stage = "apply";
      execFileSync(process.execPath, [...cli, "--yes"], {
        env,
        timeout: 120000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const after = await closed(sql);
      if (
        after.migrations !== 12 ||
        (await fingerprint(sql, baselineIds)) !== baselineFingerprint
      )
        throw Error("Post-migration preservation check failed");
      await receipt("migration", {
        migration: migrationName,
        sha256: hash(await readFile(`supabase/migrations/${migrationName}`)),
        state: after,
        existingAccountsPreserved: true,
        dryRun: true,
        applied: true,
      });
      console.log(
        "Reviewed Phase 5 migration applied to Docked Preview; existing accounts and closed gates preserved.",
      );
      return;
    }
    if (state.migrations !== 12)
      throw Error("Reviewed Phase 5 migration required");
    await mkdir(directory, { recursive: true });
    if (mode === "--provision") {
      stage = "journal";
      const runId = randomUUID();
      const journal: Journal = {
        projectRef: project,
        organizationId: organization,
        runId,
        state: "prepared",
        qaFixture: true,
        baselineIds,
        baselineFingerprint,
        accounts: (
          ["member", "admin", "analyst", "editor", "auditor"] as const
        ).map((role) => ({
          role,
          email: `docked-phase5-${role}-${runId}@example.invalid`,
          password: randomBytes(32).toString("base64url") + "Aa1!",
        })),
      };
      await save(journal, true);
      const [policy] =
        await sql`select id,least(effective_to,review_at,clock_timestamp()+interval '4 hours') expires_at from private.region_policies where preview_community_only and approved and country='XX' and state='DOCKED_PREVIEW' and cardinality(operators)=0 and features @> array['community_social','public_profiles']::text[] and features <@ array['community_social','public_profiles']::text[] and effective_from<=clock_timestamp() and effective_to>clock_timestamp()+interval '30 minutes' and review_at>clock_timestamp()+interval '30 minutes' order by effective_from desc limit 1`;
      if (!policy)
        throw Error("Existing preview-only policy required; no policy created");
      const admin = createClient(connection.supabaseUrl, connection.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const account of journal.accounts) {
        stage = `provision-${account.role}`;
        const result = await admin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          app_metadata: {
            qa_fixture: true,
            phase5_run_id: runId,
            preview_operator_provisioned: true,
            email_ownership_verified: false,
          },
        });
        if (
          result.error ||
          !result.data.user ||
          result.data.user.email !== account.email
        )
          throw Error("QA creation failed; journal reconciliation required");
        account.id = result.data.user.id;
        await save(journal);
        await sql.begin(async (tx) => {
          await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at,timezone) values(${account.id!},'XX','PHASE5_QA',true,'phase5-synthetic-qa',clock_timestamp(),'Australia/Sydney')`;
          await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education) values(${account.id!},true,'off',false,false)`;
          await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason) values(${account.id!},${policy.id},${project},${policy.expires_at},'phase5-qa-operator','Disposable software acceptance only; no data/publication authority or real-world consent')`;
          const [social] =
            await tx`insert into private.social_profiles(user_id,handle,display_name,bio,visibility) values(${account.id!},${`qa5_${journal.accounts.indexOf(account)}_${runId.replaceAll("-", "").slice(0, 10)}`},${`QA participant ${journal.accounts.indexOf(account) + 1}`},'Private disposable Phase 5 QA. No sporting performance.','private') returning id`;
          account.socialId = String(social.id);
          await tx`insert into private.social_notification_preferences(profile_id,in_app,social) values(${social.id},false,false)`;
          if (account.role !== "member")
            await tx`insert into private.roles(user_id,role) values(${account.id!},${account.role})`;
          await tx`insert into private.audit_events(actor,action,subject,details) values('phase5-qa-operator','disposable_qa_role',${account.id!},${tx.json({ runId, role: account.role, synthetic: true })})`;
        });
        await save(journal);
      }
      if ((await fingerprint(sql, baselineIds)) !== baselineFingerprint)
        throw Error("Existing account preservation failed");
      journal.state = "ready";
      await save(journal);
      await receipt("provision", {
        accounts: journal.accounts.length,
        roles: journal.accounts.map((a) => a.role),
        noEmail: true,
        synthetic: true,
        privateProfiles: true,
        existingAccountsPreserved: true,
        policyUnchanged: true,
        maximumGrantHours: 4,
      });
      console.log(
        "Five private disposable QA identities prepared; no email, sporting data or policy changes.",
      );
      return;
    }
    stage = "cleanup-scope";
    const j: Journal = JSON.parse(await readFile(journalPath, "utf8"));
    if (
      j.projectRef !== project ||
      j.organizationId !== organization ||
      j.qaFixture !== true ||
      !/^[-a-f0-9]{36}$/.test(j.runId) ||
      j.accounts.length !== 5
    )
      throw Error("Exact QA journal required");
    if ((await fingerprint(sql, j.baselineIds)) !== j.baselineFingerprint)
      throw Error("Existing accounts changed; preserve them for review");
    for (const a of j.accounts) {
      if (
        a.email !== `docked-phase5-${a.role}-${j.runId}@example.invalid` ||
        (a.id && j.baselineIds.includes(a.id))
      )
        throw Error("Cleanup identity denied");
      const rows =
        await sql`select id,email,raw_app_meta_data from auth.users where email=${a.email}`;
      if (rows.length > 1) throw Error("Ambiguous QA identity");
      if (rows[0]) {
        const u = rows[0];
        if (
          u.raw_app_meta_data?.qa_fixture !== true ||
          u.raw_app_meta_data?.phase5_run_id !== j.runId ||
          (a.id && a.id !== u.id) ||
          j.baselineIds.includes(u.id)
        )
          throw Error("QA marker mismatch");
        a.id = String(u.id);
        await save(j);
        await sql`select private.disable_account(${a.id})`;
        await processAccountDeletion(a.id);
        await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp() where kind='account_deletion' and dedupe_key=${`account-deletion:${a.id}`}`;
      }
      if (a.id) {
        const [left] =
          await sql`select (select count(*)::int from auth.users where id=${a.id}) users,(select count(*)::int from auth.sessions where user_id=${a.id}) sessions,(select count(*)::int from public.profiles where id=${a.id}) profiles,(select count(*)::int from private.roles where user_id=${a.id}) roles,(select count(*)::int from private.preview_tester_access where user_id=${a.id}) grants`;
        if (Object.values(left).some((n) => n !== 0))
          throw Error("QA erasure incomplete");
      }
      a.password = "[ERASED]";
      a.erased = true;
      await save(j);
    }
    if ((await fingerprint(sql, j.baselineIds)) !== j.baselineFingerprint)
      throw Error("Existing account preservation failed");
    const remaining = (await sql`select id from auth.users order by id`).map(
      (r) => String(r.id),
    );
    if (JSON.stringify(remaining) !== JSON.stringify(j.baselineIds))
      throw Error(
        "Auth roster changed; report without deleting unrelated accounts",
      );
    j.state = "erased";
    await save(j);
    await receipt("cleanup", {
      qaAccountsErased: j.accounts.filter((a) => a.id).length,
      remainingAccounts: remaining.length,
      existingAccountsPreserved: true,
      state: await closed(sql),
    });
    console.log(
      "Only journaled disposable QA accounts erased through the existing deletion service; original accounts preserved.",
    );
  } catch {
    console.error(
      `Phase 5 operator stopped at ${stage}; credentials and raw errors withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
