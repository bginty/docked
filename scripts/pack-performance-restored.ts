/** Disconnected restored database only. All allocations and DDL roll back. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  executeCredits,
  wallet,
  type CreditsState,
} from "../src/core/credits-sandbox";
import { digest } from "../src/core/scoring-engine";
import { batch1Target as target } from "./lib/batch1-isolated-db";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target]).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const dir = "docs/qa/batch1-pack-phone-20261116/";
mkdirSync(dir, { recursive: true });
mkdirSync("private-data/batch1-pack-phone-20261116", { recursive: true });
const lit = (v: string) => "'" + v.replaceAll("'", "''") + "'";
const json = (v: unknown) => lit(JSON.stringify(v)) + "::jsonb";
function query(body: string): any[] {
  try {
    return execFileSync(
      "docker",
      [
        "exec",
        "-i",
        target,
        "psql",
        "-X",
        "-q",
        "-h",
        "/restore",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: "set jit=off;set work_mem='3500kB';" + body,
        windowsHide: true,
        maxBuffer: 128e6,
        timeout: 240000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    )
      .toString("utf8")
      .split(/\r?\n/)
      .filter((s) => s.startsWith("{"))
      .map((s) => JSON.parse(s));
  } catch (e: any) {
    writeFileSync(
      "private-data/batch1-pack-phone-20261116/performance-error.private.log",
      String(e.stderr ?? ""),
    );
    throw Error(
      "Isolated performance rehearsal stopped; diagnostic saved privately",
    );
  }
}
const fingerprintSql = `select jsonb_build_object('state',(select md5(document::text) from credits_sandbox.state where id),'history',(select count(*) from credits_sandbox.history),'journal',(select count(*) from credits_sandbox.journal),'lines',(select count(*) from credits_sandbox.lines),'issued',(select count(*) from beta_packs.issued),'supply',(select md5(string_agg(id::text||':'||issued::text,',' order by id)) from commercial_billing.definitions),'inventory',(select md5(string_agg(user_id::text||sport||cards::text,',' order by user_id,sport)) from sports_feed.sport_sandbox_inventory));`;
const before = query(fingerprintSql)[0];
const [row] = query(
  "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id;",
);
const [identity] = query(
  "select jsonb_build_object('member',a.user_id,'session',(select s.id from auth.sessions s where s.user_id=a.user_id and s.aal='aal2' order by s.updated_at desc limit 1)) from credits_sandbox.access a where a.kind='owner' and a.enabled;",
);
assert(identity?.member && identity.session);
const [catalogue] = query("select beta_packs.catalogue();");
assert(catalogue.enabled);
const state: CreditsState = structuredClone(row.document);
state.economy!.founderCatalogue = {
  enabled: true,
  players: Object.fromEntries(
    catalogue.players
      .filter(
        (p: any) =>
          state.economy!.players[p.legacyPlayer] &&
          p.definitions.length === 5 &&
          p.definitions.every(
            (d: any) =>
              d.issued ===
              (state.economy!.definitions[`${p.legacyPlayer}:${d.rarity}`]
                ?.issued ?? 0),
          ),
      )
      .map((p: any) => [
        p.legacyPlayer,
        { canonicalPlayer: p.canonicalPlayer, team: p.team },
      ]),
  ),
};
const product = Object.values(state.economy!.products).find(
  (p) =>
    p.sport === "afl" &&
    p.type === "STANDARD" &&
    p.cards === 9 &&
    p.cataloguePolicy === "founder-credit-season-v1",
)!;
assert(
  product && wallet(state, identity.member).available >= product.priceCredits,
);
const request = randomUUID(),
  open = randomUUID(),
  now = Date.now(),
  actor = { id: identity.member, role: "member" as const };
const command = {
  kind: "buy-pack",
  product: product.id,
  configuration: product.version,
  confirmed: true,
  policy: state.policy.version,
};
const bought = executeCredits(state, actor, request, command, now);
const opened = executeCredits(
  bought.state,
  actor,
  open,
  { kind: "open-pack", entitlement: request },
  now + 1,
);
assert.equal(bought.state.economy!.packs[request].cards.length, 9);
assert.equal(
  wallet(opened.state, identity.member).available,
  wallet(state, identity.member).available - product.priceCredits,
);
assert.equal(
  digest(executeCredits(opened.state, actor, request, command, now + 2).state),
  digest(opened.state),
);
const migration = readFileSync(
  "supabase/migrations/20261115113306_batch_private_pack_issuance_validation.sql",
  "utf8",
);
const additional = readFileSync(
  "supabase/migrations/20261115211545_batch1_pack_guard_batching.sql",
  "utf8",
);
const subdocuments = readFileSync(
  "supabase/migrations/20261115235000_batch1_persistence_subdocuments.sql",
  "utf8",
);
const results: any[] = [];
for (const phase of ["before", "pending", "batch1"]) {
  let sql = `begin;set local jit=off;set local work_mem='3500kB';set local statement_timeout='180s';${phase === "before" ? "" : migration}${phase === "batch1" ? additional + subdocuments : ""}\nselect pg_advisory_xact_lock(71820342);set local role docked_beta_app;select set_config('request.jwt.claim.sub',${lit(identity.member)},true),set_config('request.jwt.claims',${json({ sub: identity.member, aal: "aal2", session_id: identity.session })}::text,true);`;
  let previous = row.document as CreditsState,
    revision = Number(row.revision);
  sql += `select set_config('docked.nba_private_beta','enabled',true),set_config('docked.multi_sport','isolated-preview',true),set_config('docked.private_beta_sport','afl',true),set_config('docked.sports_private_beta','enabled',true),set_config('docked.fixture_commerce','enabled',true);select credits_sandbox.assert_sport_fixture_member(${lit(identity.member)},'afl');`;
  for (const [name, step, id] of [
    ["purchase", bought.state, request],
    ["open", opened.state, open],
  ] as const) {
    for (const j of step.journal.slice(previous.journal.length)) {
      sql += `insert into credits_sandbox.journal values(${lit(j.id)},${json(j)});`;
      for (const [i, line] of j.lines.entries())
        sql += `insert into credits_sandbox.lines values(${lit(j.id)},${i},${lit(line.account)},${line.credits});`;
    }
    revision++;
    sql += `insert into credits_sandbox.history(revision,actor,request,document) values(${revision},${lit(identity.member)},${lit(id)},${json(step)});`;
    // PL/pgSQL captures EXPLAIN JSON without printing the financial document.
    sql += `do $profile$ declare p json;begin execute ${lit(`explain(analyze,format json) update credits_sandbox.state set revision=${revision},document=${json(step)} where id`)} into p;raise notice 'PROFILE:%',jsonb_build_object('step',${lit(name)},'executionMs',p->0->'Execution Time','triggers',p->0->'Triggers');end $profile$;`;
    previous = step;
  }
  sql += `set constraints all immediate;reset role;select jsonb_build_object('issued',(select count(*) from beta_packs.issued),'newOwnerCount',(select count(*) from credits_sandbox.nba_fixture_instances where id=any(${lit("{" + bought.state.economy!.packs[request].cards.join(",") + "}")}::uuid[])),'projectedNewCards',(select count(*) from sports_feed.sport_sandbox_inventory i,jsonb_array_elements(i.cards)c where i.user_id=${lit(identity.member)}::uuid and c->>'id'=any(${lit("{" + bought.state.economy!.packs[request].cards.join(",") + "}")}::text[])));rollback;`;
  const start = performance.now();
  try {
    const raw = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        target,
        "psql",
        "-X",
        "-q",
        "-h",
        "/restore",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: sql,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 128e6,
        timeout: 420000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (raw.status !== 0) throw { stderr: raw.stderr };
    const timings = raw.stderr
      .split(/\r?\n/)
      .filter((l) => l.includes("PROFILE:"))
      .map((l) => JSON.parse(l.slice(l.indexOf("PROFILE:") + 8)));
    const check = raw.stdout
      .split(/\r?\n/)
      .filter((l) => l.startsWith("{"))
      .map((l) => JSON.parse(l))
      .at(-1);
    assert.equal(check.issued, before.issued + 9);
    assert.equal(check.newOwnerCount, 9);
    assert.equal(check.projectedNewCards, 9);
    assert.equal(timings.length, 2);
    results.push({
      phase,
      roundTripMs: Math.round(performance.now() - start),
      timings,
      check,
    });
  } catch (e: any) {
    writeFileSync(
      "private-data/batch1-pack-phone-20261116/performance-error.private.log",
      String(e.stderr ?? ""),
    );
    throw Error(
      "Restored " + phase + " rehearsal failed; private diagnostic retained",
    );
  }
  assert.deepEqual(query(fingerprintSql)[0], before);
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(
  dir + "restored-performance.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      target,
      network: "none",
      productionWrites: 0,
      rollbackVerified: true,
      actualNineCardPurchaseAndReveal: true,
      cacheStateControlled: false,
      scope: "Database persistence path; not hosted API or Android latency",
      migrationSha256: createHash("sha256").update(migration).digest("hex"),
      additionalSha256: createHash("sha256").update(additional).digest("hex"),
      subdocumentsSha256: createHash("sha256")
        .update(subdocuments)
        .digest("hex"),
      results,
    },
    null,
    2,
  ) + "\n",
);
