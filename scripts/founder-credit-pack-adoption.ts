/** Prepare ONLY: bounded read of the existing invited scope; never execute SQL. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { founderCreditProducts } from "../src/core/founder-credit-packs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const out = "docs/qa/founder-credit-packs-20261115/",
  privateOut = "private-data/founder-credit-packs-20261115/";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
async function main() {
  assert(process.argv.includes("--prepare-only"));
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const db = ownerDatabase();
  process.chdir(root);
  let ids: string[];
  // Existing admission predicate takes FOR SHARE locks; no data-changing query.
  try {
    ids = await db.begin(async (tx) => {
      await tx`set local statement_timeout='10s'`;
      await tx`set local lock_timeout='2s'`;
      return (
        await tx`select user_id::text id from credits_sandbox.access where enabled and beta_private.admitted(user_id) order by user_id`
      ).map((x) => x.id);
    });
  } finally {
    await db.end();
  }
  assert(ids.length > 0);
  if (existsSync(privateOut + "adoption-plan.private.json"))
    assert.deepEqual(
      ids,
      JSON.parse(
        readFileSync(privateOut + "adoption-plan.private.json", "utf8"),
      ).memberIds,
      "Previously frozen beta membership changed; review required",
    );
  mkdirSync(privateOut, { recursive: true });
  const candidates = JSON.parse(
    readFileSync(out + "catalogue-candidates.json", "utf8"),
  );
  assert.equal(candidates.pool.length, 1210);
  assert.equal(candidates.held.length, 150);
  const products = founderCreditProducts();
  const plan = {
    version: 1,
    memberIds: ids,
    pool: candidates.pool,
    products,
    scope:
      "Existing invited members; free founder-issued credits; no credit purchases",
    authority:
      "Founder instruction: all currently invited beta members; credit purchases, registration and trading remain disabled",
  };
  const bytes = JSON.stringify(plan, null, 2) + "\n",
    sha = hash(bytes);
  writeFileSync(privateOut + "adoption-plan.private.json", bytes);
  const reference =
    "Exact founder-credit private beta deployment; plan SHA-256 " + sha;
  const sql = `-- REVIEWED PROPOSAL ONLY. One atomic transaction required.
select pg_advisory_xact_lock(71820342);
create temporary table founder_pack_proposal(document jsonb) on commit drop;
insert into founder_pack_proposal values(${literal(JSON.stringify(plan))}::jsonb);
do $$declare p jsonb; d jsonb; e jsonb;begin
 if exists(select 1 from beta_packs.members) or exists(select 1 from beta_packs.definitions) or exists(select 1 from beta_packs.issued) then raise exception 'Private pack adoption already exists; do not repeat';end if;
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 or exists(select 1 from commercial_billing.definitions where approved)
 or (select count(*) from commercial_billing.definitions)<>6540 or (select sum(issued) from commercial_billing.definitions)<>888
 then raise exception 'Dormant permanent inventory baseline drift';end if;
 if (select jsonb_agg(user_id::text order by user_id) from credits_sandbox.access where enabled and beta_private.admitted(user_id)) is distinct from (select document->'memberIds' from founder_pack_proposal)
 then raise exception 'Invited member scope changed; review required';end if;
 select document->'economy' into strict e from credits_sandbox.state where id for update;
 for p in select x from founder_pack_proposal cross join lateral jsonb_array_elements(document->'pool') x loop
  if not exists(select 1 from season_catalogue.members m where m.player_id=(p->>'player_id')::uuid and m.sport=p->>'sport' and m.season=p->>'season' and m.scope='free_weekly' and m.rights_id=p->>'rights_id' and m.provider=p->>'provider' and m.provider_id=p->>'provider_id' and m.evidence_sha256=p->>'evidence_sha256')
   or not season_catalogue.can_issue(p->>'sport',p->>'season',(p->>'player_id')::uuid,'free_weekly')
   or e->'players'->(p->>'legacyPlayer')->>'providerId' is distinct from p->>'provider_id'
   or e->'players'->(p->>'legacyPlayer')->>'provider' is distinct from p->>'provider'
   or e->'players'->(p->>'legacyPlayer')->>'sport' is distinct from p->>'sport'
  then raise exception 'Approved identity/source drift';end if;
  for d in select x from jsonb_array_elements(p->'definitions')x loop
   if not exists(select 1 from commercial_billing.definitions c where c.id=(d->>'id')::uuid and c.player_id=(p->>'player_id')::uuid and c.sport=p->>'sport' and c.rarity=d->>'rarity' and c.lifetime_cap=(d->>'cap')::int and c.issued=(d->>'issued')::int and c.issued=c.legacy_issued and not c.approved)
   or coalesce((e->'definitions'->((p->>'legacyPlayer')||':'||(d->>'rarity'))->>'issued')::int,0)<>(d->>'issued')::int
   then raise exception 'Permanent serial counter drift';end if;
  end loop;
 end loop;
end$$;
insert into season_catalogue.rights(id,sport,season,scope,valid_from,valid_until,evidence,approval_reference)
select distinct r.sport||'-2026-free-beta-packs-v1',r.sport,r.season,'free_beta_packs',r.valid_from,r.valid_until,
 r.evidence||jsonb_build_object('use','Retained factual identity for founder-funded private beta limited packs only','commercial',false,'sourceGrant',r.id,'sourceRestrictionsInherited',true),${literal(reference)}
from season_catalogue.rights r where r.id in(select p->>'rights_id' from founder_pack_proposal cross join lateral jsonb_array_elements(document->'pool')p);
insert into season_catalogue.members
select m.sport,m.season,m.player_id,'free_beta_packs',m.sport||'-2026-free-beta-packs-v1',m.provider,m.provider_id,m.snapshot,m.edition_id,m.evidence,m.evidence_sha256,${literal(reference)}
from season_catalogue.members m join (select p from founder_pack_proposal cross join lateral jsonb_array_elements(document->'pool')p) q on m.sport=q.p->>'sport' and m.player_id=(q.p->>'player_id')::uuid and m.scope='free_weekly';
insert into beta_packs.definitions
select (d->>'id')::uuid,p->>'legacyPlayer',(p->>'player_id')::uuid,p->>'sport',d->>'rarity',p->>'season',p->>'sport'||'-2026-free-beta-packs-v1',p->>'evidence_sha256'
from founder_pack_proposal cross join lateral jsonb_array_elements(document->'pool')p cross join lateral jsonb_array_elements(p->'definitions')d;
insert into beta_packs.members select u::uuid,${literal(reference)} from founder_pack_proposal cross join lateral jsonb_array_elements_text(document->'memberIds')u;
insert into beta_packs.products select p->>'id',p from founder_pack_proposal cross join lateral jsonb_array_elements(document->'products')p;
insert into credits_sandbox.pack_configuration select document->>'version',document from beta_packs.products;
-- Configuration only: wallets, existing products, instances, receipts and custody untouched.
update credits_sandbox.state set document=jsonb_set(jsonb_set(document,'{economy,products}',(document#>'{economy,products}')||(select jsonb_object_agg(id,document) from beta_packs.products)),'{economy,activeProductVersions}',(select jsonb_agg(id order by id) from beta_packs.products)) where id;
insert into beta_packs.events(action,details)values('catalogue-adopted',jsonb_build_object('plan',${literal(sha)},'players',1210,'definitions',6050,'members',${ids.length},'newCards',0,'creditsGranted',0));
-- New pool statistics must exist before the application can read the new offers.
-- ANALYZE changes planner statistics only; no financial/source/ownership row.
analyze beta_packs.definitions;
analyze beta_packs.products;
analyze beta_packs.members;
analyze season_catalogue.members;
analyze season_catalogue.rights;
-- Enable only after the exact application is staged and verified. Separate from adoption.
`;
  writeFileSync(privateOut + "adopt.private.sql", sql);
  writeFileSync(
    out + "proposal.json",
    JSON.stringify(
      {
        planSha256: sha,
        adoptionSha256: hash(sql),
        members: ids.length,
        players: 1210,
        definitions: 6050,
        heldPlayers: 150,
        products,
        originalLifetimeIssued: 888,
        newCardsDuringAdoption: 0,
        creditsGrantedDuringAdoption: 0,
        activation: { enabled: true, grants_enabled: true },
        preserve: {
          commercialControls: false,
          registration: false,
          purchasedCredits: false,
          withdrawals: false,
          trading: false,
          nba: false,
        },
        privatePlanPath: privateOut + "adoption-plan.private.json",
        privateSQLPath: privateOut + "adopt.private.sql",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      preparedOnly: true,
      planSha256: sha,
      adoptionSha256: hash(sql),
      members: ids.length,
      players: 1210,
      definitions: 6050,
      products: products.length,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Preparation failed");
  process.exitCode = 1;
});
