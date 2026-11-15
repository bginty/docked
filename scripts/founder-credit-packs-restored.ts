/** Disconnected restored Production ONLY. No credentials or network connections. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
import { executeCredits, wallet } from "../src/core/credits-sandbox";
import { founderCreditCommand } from "../src/core/founder-credits";
import { digest } from "../src/core/scoring-engine";
const run = process.argv.find((a) => a.startsWith("--run="))?.slice(6) ?? "",
  target = "docked-commercial-restore-" + run,
  dir = "docs/qa/founder-credit-packs-20261115/";
assert.match(run, /^20261115[g-z]$/);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const samePrivate = (a: unknown, b: unknown) =>
  assert.equal(
    digest(a),
    digest(b),
    "Protected contents differ; no customer values logged",
  );
const lit = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const json = (v: unknown) => lit(JSON.stringify(v)) + "::jsonb";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const backup = JSON.parse(
  readFileSync(
    `docs/qa/v31-prelaunch-execution-20261111/database/restore-${run}/restore-only.json`,
    "utf8",
  ),
);
assert.equal(backup.restored, true);
assert.equal(backup.restoreTarget, target);
const timings: { stage: string; milliseconds: number }[] = [];
function query(s: string): any[] {
  try {
    const lines = execFileSync(
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
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      {
        input: s,
        windowsHide: true,
        maxBuffer: 256e6,
        stdio: ["pipe", "pipe", "pipe"],
      },
    )
      .toString()
      .split(/\r?\n/);
    let stage = "schema";
    for (const line of lines) {
      if (line.startsWith("STAGE_")) stage = line;
      const timing = /^Time: ([0-9.]+) ms/.exec(line);
      if (timing) timings.push({ stage, milliseconds: Number(timing[1]) });
    }
    return lines
      .filter((s) => s.startsWith("{") || s.startsWith("["))
      .map((s) => JSON.parse(s));
  } catch (e: any) {
    writeFileSync(
      "private-data/founder-credit-packs-20261115/restored-error.private.log",
      String(e.stderr ?? ""),
    );
    console.error(
      String(e.stdout ?? "")
        .split(/\r?\n/)
        .filter((s) => s.startsWith("STAGE_") || s.startsWith("Time:"))
        .slice(-12)
        .join("\n"),
    );
    throw Error(
      String(e.stderr ?? "Isolated SQL failed")
        .split(/\r?\n/)
        .filter((s) => /ERROR|FATAL/.test(s))
        .join("\n"),
    );
  }
}
const deployedCatalogue = "a42004fa87db16ddb0818b2c479bca6a38ae0645";
assert.equal(
  query(
    "select jsonb_build_object('absent',to_regnamespace('beta_packs') is null)",
  )[0].absent,
  true,
  "Use an unmodified, authenticated isolated restore",
);
const reconstructedCatalogue = !query(
  "select jsonb_build_object('exists',to_regclass('season_catalogue.members') is not null)",
)[0].exists;
if (reconstructedCatalogue) {
  const files = [
    "supabase/migrations/20261115011415_approved_season_catalogue.sql",
    "supabase/migrations/20261115011418_season_catalogue_pack_eligibility.sql",
    "docs/qa/season-catalogue-20261115/adopt-catalogue.sql",
  ];
  const dependency = files
    .map((f) =>
      execFileSync("git", ["show", deployedCatalogue + ":" + f], {
        windowsHide: true,
        maxBuffer: 32e6,
      }).toString(),
    )
    .join("\n");
  query("begin;" + dependency + "\nset constraints all immediate;commit;");
}
const [tables] = query(tableListQuery);
const mutable = new Set([
  "season_catalogue.rights",
  "season_catalogue.members",
  "credits_sandbox.pack_configuration",
  "credits_sandbox.state",
]);
const capture = () =>
  query(
    "begin isolation level repeatable read read only;" +
      tables
        .filter((t: string) => !mutable.has(t))
        .map(checksumQuery)
        .join(";") +
      ";" +
      custodyQuery +
      ";commit;",
  );
const diagnoseOnly = process.argv.includes("--diagnose-only");
const before = diagnoseOnly ? null : capture(),
  [stateBefore] = diagnoseOnly
    ? [null]
    : query(
        "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
      );
const migration = readFileSync(
  "supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql",
  "utf8",
);
const adoption = readFileSync(
  "private-data/founder-credit-packs-20261115/adopt.private.sql",
  "utf8",
);
const plan = JSON.parse(
  readFileSync(
    "private-data/founder-credit-packs-20261115/adoption-plan.private.json",
    "utf8",
  ),
);
const proposal = JSON.parse(readFileSync(dir + "proposal.json", "utf8"));
assert.equal(sha(adoption), proposal.adoptionSha256);
const measuredAdoption = adoption
  .replace("do $$declare", () => "\\echo STAGE_PREFLIGHT\ndo $$declare")
  .replace(
    "insert into season_catalogue.rights",
    "\\echo STAGE_RIGHTS\ninsert into season_catalogue.rights",
  )
  .replace(
    "update credits_sandbox.state",
    "\\echo STAGE_CONFIG\nupdate credits_sandbox.state",
  )
  .replace(
    "insert into beta_packs.events",
    "\\echo STAGE_AUDIT\ninsert into beta_packs.events",
  );
const body =
  "\\timing on\n" +
  "begin;set local lock_timeout='3s';set local statement_timeout='90s';" +
  migration +
  "\n" +
  measuredAdoption +
  "\nset constraints all immediate;";
query(body + "rollback;");
if (diagnoseOnly) {
  console.log("Exact adoption rollback diagnostic passed");
  process.exit(0);
}
assert.equal(
  query(
    "select jsonb_build_object('absent',to_regnamespace('beta_packs') is null)",
  )[0].absent,
  true,
);
samePrivate(
  query(
    "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
  )[0],
  stateBefore,
);
query(body + "commit;");
const [stateAfter] = query(
  "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
);
const expected = structuredClone(stateBefore);
for (const p of plan.products) expected.document.economy.products[p.id] = p;
expected.document.economy.activeProductVersions = plan.products
  .map((p: any) => p.id)
  .sort();
samePrivate(stateAfter, expected);
const poolStart = performance.now();
const [pool] = query(
  "set statement_timeout='5s';select jsonb_build_object('players',jsonb_array_length(beta_packs.catalogue()->'players'),'enabled',beta_packs.catalogue()->'enabled','members',(select count(*) from beta_packs.members),'definitions',(select count(*) from beta_packs.definitions),'products',(select count(*) from beta_packs.products))",
);
const catalogueRoundTripMilliseconds = Math.round(
  performance.now() - poolStart,
);
assert.deepEqual(pool, {
  players: 1210,
  enabled: false,
  members: proposal.members,
  definitions: 6050,
  products: 18,
});
// Transaction-rolled-back real-state allocation. No customer grant or card persists,
// even on this isolated copy; the intended owner/operator claims are simulated.
const [identity] = query(
  "select jsonb_build_object('owner',a.id,'session',(select s.id from auth.sessions s where s.user_id=a.id and (s.not_after is null or s.not_after>now()) order by s.created_at desc limit 1)) from auth.users a where lower(a.email)='support@docked.com.au'",
);
assert(
  identity?.owner && identity?.session,
  "Restored founder session absent: no hosted acceptance claimed",
);
const u = identity.owner,
  claims = { sub: u, aal: "aal2", session_id: identity.session };
const [catalogue] = query("select beta_packs.catalogue()");
const state = structuredClone(stateAfter.document);
state.economy.founderCatalogue = {
  enabled: true,
  players: Object.fromEntries(
    catalogue.players.map((p: any) => [
      p.legacyPlayer,
      { canonicalPlayer: p.canonicalPlayer, team: p.team },
    ]),
  ),
};
const grant = founderCreditCommand({
  request: randomUUID(),
  member: u,
  amount: 10000,
  reason: "Isolated rollback-only free-credit rehearsal",
  confirmed: true,
});
const grantId = randomUUID(),
  buyId = randomUUID();
const granted = executeCredits(
  state,
  { id: u, role: "reviewer", aal: "aal2" },
  grantId,
  grant,
  Date.now(),
);
const product = plan.products.find(
  (p: any) => p.sport === "nfl" && p.type === "STANDARD" && p.cards === 9,
);
const bought = executeCredits(
  granted.state,
  { id: u, role: "member" },
  buyId,
  {
    kind: "buy-pack",
    product: product.id,
    configuration: product.version,
    confirmed: true,
    policy: state.policy.version,
  },
  Date.now(),
);
assert.equal(
  wallet(bought.state, u).available,
  wallet(state, u).available + 10000 - product.priceCredits,
);
let writes = "";
let prior = stateAfter.document;
let revision = Number(stateAfter.revision);
for (const [next, request] of [
  [granted.state, grantId],
  [bought.state, buyId],
] as const) {
  for (const j of next.journal.slice(prior.journal.length)) {
    writes += `insert into credits_sandbox.journal values(${lit(j.id)},${json(j)});`;
    for (const [i, l] of j.lines.entries())
      writes += `insert into credits_sandbox.lines values(${lit(j.id)},${i},${lit(l.account)},${l.credits});`;
  }
  revision++;
  writes += `insert into credits_sandbox.history(revision,actor,request,document)values(${revision},${lit(u)},${lit(request)},${json(next)});update credits_sandbox.state set revision=${revision},document=${json(next)} where id;`;
  prior = next;
}
const [rehearsal] = query(
  `begin;set local statement_timeout='90s';select pg_advisory_xact_lock(71820342);update beta_packs.control set enabled=true,grants_enabled=true,authority_reference='Isolated reviewed rollback-only acceptance';set local role docked_beta_app;select set_config('request.jwt.claim.sub',${lit(u)},true),set_config('request.jwt.claims',${lit(JSON.stringify(claims))},true);select beta_packs.assert_grant(${lit(u)}::uuid);${writes}set constraints all immediate;reset role;select jsonb_build_object('newCards',(select count(*) from beta_packs.issued),'lifetime',(select sum(issued) from commercial_billing.definitions),'baseline',(select sum(legacy_issued) from commercial_billing.definitions),'commercialCards',(select count(*) from commercial_billing.cards));rollback;`,
);
assert.deepEqual(rehearsal, {
  newCards: 9,
  lifetime: 897,
  baseline: 888,
  commercialCards: 0,
});
samePrivate(capture(), before);
samePrivate(
  query(
    "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
  )[0],
  stateAfter,
);
writeFileSync(
  dir + "restored-rehearsal.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      sourceBackup: backup.archiveSha256,
      reconstructedDeployedCatalogue: reconstructedCatalogue
        ? deployedCatalogue
        : null,
      backupAt: backup.backupAt,
      network: "none",
      productionWrites: 0,
      protectedTables: tables.filter((t: string) => !mutable.has(t)).length,
      protectedRowsAndCustodyUnchanged: true,
      configurationDeltaExact: true,
      rollbackPassed: true,
      schemaRollbackEvidence:
        "this restored snapshot; schema absent and wallet byte-equivalent after rollback; all protected row/custody checks match at completion",
      catalogueRoundTripMilliseconds,
      pool,
      rehearsal,
      rehearsalWritesRolledBack: true,
      migrationSha256: sha(migration),
      timings,
      adoptionSha256: sha(adoption),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ passed: true, pool, rehearsal, productionWrites: 0 }),
);
