/** Pure local generator. Produces reviewed SQL; never connects or executes it. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const directory = "docs/qa/season-catalogue-20261115/";
const source = readFileSync(directory + "catalogue-proposal.json", "utf8");
const manifest = JSON.parse(source);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
assert.equal(manifest.members.length, 1360);
assert.equal(manifest.review.length, 20);
assert.equal(
  new Set(manifest.members.map((p: any) => [p.sport, p.player_id].join(":")))
    .size,
  1360,
);
const rows = manifest.members.map((p: any) => ({
  ...p,
  evidence_sha256: hash(JSON.stringify(p.evidence)),
}));
const reference =
  "Approved exact stable-season deployment; proposal SHA-256 " + hash(source);
let sql = `-- Proposed ONLY. Execute atomically after both migrations, with the exact
-- separately approved package. No cards, entitlements or commercial rows changed.
select pg_advisory_xact_lock(71820342);
do $$begin
 if exists(select 1 from season_catalogue.members) or exists(select 1 from season_catalogue.rights) then
  raise exception 'Catalogue already adopted or unexpected data; do not repeat';
 end if;
 if (select count(*) from commercial_billing.definitions)<>6540 or
 (select sum(issued) from commercial_billing.definitions)<>888 or
 exists(select 1 from commercial_billing.definitions where approved) then
  raise exception 'Dormant inventory baseline differs';
 end if;
end$$;
`;
for (const sport of ["nfl", "afl", "nrl"]) {
  const evidence = {
    use: "retained factual identity in existing private free Weekly Core programme only",
    commercial: false,
    collectionRenewal: false,
    statistics: false,
    images: false,
    logos: false,
    source:
      sport === "nfl"
        ? "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md"
        : "https://creativecommons.org/licenses/by-sa/4.0/",
    license: sport === "nfl" ? "CC-BY-4.0" : "CC-BY-SA-4.0",
    conditions:
      "Retain attribution and revisions; subject to actual source-use restrictions and explicit revocation. No commercial player-rights clearance inferred.",
    review:
      "A collection review expiry stops collection, not previously licensed factual snapshot use. No freshness timestamp is renewed.",
  };
  sql += `insert into season_catalogue.rights values(${literal(sport + "-2026-free-weekly")},${literal(sport)},'2026','free_weekly','2026-01-01',null,${literal(JSON.stringify(evidence))}::jsonb,${literal(reference)});\n`;
}
sql += `create temporary table reviewed_season_adoption(document jsonb) on commit drop;
insert into reviewed_season_adoption values(${literal(JSON.stringify(rows))}::jsonb);
-- Reconcile every proposed identity with retained source records. Live status,
-- current team and observed_at deliberately do not participate in adoption.
do $$declare p jsonb;begin
 for p in select x from reviewed_season_adoption cross join lateral jsonb_array_elements(document)x loop
  if p->>'sport'='nfl' then
   if not exists(select 1 from credits_sandbox.permanent_players r
    join sports_feed.nfl_players np on np.player_id::text=r.id
    join beta_fantasy.editions e on e.id=np.edition_id
    where r.id=p->>'player_id' and r.identity=p->'evidence'->'registeredIdentity'
    and np.provider_id=p->>'provider_id' and e.id::text=p->>'edition_id'
    and e.player_id=np.player_id and e.season='2026' and e.tier='CORE' and e.status='launched')
    or not exists(select 1 from nfl_roster.observations o where o.player_id=p->>'player_id'
      and o.provider_id=p->>'provider_id' and o.identity_verified
      and o.source_hash=p->'evidence'->'official'->>'source_hash'
      and o.checked_at=(p->'evidence'->'official'->>'checked_at')::timestamptz)
    then raise exception 'NFL canonical identity/source drift: %',p->>'player_id';end if;
  else
   if not exists(select 1 from credits_sandbox.nba_fixture_players r
     where r.id=p->'evidence'->>'registryId' and r.identity->>'fixturePlayerId'=p->>'player_id'
     and r.identity->>'providerId'=p->>'provider_id' and r.identity->'rosterBeta'=p->'evidence'->'rosterBeta'
     and credits_sandbox.is_roster_beta_player(r.identity))
    then raise exception 'Australian canonical identity/source drift: %',p->>'player_id';end if;
  end if;
 end loop;
end$$;
insert into season_catalogue.members(sport,season,player_id,scope,rights_id,provider,provider_id,snapshot,edition_id,evidence,evidence_sha256,approval_reference)
select p->>'sport','2026',(p->>'player_id')::uuid,'free_weekly',p->>'sport'||'-2026-free-weekly',p->>'provider',p->>'provider_id',p->'snapshot',
 (p->>'edition_id')::uuid,p->'evidence',p->>'evidence_sha256',p->>'approval_reference'
from reviewed_season_adoption cross join lateral jsonb_array_elements(document)p;
do $$begin
 if (select count(*) from season_catalogue.members where sport='nfl')<>478
 or (select count(*) from season_catalogue.members where sport='afl')<>545
 or (select count(*) from season_catalogue.members where sport='nrl')<>337
 then raise exception 'Frozen catalogue counts differ';end if;
end$$;
`;
writeFileSync(directory + "adopt-catalogue.sql", sql);
console.log(
  "Prepared 1,360 frozen memberships; 20 NFL candidates held; no execution.",
);
