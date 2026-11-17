/** Executes the SAME containment helper as the operator on the isolated restore.
 * Both successful and interrupted paths ROLLBACK. No Auth API or external network. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const target = "docked-commercial-restore-20261117d";
const docker = (args, input) =>
  execFileSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4e6,
    timeout: 180000,
  });
const info = JSON.parse(docker(["inspect", target]))[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0);
assert.equal(info.State.Running, true);
assert.equal(docker(["exec", target, "id", "-u", "postgres"]).trim(), "100");
const manifest = JSON.parse(
  readFileSync("private-data/clean-transition-20261117/manifest.private.json"),
);
const evidence = readFileSync(
  "docs/qa/clean-retirement-attestation-20261117/FOUNDER_ATTESTATION.json",
  "utf8",
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const pkg = {
  schemaVersion: 2,
  source: "isolated-rehearsal",
  accountManifestSha256: sha(JSON.stringify(manifest)),
  communicationRequirement: "founder-attested-prior-direct-communication",
  communicationEvidence: { path: "rehearsal", sha256: sha(evidence) },
};
const program = `
import assert from 'node:assert/strict';import fs from 'node:fs';
import postgres from '/code/postgres/src/index.js';
import {validatePriorCommunication,containWithCommunication,communicationAction}from'/code/authority.ts';
const p=JSON.parse(fs.readFileSync(0,'utf8')),detail=validatePriorCommunication(p.pkg,p.manifest,Buffer.from(p.evidence));
const db=postgres({host:'/proc/1/root/restore',database:'postgres',username:'postgres',ssl:false,max:1,onnotice:()=>{}});
try{
const [baseline]=await db.unsafe('select launch_transition.source_digest() source,(select count(*)::int from launch_transition.batches)batches');assert.equal(baseline.batches,0);
const hash='a'.repeat(64),notice='b'.repeat(64),checks=[];
const clean=async()=>{const [r]=await db.unsafe('select launch_transition.source_digest() source,(select count(*)::int from launch_transition.batches)batches,(select count(*)::int from launch_transition.events)events');assert.equal(r.source,baseline.source);assert.equal(r.batches,0);assert.equal(r.events,0);};
await assert.rejects(db.begin(async tx=>{
await tx.unsafe("create function pg_temp.reject_communication() returns trigger language plpgsql as $$begin raise exception 'INJECTED_COMMUNICATION_FAILURE';end$$; create trigger test_communication_failure before insert on launch_transition.events for each row when(new.action='FOUNDER_PRIOR_COMMUNICATION_ATTESTED')execute function pg_temp.reject_communication();");
await containWithCommunication(tx,p.manifest,baseline.source,hash,notice,detail);
}),/INJECTED_COMMUNICATION_FAILURE/);await clean();checks.push('Attestation insert failure rolls back containment and Owner promotion');
await assert.rejects(db.begin(async tx=>{
const b=await containWithCommunication(tx,p.manifest,baseline.source,hash,notice,detail);
assert.equal(await containWithCommunication(tx,p.manifest,baseline.source,hash,notice,detail),b);
const [r]=await tx.unsafe("select (select count(*)::int from launch_transition.events where action=$1)events,(select count(*)::int from private.roles where role='owner')owners,(select count(*)::int from launch_transition.accounts where kind='customer'and phase='access_blocked')contained,(select count(*)::int from commercial_billing.accounts)commercial_accounts,(select count(*)::int from commercial_billing.cards)commercial_cards",[communicationAction]);
assert.deepEqual(r,{events:1,owners:2,contained:3,commercial_accounts:0,commercial_cards:0});checks.push('Real operator helper records exact attestation and two Owners with zero commercial assets');checks.push('Identical containment retry adds no duplicate event');
await containWithCommunication(tx,p.manifest,baseline.source,hash,notice,{...detail,evidenceSha256:'c'.repeat(64)});
}),/Communication checkpoint drift/);await clean();checks.push('Changed communication checkpoint fails closed and rolls back');
console.log(JSON.stringify({passed:true,checks,allChangesRolledBack:true,externalDeliveries:0,authCalls:0,productionWrites:0,network:'none'}));
}finally{await db.end();}
`;
const dir = "private-data/clean-retirement-attestation-20261117";
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "/driver.mjs", program);
try {
  const raw = docker(
    [
      "run",
      "--rm",
      "--user",
      "100:101",
      "--network",
      `container:${target}`,
      "--pid",
      `container:${target}`,
      "--mount",
      `type=bind,source=${resolve("scripts/clean-transition-authority.ts")},target=/code/authority.ts,readonly`,
      "--mount",
      `type=bind,source=${resolve("node_modules/postgres")},target=/code/postgres,readonly`,
      "--mount",
      `type=bind,source=${resolve(dir + "/driver.mjs")},target=/code/driver.mjs,readonly`,
      "-i",
      "node:22-alpine",
      "node",
      "--disable-warning=ExperimentalWarning",
      "--experimental-strip-types",
      "/code/driver.mjs",
    ],
    JSON.stringify({ manifest, evidence, pkg }),
  );
  const proof = {
    at: new Date().toISOString(),
    helperSha256: sha(readFileSync("scripts/clean-transition-authority.ts")),
    ...JSON.parse(raw),
  };
  writeFileSync(
    "docs/qa/clean-retirement-attestation-20261117/containment-helper-tests.json",
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof));
} catch (e) {
  writeFileSync(dir + "/helper-error.private.txt", String(e.stderr ?? e));
  console.error(
    "Isolated helper test stopped; private diagnostic preserved. No Production call.",
  );
  process.exitCode = 1;
}
