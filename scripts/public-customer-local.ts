/** Disposable local Auth acceptance. Never loads hosted credentials or targets. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import postgres from "postgres";
import { sportConfigurations } from "../src/core/sport-configuration";
import { approvedAustralianLineup } from "../src/core/approved-australian-rules";
import { nflSeven } from "../src/core/nfl-seven";
const dir = "private-data/deletion-auth-local";
const raw = readFileSync(`${dir}/status.private.json`, "utf8");
const settings = JSON.parse(
  raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
);
const fixture = JSON.parse(readFileSync(`${dir}/fixture.private.json`, "utf8"));
assert.equal(new URL(settings.DB_URL).origin, "null");
assert.equal(new URL(settings.DB_URL).hostname, "127.0.0.1");
assert.equal(new URL(settings.DB_URL).port, "54322");
assert.equal(settings.API_URL, "http://127.0.0.1:54321");
const sql = postgres(settings.DB_URL, { max: 1, onnotice: () => {} });
const file = `${dir}/public-customer.private.json`;
async function run() {
  if (process.argv[2] === "prepare") {
    if (existsSync(file)) {
      console.log("Existing isolated public fixture retained");
      return;
    }
    const rounds: Record<string, string[]> = {};
    const season = "2026 Practice",
      until = new Date(Date.now() + 14 * 86400000).toISOString(),
      lock = new Date(Date.now() + 7 * 86400000).toISOString();
    await sql.begin(async (tx) => {
      await tx`select set_config('docked.multi_sport','isolated-preview',true)`;
      await tx`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence,features)values('AU','NSW','isolated-public-20261102',clock_timestamp()-interval '1 minute',${until},${until},true,18,'ISOLATED local acceptance, not a regulatory approval',array['community_social','public_profiles']) on conflict do nothing`;
      await tx`update public_gameplay.policy set enabled=true,terms_version='2026-10-draft',privacy_version='2026-10-draft',valid_until=${until},authority='Isolated local acceptance only, not public activation'`;
      await tx`update public_gameplay.sports set visible=true,play_enabled=true`;
      await tx`update private.feature_flags set enabled=true where key='registration'`;
      await tx`insert into beta_fantasy.scoring_rules(version,rules)values('isolated-public-awaiting-v1','{}') on conflict do nothing`;
      for (const sport of ["nfl", "afl", "nrl"] as const) {
        const configuration =
          sport === "nfl"
            ? {
                ...nflSeven,
                version: "isolated-public-nfl-v1",
                sport,
                inventoryScope: "isolated-multi-sport-v1",
                lockPolicy: "round-wide-v1",
              }
            : approvedAustralianLineup(sport);
        await tx`insert into beta_fantasy.lineup_configurations values(${configuration.version},${tx.json(configuration)}) on conflict do nothing`;
        const players = [];
        for (const [i, slot] of [
          ...sportConfigurations[sport].slots,
          sportConfigurations[sport].slots[0],
        ].entries()) {
          const id = randomUUID();
          players.push(id);
          await tx`insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season) values(${id},${`Synthetic ${sport.toUpperCase()} Player ${i + 1}`},${sport},${slot.positions[0]},'Isolated fixture','#1759a3',1,${season})`;
          await tx`insert into sports_feed.free_core_roster values(${id},${sport},${season},${tx.json([slot.positions[0]])},${until},'https://example.invalid/isolated-local-roster',${"a".repeat(64)},true)`;
        }
        await tx`update sports_feed.free_core_programmes set enabled=true where sport=${sport}`;
        rounds[sport] = [];
        for (const mode of ["SALARY_CAP", "OPEN"]) {
          const id = randomUUID();
          rounds[sport].push(id);
          const rules = {
            mode,
            lineup_version: configuration.version,
            scoring_version: "isolated-public-awaiting-v1",
            inventory_scope: configuration.inventoryScope,
            lock_policy: "round-wide-v1",
            free_core_policy: "public-free-core-v1",
            public_access_policy: "au-adult-free-play-v1",
            entry_fee_credits: 0,
          };
          await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize,awards) values(${id},${`${sport.toUpperCase()} free practice`},${sport},${season},1,${lock},${tx.json(rules)},(select id from beta_fantasy.scoring_rules where version='isolated-public-awaiting-v1'),'No cash prize','[]')`;
          const games = [
            {
              fixtureId: `sim:${sport}:${id}`,
              scheduledAt: lock,
              status: "scheduled",
              playerIds: players,
            },
          ];
          await tx`insert into public_gameplay.rounds(competition_id,sport,enabled,rules_hash,fixtures,fixture_kind,source_reference) select id,sport,true,md5(rules::text),${tx.json(games)},'practice','Isolated synthetic local acceptance' from beta_fantasy.competitions where id=${id}`;
        }
      }
    });
    // Local-only equivalent of the narrow production Auth projections.
    execFileSync(
      "C:/Users/61412/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe",
      [
        "exec",
        "supabase_db_deletion-auth-local",
        "psql",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "grant select(id,email,email_confirmed_at,is_anonymous,banned_until) on auth.users to docked_app; drop policy if exists isolated_app_user_check on auth.users; create policy isolated_app_user_check on auth.users for select to docked_app using(true);",
      ],
      { windowsHide: true, stdio: "pipe" },
    );
    writeFileSync(
      file,
      JSON.stringify({
        email: `public-${Date.now()}@public-acceptance.invalid`,
        password: randomBytes(24).toString("base64url"),
        rounds,
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        prepared: true,
        sports: Object.keys(rounds),
        rounds: 6,
        paid: false,
        hosted: false,
      }),
    );
  } else if (process.argv[2] === "reapply-public-migration") {
    const version = "20261102010001";
    const source = readFileSync(
      `supabase/migrations/${version}_public_customer_gameplay.sql`,
      "utf8",
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(source);
      await tx`update deletion_acceptance.migrations set hash=${createHash("sha256").update(source).digest("hex")} where version=${version}`;
    });
    console.log(
      "Reapplied the unshipped public migration to loopback acceptance only",
    );
  } else if (process.argv[2] === "report") {
    const customer = JSON.parse(readFileSync(file, "utf8"));
    const [who] =
      await sql`select id from auth.users where email=${customer.email}`;
    assert.ok(who, "Complete normal signup and confirmation first");
    const entries =
      await sql`select c.sport,count(*)::int entries,max(jsonb_array_length(e.snapshot)) slots from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=${who.id} group by c.sport order by c.sport`;
    const [record] = await sql`select
      (select count(*)::int from commercial_billing.cards where owner_id=${who.id}) collectible_cards,
      (select count(*)::int from commercial_billing.receipts where member_id=${who.id}) purchase_receipts,
      (select count(*)::int from commercial_billing.packs where member_id=${who.id}) purchased_packs,
      (select coalesce(sum(remaining),0)::int from commercial_billing.lots where member_id=${who.id}) credits,
      (select email_confirmed_at is not null from auth.users where id=${who.id}) confirmed`;
    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          environment: "isolated-local-auth",
          synthetic: true,
          entries,
          ...record,
        },
        null,
        2,
      ),
    );
  } else if (process.argv[2] === "read-only-commerce") {
    const current = JSON.parse(readFileSync(file, "utf8"));
    if (!current.commercialRuntime) {
      const password = randomBytes(24).toString("hex");
      await sql.unsafe(
        `create role isolated_public_commercial login password '${password}' nosuperuser nobypassrls`,
      );
      await sql`grant docked_commercial_app to isolated_public_commercial`;
      const runtime = new URL(settings.DB_URL);
      runtime.username = "isolated_public_commercial";
      runtime.password = password;
      current.commercialRuntime = runtime.href;
      current.binding = randomBytes(32).toString("hex");
      current.referenceKey = randomBytes(32).toString("hex");
      writeFileSync(file, JSON.stringify(current), { mode: 0o600 });
    }
    console.log(
      "Isolated read-only commercial runtime prepared; checkout and issuance remain disabled",
    );
  } else if (process.argv[2] === "community-policy") {
    await sql`update private.region_policies set features=array['community_social','public_profiles'] where version='isolated-public-20261102' and evidence='ISOLATED local acceptance, not a regulatory approval'`;
    console.log("Isolated local community policy prepared");
  } else if (process.argv[2] === "serve") {
    const env = { ...process.env };
    for (const k of Object.keys(env))
      if (
        /^(DOCKED_|NEXT_PUBLIC_SUPABASE|SUPABASE_|DATABASE_|APP_ENV|VERCEL|BETA_|FANTASY_)/.test(
          k,
        )
      )
        delete env[k];
    Object.assign(env, {
      APP_ENV: "development",
      SUPABASE_ENV: "isolated",
      SITE_URL: "http://127.0.0.1:3038",
      DATABASE_URL: fixture.runtime,
      NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
      SUPABASE_SECRET_KEY: settings.SERVICE_ROLE_KEY,
      DOCKED_HOSTED_PRODUCTION: "false",
      DOCKED_HOSTED_PREVIEW: "false",
      DOCKED_HOSTED_REVIEW: "false",
      DOCKED_BETA_STAGING: "false",
      DOCKED_OWNER_GAMEPLAY: "false",
      DOCKED_PUBLIC_CUSTOMERS: "true",
      REGISTRATION_ENABLED: "true",
      SENDING_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    });
    const customer = JSON.parse(readFileSync(file, "utf8"));
    if (customer.commercialRuntime)
      Object.assign(env, {
        DOCKED_COMMERCIAL_SERVICE: "true",
        DOCKED_COMMERCIAL_SURFACES: "true",
        DOCKED_COMMERCIAL_CHECKOUT: "false",
        DOCKED_COMMERCIAL_DATABASE_URL: customer.commercialRuntime,
        DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET: customer.binding,
        DOCKED_COMMERCIAL_REFERENCE_KEY: customer.referenceKey,
      });
    const child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        process.argv.includes("--built") ? "start" : "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3038",
      ],
      { env, stdio: "inherit", windowsHide: true },
    );
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } else throw Error("Expected prepare or serve");
}
run()
  .finally(() => sql.end())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
