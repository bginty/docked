// Exact Preview acceptance only; never configures models, providers, trials or email.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import {
  assertHostedPreview,
  hostedPreviewDisabledFlags,
} from "../../src/core/hosted-preview";
import {
  assertPhase5dAccount,
  assertPhase5dConnection,
  phase5dProject as project,
  phase5dOrigin as origin,
  type Phase5dJournal as Journal,
} from "./phase5d-scope";
const directory = "private-data/phase5d",
  journalPath = directory + "/operator.json";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Sql = ReturnType<typeof db>;
async function save(j: Journal, exclusive = false) {
  await writeFile(journalPath, JSON.stringify(j, null, 2), {
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  });
}
async function receipt(name: string, value: unknown) {
  await mkdir("docs/qa/phase5d/operator", { recursive: true });
  await writeFile(
    "docs/qa/phase5d/operator/" + name + ".json",
    JSON.stringify(
      { projectRef: project, recordedAt: new Date().toISOString(), value },
      null,
      2,
    ) + "\n",
  );
}
async function fingerprint(sql: Sql, ids: string[]) {
  return hash(
    JSON.stringify(
      await sql`select u.id,u.email,u.encrypted_password,u.raw_app_meta_data,u.raw_user_meta_data,u.email_confirmed_at,u.banned_until,
    (select to_jsonb(p) from public.profiles p where p.id=u.id) profile,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.role),'[]') from private.roles r where r.user_id=u.id) roles,
    (select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from private.preview_tester_access g where g.user_id=u.id) grants
    from auth.users u where u.id=any(${ids}::uuid[]) order by u.id`,
    ),
  );
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")]
    .map((c) => {
      const n = alphabet.indexOf(c);
      if (n < 0) throw Error("TOTP encoding");
      return n.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return ((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  let sql: Sql | undefined,
    stage = "identity";
  try {
    const mode = process.argv[2];
    if (
      ![
        "inspect",
        "provision",
        "mfa",
        "member-only",
        "verify",
        "cleanup",
      ].includes(mode) ||
      process.argv[3] !== `--confirm-project=${project}`
    )
      throw Error("Exact mode and project required");
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    assertPhase5dConnection(connection);
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
      MARKET_DATA_POLLING_ENABLED: "false",
      EDGE_SCANNER_ENABLED: "false",
      RESEARCH_AUTOMATION_ENABLED: "false",
      AUTO_PUBLISH_DOCKED_EDGES: "false",
      AUTH_EMAIL_ENABLED: "false",
    });
    for (const flag of hostedPreviewDisabledFlags) process.env[flag] = "false";
    assertHostedPreview(process.env);
    execFileSync("git", ["check-ignore", "--quiet", "--", journalPath], {
      stdio: "ignore",
      windowsHide: true,
    });
    await mkdir(directory, { recursive: true });
    sql = db();
    const migrations =
      await sql`select version,name from supabase_migrations.schema_migrations order by version`;
    if (
      migrations.length !== 18 ||
      migrations.at(-1)?.version !== "20261004044506"
    )
      throw Error("Reviewed migration18 required");
    const [closed] =
      await sql`select (select count(*)::int from private.feature_flags where enabled) enabled_flags,(select count(*)::int from private.tip_publications) publications,(select count(*)::int from private.outbox where state='sent') external_sends,(select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals,(select count(*)::int from private.football_model_versions) model_versions,(select count(*)::int from private.football_model_attempts) predictions,(select count(*)::int from private.football_sporting_inputs) sporting_inputs,(select count(*)::int from private.football_model_implementations) fitted_models,(select count(*)::int from private.official_record_boundary) official_start,(select count(*)::int from private.research_source_versions) research_sources,(select count(*)::int from private.research_facts) research_facts,(select count(*)::int from private.research_match_snapshots) research_snapshots,(select count(*)::int from private.research_content) research_content,(select count(*)::int from private.research_fetch_requests) research_fetches`;
    const permanentClosed = [
      "enabled_flags",
      "publications",
      "external_sends",
      "ordinary_approvals",
      "official_start",
      "research_sources",
      "research_facts",
      "research_snapshots",
      "research_content",
      "research_fetches",
    ];
    if (
      permanentClosed.some((key) => closed[key] !== 0) ||
      (mode === "provision" && Object.values(closed).some((v) => v !== 0))
    )
      throw Error("Closed publication baseline changed");
    const acl =
      await sql`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') member_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and(c.relname like 'research_%' or c.relname like 'football_%' or c.relname in('official_record_boundary','official_docked_publications')) order by c.relname`;
    if (
      acl.length !== 25 ||
      acl.some((r) => !r.relrowsecurity || r.anon_access || r.member_access)
    )
      throw Error("Model RLS/ACL mismatch");
    const functions =
      await sql`select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') member_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and(p.proname like 'research_%' or p.proname like '%_research_%' or p.proname like 'football_%' or p.proname like '%_football_%' or p.proname in('official_record_insert_guard','record_official_football')) order by p.proname`;
    if (
      functions.length === 0 ||
      functions.some((r) => r.anon_execute || r.member_execute)
    )
      throw Error("Model function ACL mismatch");
    if (mode === "inspect") {
      await receipt("inspect", {
        migrations,
        closed,
        acl,
        functions,
        authAccounts: Number(
          (await sql`select count(*)::int n from auth.users`)[0].n,
        ),
        providerRequests: 0,
      });
      console.log(
        "Exact Preview migration18, empty model ledger and browser ACLs verified.",
      );
      return;
    }
    if (mode === "provision") {
      stage = "provision-journal";
      const ids = (await sql`select id from auth.users order by id`).map((r) =>
        String(r.id),
      );
      if (ids.length !== 4)
        throw Error("Expected four protected original accounts");
      const runId = randomUUID();
      const j: Journal = {
        runId,
        createdAt: new Date().toISOString(),
        baselineIds: ids,
        baselineHash: await fingerprint(sql, ids),
        email: `docked-phase5d-operator-${runId}@example.invalid`,
        password: randomBytes(32).toString("base64url") + "Aa1!",
      };
      assertPhase5dAccount(j, false);
      await save(j, true);
      stage = "provision-auth";
      const admin = createClient(connection.supabaseUrl, connection.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const created = await admin.auth.admin.createUser({
        email: j.email,
        password: j.password,
        email_confirm: true,
        app_metadata: {
          qa_fixture: true,
          phase5d_run_id: runId,
          preview_operator_provisioned: true,
          email_ownership_verified: false,
        },
      });
      if (
        created.error ||
        !created.data.user ||
        created.data.user.email !== j.email
      )
        throw Error("Provision failed");
      j.id = created.data.user.id;
      await save(j);
      assertPhase5dAccount(j);
      stage = "provision-role";
      await sql.begin(async (tx) => {
        await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at,timezone)values(${j.id!},'XX','PHASE5C_QA',true,'phase5d-synthetic-qa',clock_timestamp(),'Australia/Sydney')`;
        await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education)values(${j.id!},true,'off',false,false)`;
        await tx`insert into private.roles(user_id,role)values(${j.id!},'admin')`;
        await tx`insert into private.audit_events(actor,action,subject,details)values('phase5d-operator','disposable_qa_role',${j.id!},${tx.json({ runId, role: "admin", synthetic: true, noEmail: true })})`;
      });
      if ((await fingerprint(sql, ids)) !== j.baselineHash)
        throw Error("Protected account drift");
      await receipt("provision", {
        disposableAccountsCreated: 1,
        originalAccountsPreserved: 4,
        emailsSent: 0,
        modelsCreated: 0,
      });
      console.log(
        "Disposable Phase5D operator provisioned; protected accounts unchanged.",
      );
      return;
    }
    const j: Journal = JSON.parse(await readFile(journalPath, "utf8"));
    assertPhase5dAccount(j);
    if ((await fingerprint(sql, j.baselineIds)) !== j.baselineHash)
      throw Error("Protected account drift");
    const [u] =
      await sql`select id,email,raw_app_meta_data from auth.users where id=${j.id!}`;
    if (
      u &&
      (u.email !== j.email ||
        u.raw_app_meta_data?.qa_fixture !== true ||
        u.raw_app_meta_data?.phase5d_run_id !== j.runId)
    )
      throw Error("Disposable identity marker mismatch");
    if (!u && mode !== "cleanup") throw Error("Disposable identity missing");
    if (mode === "mfa") {
      stage = "genuine-password-login";
      const client = createClient(
        connection.supabaseUrl,
        connection.publishableKey,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const login = await client.auth.signInWithPassword({
        email: j.email,
        password: j.password,
      });
      if (login.error || login.data.user?.id !== j.id)
        throw Error("Genuine login failed");
      if (!j.factorId) {
        stage = "mfa-enroll";
        const f = await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Disposable Phase5D operator",
        });
        if (f.error || !f.data?.totp) throw Error("Enrollment failed");
        j.factorId = f.data.id;
        j.totpSecret = f.data.totp.secret;
        await save(j);
      }
      stage = "mfa-verify";
      const v = await client.auth.mfa.challengeAndVerify({
        factorId: j.factorId,
        code: totp(j.totpSecret!),
      });
      if (v.error || !v.data.access_token) throw Error("Genuine MFA failed");
      const claims = JSON.parse(
        Buffer.from(v.data.access_token.split(".")[1], "base64url").toString(),
      );
      if (
        claims.aal !== "aal2" ||
        claims.sub !== j.id ||
        claims.iss !== `${connection.supabaseUrl}/auth/v1`
      )
        throw Error("MFA identity mismatch");
      j.accessToken = v.data.access_token;
      await save(j);
      await receipt("mfa", {
        genuineSession: true,
        aal: "aal2",
        tokensWithheld: true,
      });
      console.log("Genuine disposable MFA verified.");
      return;
    }
    if (mode === "member-only") {
      stage = "withdraw-own-role";
      await sql.begin(async (tx) => {
        await tx`delete from private.roles where user_id=${j.id!}`;
        await tx`insert into private.audit_events(actor,action,subject,details)values('phase5d-operator','disposable_qa_role_withdrawal',${j.id!},${tx.json({ runId: j.runId, reason: "Actual member-denial acceptance; existing accounts untouched" })})`;
      });
      j.memberOnly = true;
      await save(j);
      await receipt("member-only", {
        disposableStaffRoleRemoved: true,
        originalAccountsPreserved: true,
      });
      console.log(
        "Only disposable operator role withdrawn; actual member denial may now be tested.",
      );
      return;
    }
    if (mode === "cleanup") {
      if (process.argv[4] !== "--qa-released")
        throw Error("Explicit QA release required");
      stage = "cleanup";
      if (u) {
        await sql`select private.disable_account(${j.id!})`;
        await processAccountDeletion(j.id!);
        await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp() where kind='account_deletion' and dedupe_key=${`account-deletion:${j.id}`}`;
      }
      const [residue] =
        await sql`select (select count(*)::int from auth.users where id=${j.id!}) users,(select count(*)::int from auth.sessions where user_id=${j.id!}) sessions,(select count(*)::int from public.profiles where id=${j.id!}) profiles,(select count(*)::int from private.roles where user_id=${j.id!}) roles,(select count(*)::int from private.preview_tester_access where user_id=${j.id!}) grants`;
      if (
        Object.values(residue).some((v) => v !== 0) ||
        (await fingerprint(sql, j.baselineIds)) !== j.baselineHash
      )
        throw Error("Erasure or protected fingerprint incomplete");
      j.erased = true;
      j.password = "[ERASED]";
      delete j.accessToken;
      delete j.totpSecret;
      await save(j);
      await receipt("cleanup", {
        residue,
        originalAccountsPreserved: 4,
        authAccounts: Number(
          (await sql`select count(*)::int n from auth.users`)[0].n,
        ),
        closed,
        migrationCount: migrations.length,
        providerRequests: 0,
      });
      console.log(
        "Disposable operator erased; four original accounts and closed model state preserved.",
      );
      return;
    }
    await receipt("verify", {
      closed,
      acl,
      functions,
      originalAccountsPreserved: 4,
      disposableStaffRoles: Number(
        (
          await sql`select count(*)::int n from private.roles where user_id=${j.id!}`
        )[0].n,
      ),
      providerRequests: 0,
    });
    console.log(
      "Read-only model state and protected account fingerprints verified.",
    );
  } catch {
    await receipt(`failure-${Date.now()}`, {
      status: "FAIL",
      stage,
      detailsWithheld: true,
    });
    console.error(
      `Phase5D operator stopped at ${stage}; sensitive details withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
