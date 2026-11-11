/** Reconcile real-player lifetime issuance added since the previous census. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { digest } from "../src/core/scoring-engine";
import { custodyQuery } from "./lib/reviewed-inventory";
import { rarityRule, type Rarity } from "../src/core/card-rarity";
import { issuedInventoryManifest } from "../src/core/issued-inventory-manifest";

const container = "docked-commercial-restore-20261111";
assert.equal(process.argv[2], "--isolated-read-only");
const old = JSON.parse(readFileSync("private-data/v31-final-reconciliation-20261110/census.private.json", "utf8"));
function run(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", () => {});
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(out) : reject(Error("Isolated read-only census failed")));
    child.stdin.end(input);
  });
}
async function main() {
  const [inspection] = JSON.parse(await run(["inspect", container]));
  assert.equal(inspection.HostConfig.NetworkMode, "none");
  const oldIds = old.records.map((r: any) => `'${r.id}'`).join(",");
  const sql = `begin read only;
with fresh as (${custodyQuery}), s as(select document d from credits_sandbox.state where id)
select jsonb_build_object('records',f.value,'extras',coalesce((select jsonb_agg(jsonb_build_object('id',r->>'id','player',coalesce(s.d#>array['economy','players',r#>>'{doc,playerId}'],p.identity),'receipt',coalesce(pr.document,s.d#>array['economy','packs',r#>>'{doc,source}']))) from jsonb_array_elements(f.value) r left join credits_sandbox.permanent_players p on p.id=r#>>'{doc,playerId}' left join credits_sandbox.pack_receipts pr on pr.id=r#>>'{doc,source}' where r->>'id' not in (${oldIds})),'[]')) from fresh f cross join s;
commit;`;
  const result = await run(["exec", "-i", container, "psql", "-X", "-q", "-h", "/restore", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], sql);
  const fresh = JSON.parse(result.split("\n").find(line => line.startsWith("{"))!);
  writeFileSync("private-data/v31-card-research-20261111/fresh-custody-observation.private.json", JSON.stringify(fresh, null, 2) + "\n");
  const original = old.records.map((r: any) => ({ id: r.id, doc: r.doc, locations: r.locations, custody: r.custody, ownership: r.ownership })).sort((a: any, b: any) => a.id.localeCompare(b.id));
  const existingIds = new Set(original.map((r: any) => r.id));
  const preserved = fresh.records.filter((r: any) => existingIds.has(r.id));
  assert.equal(digest(preserved), digest(original), "Any original document, custody, owner history or location change requires review");
  assert.equal(fresh.extras.length, 9, "Unexpected additional issuance count");
  const candidate = JSON.parse(readFileSync("private-data/commercial-pool-20261106-v2/candidate.private.json", "utf8"));
  const additionalIssued = [];
  for (const row of fresh.extras) {
    assert.equal(row.player.sport, "afl");
    assert.equal(row.player.synthetic, false);
    assert.equal(row.player.provider, "wikimedia");
    assert.match(row.player.providerId, /^afl:Q[0-9]+$/);
    assert.equal(row.receipt.product.status, "TEST_ONLY");
    assert.equal(row.receipt.product.inventoryScope, "real-roster-beta-v1");
    const record = fresh.records.find((r: any) => r.id === row.id);
    const cap = rarityRule(record.doc.rarity as Rarity).lifetimeCap;
    assert(cap !== null && record.doc.serial > 0 && record.doc.serial <= cap);
    assert.equal(record.doc.lifetimeCap, cap);
    const matches = candidate.rows.filter((r: any) => r.sport === row.player.sport && r.snapshot.provider === row.player.provider && r.snapshot.providerId === row.player.providerId && r.rarity === record.doc.rarity);
    assert.equal(matches.length, 1, "Exact established provider/rarity definition required");
    additionalIssued.push({ id: row.id, sport: row.player.sport, playerId: record.doc.playerId, provider: row.player.provider, providerId: row.player.providerId, rarity: record.doc.rarity, serial: record.doc.serial });
  }
  const oldIssued = JSON.parse(readFileSync("private-data/v31-final-reconciliation-20261110/all-issued.private.json", "utf8"));
  const manifest = issuedInventoryManifest([...oldIssued.map((r: any) => ({ id: r.immutableCardId, sport: r.sport, playerId: r.playerId, provider: r.provider, providerId: r.providerId, rarity: r.rarity, serial: r.serial })), ...additionalIssued]);
  assert.equal(manifest.totalIssued, 888);
  const report = {
    checkedAt: new Date().toISOString(), environment: "network-isolated-restored-production", productionWrites: 0,
    originalRecordsUnchanged: original.length, supportedLimitedCopiesUnchanged: 879,
    additionalRecords: fresh.extras.length, additionalRealPlayerCopies: 9,
    additionalSports: Object.fromEntries([...new Set(fresh.extras.map((r: any) => String(r.player.sport)))].map(sport => [sport, fresh.extras.filter((r: any) => r.player.sport === sport).length])),
    additionalScope: "Real AFL Wikimedia roster-beta identities with TEST_ONLY receipt; these nine allocations permanently consume real-player lifetime supply. NBA remains hidden and its18 copies remain excluded.",
    totalCustodyRecords: fresh.records.length,
    supportedLimitedCopiesNow: 888, issuedGroupsNow: manifest.rows.length, serialCollisions: 0, overCap: 0,
    priorProtectedCustodyDigest: digest(original), protectedCustodyDigest: digest(fresh.records),
  };
  writeFileSync("private-data/v31-card-research-20261111/fresh-custody.private.json", JSON.stringify({ ...report, records: fresh.records, additionalIssued }, null, 2) + "\n");
  writeFileSync("docs/qa/v31-prelaunch-20261111/cards/fresh-custody-delta.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Census failed"); process.exitCode = 1; });
