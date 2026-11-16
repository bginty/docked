/** Build a namespaced schema-only package from a disconnected local schema. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  acceptanceDocs,
  acceptancePrivate,
} from "./lib/batch1-acceptance-profile";
import {
  packAcceptanceSchemas,
  packAcceptanceStatement,
} from "../src/server/pack-acceptance-sql";
const target = "docked-batch1-synthetic-20261116",
  dir = acceptanceDocs;
const privateDir = acceptancePrivate;
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
function sql(q: string) {
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
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: q, encoding: "utf8", windowsHide: true, maxBuffer: 20e6 },
  ).trim();
}
const packet = JSON.parse(
  readFileSync(
    "docs/qa/batch1-pack-phone-20261116/production-package.json",
    "utf8",
  ),
);
const reviewed = JSON.parse(
  readFileSync(
    "docs/qa/batch1-pack-phone-20261116/database-schema.json",
    "utf8",
  ),
);
const query = `select jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','definition',pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname=any(array[${packAcceptanceSchemas.map((s) => `'${s}'`).join(",")}]);`;
const before = JSON.parse(sql(query));
const already = reviewed.changedFunctions.every(
  (f: any) =>
    hash(
      before
        .find((r: any) => r.signature === f.signature)
        .definition.replaceAll("\r", ""),
    ) === f.afterSha256,
);
if (!already) {
  for (const f of reviewed.changedFunctions)
    assert.equal(
      hash(
        before
          .find((r: any) => r.signature === f.signature)
          .definition.replaceAll("\r", ""),
      ),
      f.beforeSha256,
      f.signature,
    );
  const migrations = packet.migrations
    .map((m: any) => {
      const b = execFileSync(
        "git",
        ["show", packet.sourceCommit + ":" + m.file],
        { windowsHide: true },
      );
      assert.equal(hash(b), m.sha256);
      return b.toString();
    })
    .join("\n");
  sql("begin;" + migrations + "commit;");
}
const functions = JSON.parse(sql(query));
for (const f of reviewed.changedFunctions)
  assert.equal(
    hash(
      functions
        .find((r: any) => r.signature === f.signature)
        .definition.replaceAll("\r", ""),
    ),
    f.afterSha256,
    f.signature,
  );
const closure = JSON.parse(
  readFileSync(dir + "/dependency-closure.json", "utf8"),
);
assert.deepEqual(closure.schemas, [...packAcceptanceSchemas].sort());
const selected = new Set<string>(closure.objects);
const source = readFileSync(
  "private-data/batch1-hosted-20261116/schema-only.sql",
  "utf8",
);
const blocks = source
  .split(/(?=--\n-- Name: )/)
  .map((text) => {
    const h = text.match(
      /-- Name: (.+?); Type: ([^;]+); Schema: ([^;]+); Owner:/,
    );
    return h ? { name: h[1], type: h[2], schema: h[3], text } : null;
  })
  .filter(Boolean) as {
  name: string;
  type: string;
  schema: string;
  text: string;
}[];
function included(b: (typeof blocks)[number]) {
  if (
    [
      "TABLE",
      "FUNCTION",
      "VIEW",
      "TYPE",
      "SEQUENCE",
      "MATERIALIZED VIEW",
      "SEQUENCE OWNED BY",
    ].includes(b.type)
  )
    return selected.has(b.schema + "." + b.name.split("(")[0]);
  if (
    [
      "CONSTRAINT",
      "FK CONSTRAINT",
      "TRIGGER",
      "ROW SECURITY",
      "POLICY",
      "DEFAULT",
    ].includes(b.type)
  )
    return selected.has(b.schema + "." + b.name.split(" ")[0]);
  if (b.type === "INDEX") {
    const t = b.text.match(/ ON ([a-z_]+\.[a-z_]+) /);
    return !!t && selected.has(t[1]);
  }
  return false;
}
const chosen = blocks.filter(included);
const allowed = packAcceptanceSchemas.map((s) => "b1_" + s);
const prefix = (s: string) =>
  packAcceptanceSchemas
    .reduce(
      (text, schema) =>
        text.replaceAll("'" + schema + "'", "'b1_" + schema + "'"),
      packAcceptanceStatement(s),
    )
    .replace(/\bdocked_beta_app\b/g, "docked_pack_acceptance")
    .replace(/\bauth\.(users|sessions|mfa_factors)\b/g, "b1_acceptance.auth_$1")
    .replace(
      /REFERENCES b1_acceptance\.auth_users\b/g,
      "REFERENCES auth.users",
    );
const redactNamedIdentity = (s: string) =>
  s.replaceAll(
    "d6ab4838-7108-4c50-8ab8-c5947ab55bd8",
    "b1999999-9999-4999-8999-999999999999",
  );
let bundle =
  "-- DISPOSABLE PREVIEW ONLY. No customer data. Do not apply to Production.\nset local check_function_bodies=false;\n";
bundle +=
  "create schema b1_acceptance; revoke all on schema b1_acceptance from public;\n";
bundle +=
  allowed
    .map((s) => `create schema ${s}; revoke all on schema ${s} from public;`)
    .join("\n") + "\n";
// Placeholders have the exact Auth column types and no rows; permissions.sql
// replaces them with fixed-synthetic-member, expiring views before runtime use.
for (const t of ["users", "sessions", "mfa_factors"])
  bundle += `create view b1_acceptance.auth_${t} as select * from auth.${t} where false; revoke all on b1_acceptance.auth_${t} from public,anon,authenticated,service_role;\n`;
for (const f of ["uid", "jwt"])
  bundle +=
    sql(`select pg_get_functiondef('auth.${f}()'::regprocedure)`).replace(
      "FUNCTION auth.",
      "FUNCTION b1_acceptance.",
    ) +
    `; revoke all on function b1_acceptance.${f}() from public,anon,authenticated,service_role;\n`;
for (const b of chosen) {
  if (b.type === "FUNCTION") {
    const candidates = functions.filter((r: any) =>
      r.signature.startsWith(b.schema + "." + b.name.split("(")[0] + "("),
    );
    // Preserve overload order by locating the exact declaration's argument signature.
    const rawHeader = b.text.match(/CREATE FUNCTION ([^\n]+) RETURNS/);
    const f =
      candidates.find((r: any) =>
        r.definition
          .replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION")
          .includes("CREATE FUNCTION " + rawHeader?.[1] + "\n"),
      ) ??
      candidates.find((r: any) =>
        r.definition
          .replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION")
          .includes("CREATE FUNCTION " + rawHeader?.[1] + " RETURNS"),
      );
    assert(f, `Exact function overload missing: ${b.schema}.${b.name}`);
    let definition = f.definition;
    if (f.signature === "beta_fantasy.production_eligible_v1()") {
      const condition =
        "if s.deployment_mode<>'production' or not s.enabled or current_setting('docked.fantasy_production',true) is distinct from s.production_ref or coalesce(current_setting('docked.fantasy_preview',true),'')<>'' then raise exception 'Production Fantasy context required'; end if;";
      assert(definition.includes(condition), "Reader predecessor changed");
      definition = definition.replace(
        condition,
        `if s.deployment_mode<>'preview' or not s.enabled or s.production_ref is not null
       or current_setting('docked.pack_acceptance',true) is distinct from 'bckkllmndoxzpzdqrevb'
       or coalesce(current_setting('docked.fantasy_production',true),'')<>''
       or coalesce(auth.jwt()->>'aal','')<>'aal2'
       or not exists(select 1 from auth.sessions ss where ss.user_id=u and ss.id::text=auth.jwt()->>'session_id' and ss.aal='aal2' and (ss.not_after is null or ss.not_after>clock_timestamp()))
       then raise exception 'Isolated synthetic Preview reader context required';end if;`,
      );
    }
    bundle += prefix(definition) + ";\n";
  } else bundle += prefix(b.text) + "\n";
}
// Functions containing schema names inside literals use the same mapping. No
// copied function is granted to PUBLIC; individual runtime grants follow review.
bundle += allowed
  .map(
    (s) =>
      `revoke all on all tables in schema ${s} from public,anon,authenticated,service_role; revoke all on all functions in schema ${s} from public,anon,authenticated,service_role; revoke all on all sequences in schema ${s} from public,anon,authenticated,service_role;`,
  )
  .join("\n");
bundle = redactNamedIdentity(bundle);
writeFileSync(privateDir + "/namespace-schema.sql", bundle);
writeFileSync(
  dir + "/preview-bundle-preparation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      sourceCommit: packet.sourceCommit,
      threeOriginalMigrationsVerified: true,
      sevenFinalFunctionsVerified: true,
      schemas: allowed,
      objects: chosen.length,
      tables: chosen.filter((b) => b.type === "TABLE").length,
      functions: chosen.filter((b) => b.type === "FUNCTION").length,
      sha256: hash(bundle),
      customerRowsCopied: 0,
      persistentPreviewChanges: 0,
      permissionsComplete: false,
      hostedAcceptance: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    prepared: true,
    objects: chosen.length,
    tables: chosen.filter((b) => b.type === "TABLE").length,
    sha256: hash(bundle),
    hostedWrites: 0,
  }),
);
