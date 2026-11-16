/** Generated fiction only; no Production rows, names, accounts or entitlement data. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { initialMemberTestCredits } from "../src/core/member-test-wallet";
import {
  initialCardEconomy,
  type EconomyPlayer,
} from "../src/core/card-economy";
import { founderCreditProducts } from "../src/core/founder-credit-packs";
import { executeCredits, validateCredits } from "../src/core/credits-sandbox";
import {
  rarityConfiguration,
  limitedRarities,
  rarityRule,
} from "../src/core/card-rarity";
import { fixtureSports } from "../src/core/fixture-sports";
const dir = "private-data/batch1-hosted-20261116";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const uuid = (key: string) => {
  const h = hash("DOCKED_SYNTHETIC_BATCH1_" + key);
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-4" +
    h.slice(13, 16) +
    "-8" +
    h.slice(17, 20) +
    "-" +
    h.slice(20, 32)
  );
};
const saved = JSON.parse(
  readFileSync(
    process.env.USERPROFILE + "/.docked-secrets/batch1-hosted-20261116.json",
    "utf8",
  ),
);
assert.equal(saved.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(saved.accounts.length, 2);
const accounts = saved.accounts.map((a: any, i: number) => {
  assert.match(a.email, /^docked-batch1-[a-f0-9]{16}@example\.invalid$/);
  return {
    id: a.id,
    email: a.email,
    kind: i === 0 ? "owner" : "tester",
    factor: a.factor,
    session: JSON.parse(
      Buffer.from(a.session.access_token.split(".")[1], "base64url").toString(),
    ).session_id,
  };
});
const now = Date.now(),
  authority =
    "Founder authorised synthetic hosted Batch 1 acceptance 2026-11-16; no real source identity or licence assertion";
const players: EconomyPlayer[] = [],
  identities: any[] = [],
  definitions: any[] = [];
for (const sport of ["nfl", "afl", "nrl"] as const)
  for (let i = 0; i < 436; i++) {
    const id = uuid(sport + i),
      q = "Q" + (99000000 + i),
      legacy =
        sport === "nfl"
          ? "batch1-synthetic-nfl-" + i
          : `${sport}-roster-beta-${q}`;
    const p: EconomyPlayer = {
      id: legacy,
      sport,
      provider: sport === "nfl" ? "synthetic" : "wikimedia",
      providerId: sport === "nfl" ? String(i) : sport + ":" + q,
      assetKind: "player",
      name: `DOCKED SYNTHETIC ${sport.toUpperCase()} ${i}`,
      position:
        sport === "nfl"
          ? ["QB", "RB", "WR", "TE"][i % 4]
          : fixtureSports[sport].positions[
              i % fixtureSports[sport].positions.length
            ],
      currentTeam: "SYNTHETIC",
      status: "inactive",
      observedAt: Date.UTC(2020, 0, 1),
      sourceRevision: "SYNTHETIC FIXTURE - NOT PROVIDER EVIDENCE",
      presentation: "docked",
    };
    // Deliberately fixture-shaped copies of the existing roster identity contract.
    // These are NOT researched identities, rights approvals or live catalogue rows.
    if (sport !== "nfl")
      Object.assign(p, {
        synthetic: false,
        inventoryClass: "real-roster-beta-v1",
        fixturePlayerId: id,
        eligiblePositions: [p.position],
        rosterBeta: {
          catalogue: "DOCKED_SYNTHETIC_ACCEPTANCE_ONLY",
          canonicalPlayerId: id,
          wikidataId: q,
          rosterSource:
            "https://en.wikipedia.org/DOCKED_SYNTHETIC_NOT_A_SOURCE",
          profileSource:
            "https://en.wikipedia.org/DOCKED_SYNTHETIC_NOT_A_SOURCE",
          verifiedAt: "2020-01-01T00:00:00Z",
          sourceHash: hash(legacy),
          license: "CC-BY-SA-4.0",
          verification: "roster-and-profile-agreement",
          permanentIssuanceEligible: false,
        },
      });
    players.push(p);
    identities.push({
      canonical: id,
      legacy,
      sport,
      hash: hash(legacy),
      edition: uuid("weekly-core-" + legacy),
    });
    for (const rarity of limitedRarities)
      definitions.push({
        id: uuid(legacy + rarity),
        player: id,
        legacy,
        sport,
        rarity,
        cap: rarityRule(rarity).lifetimeCap,
        hash: hash(legacy),
      });
  }
// Match Production's player-map cardinality without adding eligible identities.
// These fictional archive players are deliberately absent from season members.
for (let i = players.length; i < 2479; i++)
  players.push({
    id: "batch1-synthetic-archive-" + i,
    sport: "nfl",
    provider: "synthetic",
    providerId: "archive-" + i,
    assetKind: "player",
    name: "DOCKED SYNTHETIC ARCHIVE " + i,
    position: "QB",
    currentTeam: "SYNTHETIC",
    status: "inactive",
    observedAt: Date.UTC(2020, 0, 1),
    sourceRevision: "SYNTHETIC EXCLUDED ARCHIVE",
    presentation: "docked",
  });
let state = initialMemberTestCredits();
state.economy = initialCardEconomy(players, now);
state.economy.products = Object.fromEntries(
  founderCreditProducts().map((p) => [p.id, p]),
);
state.economy.activeProductVersions = Object.keys(state.economy.products);
state.economy.fixtureTestAllocation = {
  afl: { enabled: true, scope: "isolated-fixtures-v1" },
  nrl: { enabled: true, scope: "isolated-fixtures-v1" },
};
for (const account of accounts)
  for (let campaign = 0; campaign < 10; campaign++)
    state = executeCredits(
      state,
      { id: accounts[0].id, role: "reviewer", aal: "aal2" },
      uuid("funding" + account.id + campaign),
      {
        kind: "promotion",
        member: account.id,
        amount: 100000,
        campaign: "synthetic-" + account.id + "-" + campaign,
        reason:
          "Synthetic fixture funding; no real balance or provider backing",
        confirmed: true,
        redeemable: false,
      },
      now,
    ).state;
validateCredits(state);
const fixture = {
  authority,
  accounts,
  identities,
  definitions,
  players,
  products: founderCreditProducts(),
  rarityConfiguration,
  state,
};
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const policy = literal(
  JSON.stringify(
    Object.fromEntries(
      [
        "terms",
        "privacy",
        "beta",
        "community",
        "fantasy",
        "competition",
        "responsible_gambling",
      ].map((k) => [k, "synthetic-acceptance-only"]),
    ),
  ),
);
const json = JSON.stringify(fixture);
writeFileSync(dir + "/fixtures.json", json + "\n");
let sql = `create temporary table b1_fixture(document jsonb) on commit drop; insert into b1_fixture values(${literal(json)}::jsonb);\n`;
sql += `insert into b1_beta_private.admission_control(id,enabled,testers_enabled,policy_digest,policy_versions,approved_by,approved_at)values(true,true,true,repeat('a',64),${policy},'Synthetic operator',now());
insert into b1_beta_private.friends_control(id,enabled,readiness_evidence,approved_by,approved_at)values(true,true,'Synthetic acceptance only; no public or commercial authorisation','Synthetic operator',now());
insert into b1_beta_private.owner_gameplay_control(id,owner_id,enabled,authority) select true,(document->'accounts'->0->>'id')::uuid,true,document->>'authority' from b1_fixture;
insert into b1_beta_private.designated_administrators(user_id,designated_by)select (document->'accounts'->0->>'id')::uuid,'Synthetic operator' from b1_fixture;
insert into b1_beta_private.roles(user_id,role)select (document->'accounts'->0->>'id')::uuid,'owner' from b1_fixture;
insert into b1_beta_private.friends_roster(user_id,email,enabled,authority)select (a->>'id')::uuid,a->>'email',true,document->>'authority' from b1_fixture,jsonb_array_elements(document->'accounts')a where a->>'kind'='tester';
insert into b1_beta_private.admissions(email,user_id,administrator,token_digest,request_id,expires_at,status,accepted_at,country,state,age_attested,policy_digest,policy_versions)
select a->>'email',(a->>'id')::uuid,a->>'kind'='owner',encode(sha256(convert_to(a->>'id','UTF8')),'hex'),gen_random_uuid(),now()+interval '24 hours','reserved',null,null,null,false,null,null from b1_fixture,jsonb_array_elements(document->'accounts')a;
update b1_beta_private.admissions set status='accepted',accepted_at=now(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions=${policy};
insert into b1_beta_public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at)select (a->>'id')::uuid,'AU','NSW',true,'synthetic-acceptance-only',now() from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_beta_private.consent_events(user_id,purpose,granted,version,actor)select (a->>'id')::uuid,'privacy',true,'synthetic-acceptance-only','Synthetic fixture' from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_beta_fantasy.settings(id,enabled,deployment_mode,production_ref,terms_version,privacy_version)values(true,true,'preview',null,'synthetic-acceptance-only','synthetic-acceptance-only');
insert into b1_beta_fantasy.production_releases(channel)values('beta');
insert into b1_credits_sandbox.access(user_id,kind,label,enabled,authority_note)select (a->>'id')::uuid,a->>'kind','Synthetic tester',true,document->>'authority' from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_beta_packs.members select (a->>'id')::uuid,document->>'authority' from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_commercial_billing.control(id,environment)values(true,'acceptance');
insert into b1_beta_packs.control(id,enabled,grants_enabled,authority_reference)select true,true,false,document->>'authority' from b1_fixture;
insert into b1_sports_feed.nba_beta_control(id,enabled,authority)values(true,true,'Synthetic isolated shared sport gate; NBA not exposed');
insert into b1_sports_feed.private_beta_sports(sport,enabled,authority)values('afl',true,'Synthetic acceptance only'),('nrl',true,'Synthetic acceptance only');
insert into b1_sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)select (a->>'id')::uuid,true,'Synthetic acceptance only',now()+interval '24 hours' from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_sports_feed.sport_sandbox_access select (a->>'id')::uuid from b1_fixture,jsonb_array_elements(document->'accounts')a;
insert into b1_sports_feed.nfl_control values(true,true);
insert into b1_sports_feed.weekly_core_control(id,enabled)values(true,true);
insert into b1_sports_feed.weekly_sport_programmes(sport,enabled,enabled_at,authority_note)values('afl',true,now(),'Synthetic acceptance only'),('nrl',true,now(),'Synthetic acceptance only');
insert into b1_sports_feed.weekly_core_schedules(user_id,enrolled_at,next_period,sport,policy)select (a->>'id')::uuid,now()-interval '7 days',1,sport,'weekly-core-'||sport||'-v1' from b1_fixture,jsonb_array_elements(document->'accounts')a cross join unnest(array['nfl','afl','nrl'])sport;
insert into b1_sports_feed.weekly_core_packs(user_id,period,due_at,sport,policy)select (a->>'id')::uuid,0,now()-interval '7 days',sport,'weekly-core-'||sport||'-v1' from b1_fixture,jsonb_array_elements(document->'accounts')a cross join unnest(array['nfl','afl','nrl'])sport;
insert into b1_season_catalogue.rights(id,sport,season,scope,valid_from,valid_until,evidence,approval_reference)select sport||scope,sport,'2026',scope,now()-interval '1 day',now()+interval '24 hours','{"synthetic":true,"providerEvidence":false}',${literal(authority)} from unnest(array['nfl','afl','nrl'])sport cross join unnest(array['free_weekly','free_beta_packs'])scope;
insert into b1_credits_sandbox.permanent_players select p->>'id',p->>'sport',p->>'provider',p->>'providerId',p->>'assetKind',p from b1_fixture,jsonb_array_elements(document->'players')p where p->>'sport'='nfl';
insert into b1_credits_sandbox.nba_fixture_players select p->>'id',p from b1_fixture,jsonb_array_elements(document->'players')p where p->>'sport'<>'nfl';
insert into b1_beta_fantasy.sports values('nfl','["QB","RB","WR","TE"]',7);
insert into b1_beta_fantasy.tiers values('CORE',0,2147483647);
insert into b1_beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season,status)select (i->>'canonical')::uuid,p->>'name','nfl',p->>'position','SYNTHETIC','#1677FF',1,'2026','injured' from b1_fixture,jsonb_array_elements(document->'identities')i,jsonb_array_elements(document->'players')p where i->>'sport'='nfl' and p->>'id'=i->>'legacy';
insert into b1_beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)select (i->>'edition')::uuid,(i->>'canonical')::uuid,'CORE','2026','regular',2147483647,'launched' from b1_fixture,jsonb_array_elements(document->'identities')i where i->>'sport'='nfl';
insert into b1_season_catalogue.members(sport,season,player_id,scope,rights_id,provider,provider_id,snapshot,evidence,evidence_sha256,approval_reference,edition_id)
select i->>'sport','2026',(i->>'canonical')::uuid,scope,(i->>'sport')||scope,'synthetic',i->>'legacy',p||'{"team":"SYNTHETIC","colour":"#1677FF","shirt":1}'::jsonb,'{"synthetic":true,"providerEvidence":false}',i->>'hash',${literal(authority)},case when i->>'sport'='nfl' and scope='free_weekly' then (i->>'edition')::uuid else null end from b1_fixture,jsonb_array_elements(document->'identities')i cross join unnest(array['free_weekly','free_beta_packs'])scope cross join jsonb_array_elements(document->'players')p where p->>'id'=i->>'legacy';
insert into b1_commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,snapshot,rights_reference)select (d->>'id')::uuid,(d->>'player')::uuid,d->>'sport',d->>'rarity',(d->>'cap')::int,0,0,'{"synthetic":true}',${literal(authority)} from b1_fixture,jsonb_array_elements(document->'definitions')d;
insert into b1_beta_packs.definitions select (d->>'id')::uuid,d->>'legacy',(d->>'player')::uuid,d->>'sport',d->>'rarity','2026',(d->>'sport')||'free_beta_packs',d->>'hash' from b1_fixture,jsonb_array_elements(document->'definitions')d;
insert into b1_credits_sandbox.rarity_configuration select document->'rarityConfiguration'->>'version',document->'rarityConfiguration' from b1_fixture;
insert into b1_credits_sandbox.pack_configuration select p->>'version',p from b1_fixture,jsonb_array_elements(document->'products')p;
insert into b1_beta_packs.products select p->>'id',p from b1_fixture,jsonb_array_elements(document->'products')p;
insert into b1_credits_sandbox.journal select j->>'id',j from b1_fixture,jsonb_array_elements(document->'state'->'journal')j;
insert into b1_credits_sandbox.lines select j->>'id',(l.ordinality-1)::int,l.value->>'account',(l.value->>'credits')::bigint from b1_fixture,jsonb_array_elements(document->'state'->'journal')j cross join lateral jsonb_array_elements(j->'lines') with ordinality l;
insert into b1_credits_sandbox.state select true,0,document->'state' from b1_fixture;
`;
writeFileSync(dir + "/fixtures.sql", sql);
const localAuth =
  `-- LOCAL ONLY: simulated rows for SQL rehearsal. Hosted uses genuine Auth API accounts.\n` +
  accounts
    .map(
      (a: any) =>
        `insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_app_meta_data)values('${a.id}',${literal(a.email)},now(),false,'{"docked_acceptance":"batch1-hosted-20261116"}');\ninsert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)values('${a.factor}','${a.id}','totp','verified',now(),now());\ninsert into auth.sessions(id,user_id,aal,created_at,updated_at,not_after)values('${a.session}','${a.id}','aal2',now(),now(),now()+interval '24 hours');`,
    )
    .join("\n");
writeFileSync(dir + "/local-auth-only.sql", localAuth);
console.log(
  JSON.stringify({
    players: players.length,
    definitions: definitions.length,
    accounts: accounts.length,
    fixtureSha256: hash(json),
    fixtureSqlSha256: hash(sql),
    customerData: false,
    hostedWrites: 0,
  }),
);
