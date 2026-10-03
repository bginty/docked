// Operator only. Separate journal; never imports into the web bundle.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import {
  requirePreviewEnvironment,
  previewCapabilities,
} from "../../src/core/preview-testers";
const project = "bckkllmndoxzpzdqrevb",
  organization = "ernfnkcbalhyqpsrzdwa",
  origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const directory = "private-data/phase45-beta",
  evidence = "docs/qa/phase45/operator";
const ownerEmail = "docked-preview-s24-tester-20261003@example.invalid";
const credentialPath = "private-data/android-preview/tester-credentials.txt";
const migrationNames = [
  "20261003121257_phase45_preview_beta_auth.sql",
  "20261003121502_phase45_preview_market_fixtures.sql",
];
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
type Account = {
  kind: "qa-a" | "qa-b" | "seed-a" | "seed-b";
  email: string;
  password: string;
  username: string;
  displayName: string;
  invitationCode: string;
  invitationId: string;
  disposable: boolean;
  id?: string;
};
type Journal = {
  projectRef: string;
  organizationId: string;
  origin: string;
  qaFixture: true;
  runId: string;
  createdAt: string;
  expiresAt: string;
  ownerHash: string;
  ownerCredentialHash: string;
  ownerGrantId: string;
  state: "prepared" | "ready" | "cleaned";
  accounts: Account[];
};
type Sql = ReturnType<typeof db>;
async function receipt(name: string, data: unknown) {
  await mkdir(evidence, { recursive: true });
  await writeFile(
    `${evidence}/${name}.json`,
    JSON.stringify(
      { projectRef: project, recordedAt: new Date().toISOString(), data },
      null,
      2,
    ) + "\n",
  );
}
async function save(j: Journal, exclusive = false) {
  await writeFile(
    `${directory}/acceptance.json`,
    JSON.stringify(j, null, 2) + "\n",
    { flag: exclusive ? "wx" : "w", mode: 0o600 },
  );
}
function management() {
  const state = JSON.parse(
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        resolve("scripts/hosted-preview/auth-management.ps1"),
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
    state.projectRef !== project ||
    state.organizationId !== organization ||
    state.signupDisabled !== true ||
    state.anonymousSigninsDisabled !== true ||
    state.phoneSignupsDisabled !== true ||
    state.customSmtpConfigured !== false ||
    state.beforeEmailQuota !== 2
  )
    throw Error("Closed project identity/configuration required");
  return {
    projectAndOrganizationVerified: true,
    signupClosed: true,
    customSmtp: false,
    quota: 2,
  };
}
async function baseline(sql: Sql) {
  const [v] =
    await sql`select (select count(*)::int from supabase_migrations.schema_migrations) migrations,(select max(version) from supabase_migrations.schema_migrations) latest,
 (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity) unprotected,
 (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),('authenticated')) r(role) where n.nspname='private' and c.relkind='r' and has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE')) private_browser_privileges,
 (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),('authenticated')) r(role) where n.nspname='private' and p.proname in ('preview_capabilities_valid','preview_invitation_guard','preview_tester_capability','assert_preview_tester_capability','assert_preview_beta_admin','preview_fixture_guard','preview_fixture_audit') and has_function_privilege(r.role,p.oid,'EXECUTE')) preview_browser_execution,
 (select count(*)::int from private.feature_flags where enabled) flags,(select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals,
 (select count(*)::int from private.roles) staff_roles,(select count(*)::int from preview_auth.configuration where enabled) capture_enabled,
 (select count(*)::int from preview_auth.captured_mail) captured_mail,(select count(*)::int from private.events) real_events,
 (select count(*)::int from private.odds_snapshots) odds,(select count(*)::int from private.tip_publications) official_tips,
 (select count(*)::int from private.community_edges) real_edges,(select count(*)::int from private.market_references) real_references,
 (select count(*)::int from private.delivery_attempts) delivery_attempts,(select count(*)::int from private.outbox where state='sent') sent_outbox`;
  if (
    !(
      (v.migrations === 9 && v.latest === "20261003062615") ||
      (v.migrations === 11 && v.latest === "20261003121502")
    ) ||
    Object.entries(v).some(
      ([k, n]) => !["migrations", "latest"].includes(k) && n !== 0,
    )
  )
    throw Error("Closed preview baseline mismatch");
  return v;
}
async function owner(sql: Sql) {
  const [p] =
    await sql`select p.id,to_jsonb(p) profile,jsonb_build_object('email',u.email,'password',u.encrypted_password,'appMetadata',u.raw_app_meta_data,'userMetadata',u.raw_user_meta_data,'emailConfirmed',u.email_confirmed_at,'bannedUntil',u.banned_until) authentication,
 (select to_jsonb(n) from public.notification_preferences n where n.user_id=p.id) preferences,
 (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]') from private.consent_events c where c.user_id=p.id) consent,
 (select to_jsonb(s) from private.social_profiles s where s.user_id=p.id) social
 from public.profiles p join auth.users u on u.id=p.id where u.email=${ownerEmail}`;
  if (!p) throw Error("Protected owner missing");
  return {
    id: String(p.id),
    hash: hash(JSON.stringify(p)),
    credentialHash: hash(await readFile(credentialPath)),
  };
}
async function policy(sql: Sql, id: string) {
  const [p] =
    await sql`select p.id,g.expires_at,least(g.expires_at,p.effective_to,p.review_at) until from private.preview_tester_access g join private.region_policies p on p.id=g.policy_id where g.user_id=${id} and g.revoked_at is null and g.expires_at>clock_timestamp()+interval '1 hour' and p.approved and p.preview_community_only and p.minimum_age=18 and cardinality(p.operators)=0 and p.effective_from<=clock_timestamp() and least(p.effective_to,p.review_at)>clock_timestamp()+interval '1 hour' order by g.created_at desc,g.id desc limit 1`;
  if (!p) throw Error("Existing owner preview grant/policy required");
  return p;
}
function validate(j: Journal) {
  if (
    j.projectRef !== project ||
    j.organizationId !== organization ||
    j.origin !== origin ||
    j.qaFixture !== true ||
    !/^[-a-f0-9]{36}$/.test(j.runId) ||
    j.accounts.length !== 4 ||
    new Set(j.accounts.map((a) => a.kind)).size !== 4
  )
    throw Error("Exact Phase45 journal required");
  for (const a of j.accounts) {
    if (
      !["qa-a", "qa-b", "seed-a", "seed-b"].includes(a.kind) ||
      a.email !==
        `docked-preview-phase45-${a.kind}-${j.runId}@example.invalid` ||
      a.email === ownerEmail ||
      a.disposable !== a.kind.startsWith("qa-")
    )
      throw Error("Exact Phase45 account roster required");
  }
}
async function main() {
  let sql: Sql | undefined;
  let stage = "arguments";
  try {
    const mode = process.argv[2];
    if (
      ![
        "--plan",
        "--migrate",
        "--prepare-invitations",
        "--revoke-qa-a",
        "--cleanup",
      ].includes(mode) ||
      process.argv[3] !== `--confirm-project=${project}` ||
      (mode === "--cleanup"
        ? process.argv.length !== 5 || process.argv[4] !== "--qa-released"
        : process.argv.length !== 4)
    )
      throw Error("Explicit reviewed operator scope required");
    stage = "environment";
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    if (
      connection.projectRef !== project ||
      connection.organizationId !== organization ||
      connection.supabaseUrl !== `https://${project}.supabase.co` ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.SUPABASE_SECRET_KEY !== connection.secretKey ||
      process.env.SITE_URL !== origin
    )
      throw Error("Exact private connection required");
    requirePreviewEnvironment();
    execFileSync(
      "git",
      ["check-ignore", "--quiet", "--", `${directory}/acceptance.json`],
      { stdio: "ignore", windowsHide: true },
    );
    const closed = management();
    sql = db();
    let state = await baseline(sql);
    const protectedOwner = await owner(sql);
    if (mode === "--plan") {
      await receipt("plan", {
        ...closed,
        state,
        mutations: false,
        scope:
          "Two ordered migrations; existing-expiry owner capability extension only; four exact-email invitations, two disposable and two clearly labelled DEMO seed profiles; zero email, role, legal-policy or real-sports changes.",
      });
      console.log("Phase45 read-only plan verified. No state changed.");
      return;
    }
    await mkdir(directory, { recursive: true });
    if (mode === "--migrate") {
      stage = "migration-preimage";
      if (state.migrations !== 9)
        throw Error("Expected nine-migration preimage");
      if (
        (await readFile("supabase/.temp/project-ref", "utf8")).trim() !==
        project
      )
        throw Error("CLI linked target mismatch");
      const pending = (await readdir("supabase/migrations"))
        .filter(
          (n) =>
            n.endsWith(".sql") &&
            n > "20261003062615_session_wall_clock_revalidation.sql",
        )
        .sort();
      if (JSON.stringify(pending) !== JSON.stringify(migrationNames))
        throw Error("Unexpected pending migration");
      const snapshot = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          const rows: Record<string, unknown> = {};
          for (const t of await tx`select schemaname,tablename from pg_tables where schemaname in ('public','private','preview_auth') order by 1,2`)
            rows[`${t.schemaname}.${t.tablename}`] =
              await tx`select * from ${tx(t.schemaname)}.${tx(t.tablename)}`;
          const functions =
            await tx`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','preview_auth') and p.prokind in ('f','p') order by 1,2`;
          const catalog =
            await tx`select n.nspname,c.relname,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','preview_auth') order by 1,2`;
          return { rows, functions, catalog, state };
        },
      );
      const snapshotText = JSON.stringify(snapshot);
      await writeFile(`${directory}/before-migrations.json`, snapshotText, {
        flag: "wx",
        mode: 0o600,
      });
      await receipt("migration-preimage", {
        sha256: hash(snapshotText),
        tableCount: Object.keys(snapshot.rows).length,
        scope:
          "Application/schema recovery preimage; not an asserted complete Auth/storage disaster restore",
      });
      const cliArgs = [
        "node_modules/supabase/dist/supabase.js",
        "db",
        "push",
        "--linked",
        "--skip-vault",
      ];
      const env = {
        ...process.env,
        SUPABASE_DB_PASSWORD: decodeURIComponent(
          new URL(connection.databaseUrl).password,
        ),
      };
      stage = "cli-dry-run";
      const dryResult = spawnSync(process.execPath, [...cliArgs, "--dry-run"], {
        encoding: "utf8",
        timeout: 120000,
        windowsHide: true,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (dryResult.status !== 0 || dryResult.error)
        throw Error("CLI dry run unavailable");
      const dry = dryResult.stdout + dryResult.stderr;
      for (const name of migrationNames)
        if (!dry.includes(name) && !dry.includes(name.slice(0, 14)))
          throw Error("Dry run does not match reviewed migrations");
      stage = "cli-apply";
      execFileSync(process.execPath, [...cliArgs, "--yes"], {
        timeout: 120000,
        windowsHide: true,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      state = await baseline(sql);
      if (state.migrations !== 11) throw Error("Post-migration count mismatch");
      const after = await owner(sql);
      if (
        after.hash !== protectedOwner.hash ||
        after.credentialHash !== protectedOwner.credentialHash
      )
        throw Error("Owner changed during migration");
      await receipt("migration", {
        migrations: migrationNames,
        state,
        ownerUnchanged: true,
        credentialsUnchanged: true,
        cliDryRun: true,
        cliApply: true,
      });
      console.log(
        "Reviewed Phase45 migrations applied; closed guards and protected owner verified.",
      );
      return;
    }
    if (state.migrations !== 11)
      throw Error("Reviewed Phase45 migrations required");
    if (mode === "--prepare-invitations") {
      stage = "fresh-roster";
      if ((await sql`select id from auth.users`).length !== 1)
        throw Error("Owner-only Auth baseline required");
      const p = await policy(sql, protectedOwner.id),
        runId = randomUUID(),
        expiresAt = new Date(p.until).toISOString();
      const accounts = (["qa-a", "qa-b", "seed-a", "seed-b"] as const).map(
        (kind) => ({
          kind,
          email: `docked-preview-phase45-${kind}-${runId}@example.invalid`,
          password: randomBytes(30).toString("base64url") + "Aa1!",
          username: `demo_${kind.replace("-", "")}_${runId.slice(0, 8)}`,
          displayName:
            kind === "seed-a"
              ? "DEMO Harbour Tester"
              : kind === "seed-b"
                ? "DEMO Court Tester"
                : `DEMO ${kind.toUpperCase()}`,
          invitationCode: randomBytes(32).toString("base64url"),
          invitationId: randomUUID(),
          disposable: kind.startsWith("qa-"),
        }),
      );
      const j: Journal = {
        projectRef: project,
        organizationId: organization,
        origin,
        qaFixture: true,
        runId,
        createdAt: new Date().toISOString(),
        expiresAt,
        ownerHash: protectedOwner.hash,
        ownerCredentialHash: protectedOwner.credentialHash,
        ownerGrantId: randomUUID(),
        state: "prepared",
        accounts,
      };
      await save(j, true);
      stage = "bounded-invitations";
      await sql.begin(async (tx) => {
        await tx`select set_config('docked.hosted_preview_project',${project},true),set_config('docked.preview_actor','phase45-reviewed-operator',true)`;
        const [locked] =
          await tx`select id from private.region_policies where id=${p.id} and approved and preview_community_only and least(effective_to,review_at)>clock_timestamp()+interval '1 hour' for share`;
        if (!locked) throw Error("Preview policy expired");
        await tx`insert into private.preview_tester_access(id,user_id,policy_id,project_ref,expires_at,capabilities,granted_by,reason) values(${j.ownerGrantId},${protectedOwner.id},${p.id},${project},${expiresAt},${[...previewCapabilities]},'phase45-reviewed-operator','Phase45 approved preview capabilities only; preserves existing expiry and requires owner legal onboarding. No real performance access.')`;
        for (const a of accounts)
          await tx`insert into private.preview_beta_invitations(id,project_ref,policy_id,token_hash,email_hash,capabilities,fixture,expires_at,grant_hours,created_by,reason) values(${a.invitationId},${project},${p.id},${hash(a.invitationCode)},${hash(a.email)},${[...previewCapabilities]},true,least(${expiresAt}::timestamptz,clock_timestamp()+interval '24 hours'),168,'phase45-fixture-operator',${a.disposable ? "DEMO / PREVIEW disposable acceptance identity; synthetic legal test inputs, erase after QA." : "DEMO / PREVIEW retained synthetic social seed identity; not a real user or performance record."})`;
      });
      j.state = "ready";
      await save(j);
      const after = await owner(sql);
      if (
        after.hash !== j.ownerHash ||
        after.credentialHash !== j.ownerCredentialHash
      )
        throw Error("Protected owner changed");
      await receipt("invitations", {
        count: 4,
        authUsersCreated: 0,
        ownerCapabilityGrantAdded: true,
        ownerExpiryExtended: false,
        ownerLegalAndCredentialStateUnchanged: true,
        expiresAt,
        disposable: 2,
        retainedDemoSeeds: 2,
      });
      console.log(
        "Four private invitations prepared; owner capabilities audited at existing expiry. No Auth accounts or emails created.",
      );
      return;
    }
    stage = "cleanup-roster";
    const j = JSON.parse(
      await readFile(`${directory}/acceptance.json`, "utf8"),
    ) as Journal;
    validate(j);
    if (j.state !== "ready") throw Error("Ready, released journal required");
    if (
      j.ownerHash !== protectedOwner.hash ||
      j.ownerCredentialHash !== protectedOwner.credentialHash
    )
      throw Error("Protected owner boundary changed");
    if (mode === "--revoke-qa-a") {
      stage = "exact-qa-a-revocation";
      const target = j.accounts.find((a) => a.kind === "qa-a" && a.disposable)!;
      const [actual] =
        await sql`select id,raw_app_meta_data from auth.users where email=${target.email}`;
      if (
        !actual ||
        actual.id === protectedOwner.id ||
        actual.raw_app_meta_data?.preview_invitation_id !==
          target.invitationId ||
        actual.raw_app_meta_data?.preview_fixture !== true
      )
        throw Error("Exact disposable QA A required");
      const revoked = await sql.begin(async (tx) => {
        await tx`select set_config('docked.hosted_preview_project',${project},true),set_config('docked.preview_actor','phase45-reviewed-operator',true)`;
        return tx`update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by='phase45-reviewed-operator',revocation_reason='Explicit Phase45 acceptance: revoke this disposable tester while preserving Auth for direct API denial checks.' where user_id=${actual.id} and revoked_at is null returning id`;
      });
      await receipt("qa-a-revocation", {
        grantsRevoked: revoked.length,
        scope:
          "Exact disposable QA A only; Auth retained for denial verification; owner and seed grants untouched",
      });
      console.log(
        "Exact disposable QA A capability revoked; awaiting genuine API denial verification and final release.",
      );
      return;
    }
    for (const a of j.accounts) {
      const [actual] =
        await sql`select id,raw_app_meta_data from auth.users where email=${a.email}`;
      if (
        actual &&
        (actual.id === protectedOwner.id ||
          actual.raw_app_meta_data?.preview_invitation_id !== a.invitationId ||
          actual.raw_app_meta_data?.preview_fixture !== true)
      )
        throw Error("Account provenance mismatch");
      if (actual && a.disposable) {
        await sql`select private.disable_account(id) from public.profiles where id=${actual.id}`;
        await sql`delete from auth.sessions where user_id=${actual.id}`;
        await processAccountDeletion(String(actual.id));
      } else if (actual)
        await sql`delete from auth.sessions where user_id=${actual.id}`;
      await sql.begin(async (tx) => {
        await tx`select set_config('docked.hosted_preview_project',${project},true)`;
        await tx`update private.preview_beta_invitations set status='revoked' where id=${a.invitationId} and status in ('pending','reserved')`;
      });
      a.password = "[REDACTED AFTER ACCEPTANCE]";
      a.invitationCode = "[REDACTED AFTER ACCEPTANCE]";
    }
    const qaEmails = j.accounts.filter((a) => a.disposable).map((a) => a.email);
    if (
      (await sql`select id from auth.users where email=any(${qaEmails})`).length
    )
      throw Error("QA Auth erasure incomplete");
    const after = await owner(sql);
    if (
      after.hash !== j.ownerHash ||
      after.credentialHash !== j.ownerCredentialHash
    )
      throw Error("Protected owner changed");
    state = await baseline(sql);
    const [counts] =
      await sql`select (select count(*)::int from auth.users) auth_users,(select count(*)::int from public.profiles) profiles,(select count(*)::int from private.social_profiles where user_id is not null and not is_official) member_social_profiles`;
    j.state = "cleaned";
    await save(j);
    await receipt("cleanup", {
      qaAuthErased: true,
      seedSessionsRevoked: true,
      privateCredentialsRedacted: true,
      ownerProfileConsentAndCredentialsUnchanged: true,
      counts,
      state,
    });
    console.log(
      "Disposable QA accounts erased; labelled demo seeds retained; protected owner unchanged and closed guards verified.",
    );
  } catch {
    await receipt("failure", { stage, completed: false });
    console.error(
      `Phase45 operation stopped at ${stage}; details withheld to protect credentials. Review the private journal before retrying.`,
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
