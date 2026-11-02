/** Isolated hosted fixtures; no Production connection, customer, credit or card. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
import { sportConfigurations } from "../src/core/sport-configuration";
import { approvedAustralianLineup } from "../src/core/approved-australian-rules";
import { nflSeven } from "../src/core/nfl-seven";
const dir = "private-data/restored-public-preview",
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
mkdirSync(dir, { recursive: true });
const ref = "bckkllmndoxzpzdqrevb",
  origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const c = JSON.parse(
  readFileSync(main + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, ref);
const u = new URL(c.databaseUrl);
assert.equal(u.username, `postgres.${ref}`);
assert.equal(u.port, "5432");
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function mainRun() {
  assert.equal(process.argv[2], "--prepare-isolated-only");
  if (existsSync(dir + "/fixture.private.json")) {
    console.log("Existing acceptance fixtures retained");
    return;
  }
  assert(
    JSON.parse(
      readFileSync(
        "docs/qa/launch-resolution-20261102/preview-migrations.json",
        "utf8",
      ),
    ).integrityPassed !== false,
  );
  const authExpires = new Date(Date.now() + 23 * 3600000).toISOString();
  const runtimePassword = randomBytes(32).toString("hex"),
    commercePassword = randomBytes(32).toString("hex");
  const accounts = ["member", "deletion"].map((kind) => ({
    kind,
    email: `docked-preview-public-${kind}-${randomBytes(5).toString("hex")}@example.invalid`,
    password: randomBytes(24).toString("base64url"),
  }));
  const rounds: Record<string, string[]> = {},
    season = "2026 Acceptance Practice",
    expires = new Date(Date.now() + 7 * 86400000).toISOString(),
    lock = new Date(Date.now() + 3 * 86400000).toISOString();
  await sql.begin(async (tx) => {
    assert.equal(
      (await tx`select enabled from public_gameplay.policy where id`)[0]
        .enabled,
      false,
    );
    await tx.unsafe(
      `create role docked_public_acceptance login password '${runtimePassword}' nosuperuser nobypassrls in role docked_app`,
    );
    await tx.unsafe(
      `create role docked_isolated_commercial login password '${commercePassword}' nosuperuser nobypassrls in role docked_commercial_app`,
    );
    await tx`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence,features)values('AU','NSW','isolated-hosted-public-20261102',clock_timestamp()-interval '1 minute',${expires},${expires},true,18,'ISOLATED HOSTED acceptance; not a regional legal approval',array['community_social','public_profiles'])`;
    await tx`update public_gameplay.policy set enabled=true,terms_version='2026-10-draft',privacy_version='2026-10-draft',valid_until=${expires},authority='Owner authorised isolated hosted acceptance 2026-11-02'`;
    await tx`update public_gameplay.sports set visible=true,play_enabled=true`;
    await tx`update private.feature_flags set enabled=true where key='registration'`;
    await tx`insert into beta_fantasy.scoring_rules(version,rules)values('isolated-hosted-awaiting-v1','{}') on conflict do nothing`;
    for (const sport of ["nfl", "afl", "nrl"] as const) {
      const config =
        sport === "nfl"
          ? {
              ...nflSeven,
              version: "isolated-hosted-nfl-v1",
              sport,
              inventoryScope: "isolated-multi-sport-v1",
              lockPolicy: "round-wide-v1",
            }
          : approvedAustralianLineup(sport);
      await tx`insert into beta_fantasy.lineup_configurations(version,configuration) values(${config.version},${tx.json(config)}) on conflict do nothing`;
      const players = [];
      for (const [i, slot] of [
        ...sportConfigurations[sport].slots,
        sportConfigurations[sport].slots[0],
      ].entries()) {
        const id = randomUUID();
        players.push(id);
        await tx`insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season)values(${id},${`Synthetic ${sport.toUpperCase()} Player ${i + 1}`},${sport},${slot.positions[0]},'Isolated practice','#1759a3',1,${season})`;
        await tx`insert into sports_feed.free_core_roster values(${id},${sport},${season},${tx.json([slot.positions[0]])},${expires},'https://example.invalid/isolated-hosted-practice',${"a".repeat(64)},true)`;
      }
      await tx`update sports_feed.free_core_programmes set enabled=true where sport=${sport}`;
      rounds[sport] = [];
      for (const mode of ["SALARY_CAP", "OPEN"]) {
        const id = randomUUID();
        rounds[sport].push(id);
        const rules = {
          mode,
          lineup_version: config.version,
          scoring_version: "isolated-hosted-awaiting-v1",
          inventory_scope: config.inventoryScope,
          lock_policy: "round-wide-v1",
          free_core_policy: "public-free-core-v1",
          public_access_policy: "au-adult-free-play-v1",
          entry_fee_credits: 0,
        };
        await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize,awards)values(${id},${sport.toUpperCase() + " free practice"},${sport},${season},1,${lock},${tx.json(rules)},(select id from beta_fantasy.scoring_rules where version='isolated-hosted-awaiting-v1'),'No cash prize','[]')`;
        const fixtures = [
          {
            fixtureId: `sim:${sport}:${id}`,
            scheduledAt: lock,
            status: "scheduled",
            playerIds: players,
          },
        ];
        await tx`insert into public_gameplay.rounds(competition_id,sport,enabled,rules_hash,fixtures,fixture_kind,source_reference)select id,sport,true,md5(rules::text),${tx.json(fixtures)},'practice','Clearly synthetic isolated hosted acceptance' from beta_fantasy.competitions where id=${id}`;
      }
    }
    // Reuse the existing private, expiring email capture transport. Normal Auth
    // creates the identity and verifies its token; no admin autoconfirm or MFA bypass.
    for (const a of accounts)
      await tx`insert into preview_auth.allowed_recipients(email,expires_at)values(${a.email},${authExpires})`;

    await tx.unsafe(`create or replace function preview_auth.public_acceptance_signup(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
   if current_user='supabase_auth_admin' and exists(select 1 from preview_auth.allowed_recipients a where a.email=lower(event->'user'->>'email') and a.email like 'docked-preview-public-%@example.invalid' and a.revoked_at is null and a.expires_at>clock_timestamp()) then return '{}'::jsonb;end if;
   return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Isolated acceptance accounts only'));end$$;
   revoke all on function preview_auth.public_acceptance_signup(jsonb) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
   grant execute on function preview_auth.public_acceptance_signup(jsonb) to supabase_auth_admin;`);
    await tx.unsafe(`create or replace function preview_auth.capture_hosted_public_email(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
   declare recipient text:=lower(event->'user'->>'email'); target text:=event->'email_data'->>'redirect_to'; token text:=event->'email_data'->>'token_hash'; deadline timestamptz;
   begin
    if current_user<>'supabase_auth_admin' or octet_length(event::text)>32768 or coalesce(event->'email_data'->>'email_action_type','') not in ('signup','recovery') or coalesce(event->'user'->>'new_email','')<>''
      or event->'email_data'->>'site_url' is distinct from 'https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1'
      or target is null or target not in ('https://docked-preview-s24-briant-ginty.vercel.app/auth/callback','https://docked-preview-s24-briant-ginty.vercel.app/auth/callback?next=/app/verified')
      or token is null or token !~ '^(pkce_)?[a-f0-9]+$' or length(regexp_replace(token,'^pkce_','')) not between 40 and 256 then raise exception 'Hosted capture denied';end if;
    select least(expires_at,clock_timestamp()+interval '30 minutes') into deadline from preview_auth.allowed_recipients where email=recipient and email like 'docked-preview-public-%@example.invalid' and revoked_at is null and expires_at>clock_timestamp();
    if deadline is null then raise exception 'Hosted recipient unavailable';end if;
    insert into preview_auth.captured_mail(email,auth_user_id,action,token_hash,redirect_to,received_at,expires_at) values(recipient,(event->'user'->>'id')::uuid,event->'email_data'->>'email_action_type',token,target,clock_timestamp(),deadline) on conflict do nothing;
    return '{}'::jsonb;
   end$$;
   revoke all on function preview_auth.capture_hosted_public_email(jsonb) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
   grant execute on function preview_auth.capture_hosted_public_email(jsonb) to supabase_auth_admin;`);
    assert.equal(
      (
        await tx`select count(*)::int n from public_gameplay.rounds where enabled`
      )[0].n,
      6,
    );
    assert.equal(
      (
        await tx`select sales_enabled or issuance_enabled or transfers_enabled enabled from commercial_billing.control where id`
      )[0].enabled,
      false,
    );
  });
  const runtime = new URL(c.databaseUrl);
  runtime.username = `docked_public_acceptance.${ref}`;
  runtime.password = runtimePassword;
  const commerce = new URL(c.databaseUrl);
  commerce.username = `docked_isolated_commercial.${ref}`;
  commerce.password = commercePassword;
  writeFileSync(
    dir + "/fixture.private.json",
    JSON.stringify({
      accounts,
      rounds,
      expires,
      origin,
      projectRef: ref,
      runtime: runtime.href,
      commerce: commerce.href,
      publishableKey: c.publishableKey,
      accountBinding: randomBytes(32).toString("hex"),
      referenceKey: randomBytes(32).toString("hex"),
    }),
    { mode: 0o600 },
  );
  writeFileSync(
    dir + "/auth-patch.private.json",
    JSON.stringify({
      disable_signup: false,
      mailer_autoconfirm: false,
      external_anonymous_users_enabled: false,
      site_url: origin,
      uri_allow_list:
        origin +
        "/auth/callback," +
        origin +
        "/auth/callback?next=/app/verified",
      hook_send_email_enabled: true,
      hook_send_email_uri:
        "pg-functions://postgres/preview_auth/capture_hosted_public_email",
      hook_before_user_created_enabled: true,
      hook_before_user_created_uri:
        "pg-functions://postgres/preview_auth/public_acceptance_signup",
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      project: ref,
      synthetic: true,
      newPracticeRounds: 6,
      sports: Object.keys(rounds),
      expires,
      permanentCardsIssued: 0,
      creditsGranted: 0,
      productionWrites: 0,
      emailTransport: "Private capture; no external email delivery claimed",
    }),
  );
}
mainRun()
  .finally(() => sql.end())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
