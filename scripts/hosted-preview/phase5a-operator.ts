// Exact-target operator only. Secrets and temporary sessions stay in ignored private-data.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import {
  hostedPreviewDisabledFlags,
  assertHostedPreview,
} from "../../src/core/hosted-preview";
import { validateMarketDataConfig } from "../../src/core/market-data";
import { phase5Hash } from "../../src/core/phase5-hash";
import { marketReferenceV1 } from "../../src/core/market-reference";

const project = "bckkllmndoxzpzdqrevb",
  organization = "ernfnkcbalhyqpsrzdwa";
const directory = "private-data/phase5a",
  journalPath = `${directory}/operator.json`;
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const rights = "the-odds-api-terms-2026-08-31-phase5a-2026-10-04";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
type Journal = {
  runId: string;
  baselineIds: string[];
  baselineHash: string;
  email: string;
  password: string;
  id?: string;
  factorId?: string;
  totpSecret?: string;
  accessToken?: string;
  operatorToken: string;
  trialId?: string;
  configId?: string;
  erased?: boolean;
};
type Sql = ReturnType<typeof db>;
async function save(j: Journal, exclusive = false) {
  await writeFile(journalPath, JSON.stringify(j, null, 2), {
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  });
}
async function receipt(name: string, value: unknown) {
  await mkdir("docs/qa/phase5a/operator", { recursive: true });
  await writeFile(
    `docs/qa/phase5a/operator/${name}.json`,
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
        "snapshot",
        "apply",
        "provision",
        "mfa",
        "configure",
        "metadata",
        "report",
        "permit",
        "cleanup",
      ].includes(mode) ||
      process.argv[3] !== `--confirm-project=${project}`
    )
      throw Error("Exact scope required");
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
    execFileSync("git", ["check-ignore", "--quiet", "--", journalPath], {
      stdio: "ignore",
      windowsHide: true,
    });
    await mkdir(directory, { recursive: true });
    sql = db();
    const [baseline] =
      await sql`select (select count(*)::int from private.feature_flags where enabled) enabled_flags,(select count(*)::int from private.tip_publications) official_records,(select count(*)::int from private.outbox where state='sent') external_sends,(select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals`;
    if (Object.values(baseline).some((v) => v !== 0))
      throw Error("Closed baseline changed");
    const migrations =
      await sql`select version,name from supabase_migrations.schema_migrations order by version`;
    if (mode === "report") {
      stage = "report";
      const trials =
        await sql`select decision,rights_reference,reviewed_at,next_review_at,effective_to,credit_cap,attempt_cap,revoked_at from private.provider_trials`;
      const requests =
        await sql`select scope,reserved_credits,reported_credits,remaining,used,status,started_at,headers_at,completed_at,error_code,diagnostics from private.provider_trial_requests order by started_at`;
      const counts =
        await sql`select e.competition_id,count(distinct e.id)::int events,count(distinct m.id)::int markets,count(distinct q.id)::int snapshots from private.events e join private.market_data_event_mappings map on map.event_id=e.id and map.provider='the-odds-api' left join private.markets m on m.event_id=e.id left join private.odds_snapshots q on q.market_id=m.id and q.provider='the-odds-api' group by e.competition_id order by e.competition_id`;
      const sources =
        await sql`select bookmaker,count(*)::int snapshots,min(source_at) earliest_source,max(source_at) latest_source,min(received_at-source_at)::text minimum_age,max(received_at-source_at)::text maximum_age from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data' group by bookmaker order by bookmaker`;
      const diagnostics =
        await sql`select observed_at,payload from private.provider_trial_diagnostics order by observed_at`;
      const health =
        await sql`select provider,healthy,last_success,last_failure,failure_reason,credits_remaining,credits_used,circuit_until,rights_reference,capabilities,diagnostics from private.source_health where provider='the-odds-api'`;
      const access =
        await sql`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in('provider_trials','provider_trial_permits','provider_trial_requests','provider_trial_diagnostics','market_data_payloads') order by c.relname`;
      await receipt("trial-report", {
        baseline,
        migrationCount: migrations.length,
        trials,
        requests,
        counts,
        sources,
        diagnostics,
        health,
        access,
      });
      console.log(
        JSON.stringify({
          requests: requests.length,
          counts,
          reportedCredits: requests.some((r) => r.reported_credits === null)
            ? null
            : requests.reduce((sum, r) => sum + Number(r.reported_credits), 0),
          remaining: health[0]?.credits_remaining ?? null,
        }),
      );
      return;
    }
    if (mode === "inspect") {
      await receipt("inspect", {
        baseline,
        migrations,
        accounts: (await sql`select count(*)::int n from auth.users`)[0].n,
        providerCalls: false,
      });
      console.log(
        "Exact Docked Preview closed gates verified; no provider call.",
      );
      return;
    }
    if (mode === "snapshot") {
      stage = "snapshot";
      execFileSync(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/hosted-preview/snapshot-before-migration.ts",
          "--snapshot-phase5a",
        ],
        {
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          timeout: 90000,
        },
      );
      console.log("Private recovery preimage saved.");
      return;
    }
    if (mode === "apply") {
      stage = "migration-scope";
      if (
        migrations.length !== 12 ||
        migrations.at(-1)?.version !== "20261003143903" ||
        (await readFile("supabase/.temp/project-ref", "utf8")).trim() !==
          project
      )
        throw Error("Unexpected migration baseline");
      const snapshot = JSON.parse(
        await readFile(
          "private-data/hosted-preview/phase5a-before-migration.json",
          "utf8",
        ),
      );
      if (snapshot.projectRef !== project || snapshot.migrations.length !== 12)
        throw Error("Recovery preimage required");
      const pending = (await readdir("supabase/migrations"))
        .filter(
          (n) =>
            n.endsWith(".sql") && n.slice(0, 14) > migrations.at(-1)!.version,
        )
        .sort();
      if (
        JSON.stringify(pending) !==
        JSON.stringify([
          "20261003214310_production_community_runtime_role.sql",
          "20261003225203_phase5a_manual_provider_trial.sql",
        ])
      )
        throw Error("Unexpected migration scope");
      const ids = (await sql`select id from auth.users order by id`).map((r) =>
          String(r.id),
        ),
        before = await fingerprint(sql, ids);
      const args = [
          "node_modules/supabase/dist/supabase.js",
          "db",
          "push",
          "--linked",
          "--skip-vault",
        ],
        env = {
          ...process.env,
          SUPABASE_DB_PASSWORD: decodeURIComponent(target.password),
        };
      stage = "migration-dry-run";
      const dry = execFileSync(process.execPath, [...args, "--dry-run"], {
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 120000,
      });
      await writeFile(`${directory}/migration-dry-run.txt`, dry, {
        mode: 0o600,
      });
      stage = "migration-apply";
      execFileSync(process.execPath, [...args, "--yes"], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 120000,
      });
      if ((await fingerprint(sql, ids)) !== before)
        throw Error("Existing accounts changed");
      await receipt("migration", {
        pending,
        existingAccountsPreserved: true,
        migrations:
          await sql`select version,name from supabase_migrations.schema_migrations order by version`,
      });
      console.log("Reviewed migrations applied; existing accounts preserved.");
      return;
    }
    if (mode === "provision") {
      stage = "provision-journal";
      const runId = randomUUID();
      const ids = (await sql`select id from auth.users order by id`).map((r) =>
        String(r.id),
      );
      const j: Journal = {
        runId,
        baselineIds: ids,
        baselineHash: await fingerprint(sql, ids),
        email: `docked-phase5a-operator-${runId}@example.invalid`,
        password: randomBytes(32).toString("base64url") + "Aa1!",
        operatorToken: randomBytes(48).toString("base64url"),
      };
      await save(j, true);
      stage = "provision-auth";
      const admin = createClient(connection.supabaseUrl, connection.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.auth.admin.createUser({
        email: j.email,
        password: j.password,
        email_confirm: true,
        app_metadata: {
          qa_fixture: true,
          phase5a_run_id: runId,
          preview_operator_provisioned: true,
          email_ownership_verified: false,
        },
      });
      if (error || !data.user || data.user.email !== j.email)
        throw Error("Provision failed");
      j.id = data.user.id;
      await save(j);
      stage = "provision-role";
      await sql.begin(async (tx) => {
        await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at,timezone) values(${j.id!},'XX','PHASE5A_QA',true,'phase5a-synthetic-qa',clock_timestamp(),'Australia/Sydney')`;
        await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education) values(${j.id!},true,'off',false,false)`;
        await tx`insert into private.roles(user_id,role) values(${j.id!},'admin')`;
        await tx`insert into private.audit_events(actor,action,subject,details) values('phase5a-operator','disposable_qa_role',${j.id!},${tx.json({ runId, role: "admin", synthetic: true, noEmail: true })})`;
      });
      await receipt("provision", {
        syntheticOperator: true,
        emailsSent: 0,
        existingAccountsPreserved:
          (await fingerprint(sql, j.baselineIds)) === j.baselineHash,
      });
      console.log(
        "Disposable private operator created; no email or sporting record.",
      );
      return;
    }
    const j: Journal = JSON.parse(await readFile(journalPath, "utf8"));
    if (
      !j.id ||
      j.erased ||
      j.baselineIds.includes(j.id) ||
      j.email !== `docked-phase5a-operator-${j.runId}@example.invalid`
    )
      throw Error("Operator scope denied");
    if (mode === "mfa") {
      stage = "password-login";
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
        throw Error("Login failed");
      if (!j.factorId) {
        stage = "mfa-enroll";
        const factor = await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Disposable Phase5A operator",
        });
        if (factor.error || !factor.data?.totp)
          throw Error("MFA enrollment failed");
        j.factorId = factor.data.id;
        j.totpSecret = factor.data.totp.secret;
        await save(j);
      }
      stage = "mfa-verify";
      const verified = await client.auth.mfa.challengeAndVerify({
        factorId: j.factorId,
        code: totp(j.totpSecret!),
      });
      if (verified.error || !verified.data.access_token)
        throw Error("MFA verification failed");
      const claims = JSON.parse(
        Buffer.from(
          verified.data.access_token.split(".")[1],
          "base64url",
        ).toString(),
      );
      if (
        claims.aal !== "aal2" ||
        claims.sub !== j.id ||
        claims.iss !== `${connection.supabaseUrl}/auth/v1`
      )
        throw Error("MFA identity mismatch");
      j.accessToken = verified.data.access_token;
      await save(j);
      await receipt("mfa", {
        genuineSupabaseSession: true,
        aal: "aal2",
        tokensWithheld: true,
      });
      console.log("Genuine disposable administrator MFA session verified.");
      return;
    }
    if (mode === "cleanup") {
      stage = "cleanup";
      const [u] =
        await sql`select id,email,raw_app_meta_data from auth.users where id=${j.id}`;
      if (
        u &&
        (u.email !== j.email ||
          u.raw_app_meta_data?.qa_fixture !== true ||
          u.raw_app_meta_data?.phase5a_run_id !== j.runId)
      )
        throw Error("Cleanup marker mismatch");
      if ((await fingerprint(sql, j.baselineIds)) !== j.baselineHash)
        throw Error("Existing account drift");
      if (u) {
        await sql`select private.disable_account(${j.id})`;
        await processAccountDeletion(j.id);
        await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp() where kind='account_deletion' and dedupe_key=${`account-deletion:${j.id}`}`;
      }
      const [left] =
        await sql`select (select count(*)::int from auth.users where id=${j.id}) users,(select count(*)::int from auth.sessions where user_id=${j.id}) sessions,(select count(*)::int from private.roles where user_id=${j.id}) roles`;
      if (Object.values(left).some((v) => v !== 0))
        throw Error("Erasure incomplete");
      j.erased = true;
      j.password = "[ERASED]";
      delete j.accessToken;
      delete j.totpSecret;
      j.operatorToken = "[REVOKED]";
      await save(j);
      await receipt("cleanup", {
        ...left,
        existingAccountsPreserved:
          (await fingerprint(sql, j.baselineIds)) === j.baselineHash,
      });
      console.log(
        "Temporary operator erased and sessions revoked; audit evidence retained.",
      );
      return;
    }
    stage = "verified-session";
    const client = createClient(
      connection.supabaseUrl,
      connection.publishableKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const verified = await client.auth.getUser(j.accessToken);
    if (verified.error || verified.data.user?.id !== j.id)
      throw Error("Genuine session required");
    const claims = JSON.parse(
      Buffer.from(j.accessToken!.split(".")[1], "base64url").toString(),
    );
    if (
      claims.aal !== "aal2" ||
      claims.sub !== j.id ||
      claims.exp * 1000 <= Date.now()
    )
      throw Error("Current MFA required");
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify(claims)},true)`;
      await tx`select private.scanner_assert_actor(true)`;
      if (mode === "metadata") {
        stage = "metadata";
        const [record] =
          await tx`select * from private.market_data_config where id=${j.configId!} and provider='the-odds-api' and enabled for share`;
        if (!record) throw Error("Reviewed configuration required");
        const config = validateMarketDataConfig(record.configuration);
        for (const c of config.competitions) {
          await tx`insert into private.sports(id,name,enabled) values(${c.sport},${c.sport === "football" ? "Football" : c.sport === "basketball" ? "Basketball" : "American football"},false) on conflict do nothing`;
          await tx`insert into private.competitions(id,sport_id,enabled,rules) values(${c.competitionId},${c.sport},false,${tx.json({ provider: "the-odds-api", providerCompetitionId: c.providerCompetitionId, mappingEvidence: c.mappingEvidence, trialOnly: true, marketScope: c.sport === "nfl" ? "fixtures_only" : "h2h" })}) on conflict do nothing`;
          if (
            !(
              await tx`select 1 from private.competitions where id=${c.competitionId} and sport_id=${c.sport}`
            )[0]
          )
            throw Error("Taxonomy mapping mismatch");
        }
        const capability = {
          kind: "account_capability",
          plan: "FREE",
          historical: "NOT_INCLUDED",
          source: "owner_confirmation",
          evidenceReference: "Owner confirmation 2026-10-04",
          monthlyPublishedCredits: 500,
        };
        await tx`insert into private.provider_trial_diagnostics(trial_id,payload) values(${j.trialId!},${tx.json(capability)})`;
        await tx`insert into private.audit_events(actor,action,subject,details) values(${j.id!},'phase5a_account_capability',${j.trialId!},${tx.json(capability)})`;
      } else if (mode === "configure") {
        stage = "configure";
        const now = (await tx`select clock_timestamp() at`)[0].at.toISOString(),
          expiry = "2026-11-03T13:00:00.000Z";
        const bookIds = [
          "betfair_ex_au",
          "betr_au",
          "betright",
          "bet365_au",
          "dabble_au",
          "ladbrokes_au",
          "neds",
          "playup",
          "pointsbetau",
          "sportsbet",
          "tab",
          "tabtouch",
          "unibet",
        ];
        const config = validateMarketDataConfig({
          version: "market-data-v1.0.0",
          provider: "the-odds-api",
          rights: {
            reference: rights,
            display: true,
            storage: true,
            derived: true,
            rawRetentionDays: 7,
          },
          monthlyCreditLimit: 250,
          pollIntervalSeconds: 900,
          horizonHours: 168,
          maxEvents: 50,
          maxRequestsPerRun: 1,
          regions: ["au"],
          competitions: [
            {
              providerCompetitionId: "soccer_epl",
              competitionId: "soccer_epl",
              sport: "football",
              displayName: "Premier League",
              mappingEvidence:
                "First-party V4 sports identity; regulation full-time h2h, excludes extra time",
            },
            {
              providerCompetitionId: "soccer_spain_la_liga",
              competitionId: "soccer_spain_la_liga",
              sport: "football",
              displayName: "La Liga",
              mappingEvidence:
                "First-party V4 sports identity; regulation full-time h2h, excludes extra time",
            },
            {
              providerCompetitionId: "basketball_nba",
              competitionId: "basketball_nba",
              sport: "basketball",
              displayName: "NBA",
              mappingEvidence:
                "First-party h2h basketball full-game includes overtime; no regulation variant",
            },
            {
              providerCompetitionId: "americanfootball_nfl",
              competitionId: "americanfootball_nfl",
              sport: "nfl",
              displayName: "NFL",
              mappingEvidence:
                "First-party sports key; fixtures only, tie/overtime moneyline mapping NOT APPROVED",
            },
          ],
          bookmakers: Object.fromEntries(
            bookIds.map((id) => [
              id,
              {
                operator: "unreviewed-shared",
                ownershipEvidence:
                  "UNKNOWN ownership/trading relationships: conservatively pooled, never counted as independent sources",
                sourceType: id === "betfair_ex_au" ? "exchange" : "bookmaker",
                classification: "UNKNOWN_REVIEW",
                classificationVersion: "phase5a-unverified-v1",
                classificationEvidence:
                  "Provider identifier documented; no affirmative evidence that this particular quote is unboosted standard pricing",
                knownAt: now,
                effectiveFrom: now,
                effectiveTo: expiry,
              },
            ]),
          ),
          referenceConfiguration: marketReferenceV1,
        });
        const [c] =
          await tx`insert into private.market_data_config(provider,version,config_hash,configuration,enabled,effective_from,effective_to,rights_reference,reviewed_by) values('the-odds-api',${config.version},${phase5Hash(config)},${tx.json(config)},true,${now},${expiry},${rights},${j.id!}) returning id`;
        const links = [
          "https://the-odds-api.com/terms-and-conditions.html",
          "https://the-odds-api.com/liveapi/guides/v4/",
          "https://the-odds-api.com/historical-odds-data/",
          "https://the-odds-api.com/#pricing",
        ];
        const [t] =
          await tx`insert into private.provider_trials(provider,project_ref,rights_reference,decision,reviewed_at,next_review_at,effective_to,reviewed_by,evidence_links,scopes,credit_cap,attempt_cap) values('the-odds-api',${project},${rights},'APPROVED_FOR_PREVIEW_TRIAL',${now},${expiry},${expiry},${j.id!},${tx.json(links)},${tx.json({ display: true, storage: true, derived: true, auditRetention: true, manualOnly: true, resultsInspection: true, rawRetentionDays: 7 })},250,25) returning id`;
        await tx`insert into private.source_health(provider,rights_reference,capabilities) values('the-odds-api',${rights},${tx.json({ display: true, retention: true, derived: true, community_standard_prices: false })}) on conflict(provider) do update set rights_reference=excluded.rights_reference,capabilities=excluded.capabilities`;
        await tx`insert into private.audit_events(actor,action,subject,details) values(${j.id!},'phase5a_source_rights','the-odds-api',${tx.json({ rightsReference: rights, termsDate: "2026-08-31", standardPricesApproved: false })})`;
        j.configId = String(c.id);
        j.trialId = String(t.id);
      } else if (mode === "permit") {
        stage = "permit";
        const operation = process.argv[4],
          competition = process.argv[5] ?? null;
        if (
          !["sports", "events", "odds", "scores"].includes(operation) ||
          (operation === "sports"
            ? competition !== null
            : ![
                "soccer_epl",
                "soccer_spain_la_liga",
                "basketball_nba",
                "americanfootball_nfl",
              ].includes(competition!))
        )
          throw Error("Fixed trial scope required");
        const [p] =
          await tx`insert into private.provider_trial_permits(trial_id,token_hash,operation,competition,config_id,expires_at,created_by) values(${j.trialId!},${hash(j.operatorToken)},${operation},${competition},${operation === "sports" ? null : j.configId!},clock_timestamp()+interval '25 minutes',${j.id!}) returning id`;
        await writeFile(
          `${directory}/pending-permit.json`,
          JSON.stringify({ permitId: p.id, operation, competition }),
          { mode: 0o600 },
        );
      }
    });
    await save(j);
    await receipt(mode, {
      operation: process.argv[4] ?? null,
      competition: process.argv[5] ?? null,
      operatorMfa: true,
      noProviderCall: true,
    });
    console.log(
      `${mode} completed with genuine administrator MFA; no provider call.`,
    );
  } catch (error) {
    await writeFile(
      `${directory}/operator-error.json`,
      JSON.stringify({
        stage,
        code: (error as { code?: string }).code,
        message: error instanceof Error ? error.message : "Unknown",
      }),
      { mode: 0o600 },
    ).catch(() => {});
    console.error(
      `Phase5A operator stopped at ${stage}; private details withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
