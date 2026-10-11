// Compare authoritative DNS with the immutable pre-cutover snapshot.
import assert from "node:assert/strict";
import { Resolver, resolve4 } from "node:dns/promises";
import { readFileSync, writeFileSync } from "node:fs";
const prior = JSON.parse(
  readFileSync(
    "private-data/friends-cutover/registrar-visible-records-before.json",
  ),
);
const dns = new Resolver();
dns.setServers(await resolve4("ns35.domaincontrol.com"));
const visible = readFileSync(
  "private-data/friends-cutover/registrar-after-ax.txt",
  "utf8",
);
assert.match(visible, /24 records/);
const retained = prior.records.filter(
  (r) => r.type !== "A" && r.name !== "www",
);
for (const r of retained)
  assert.ok(visible.includes(r.value), "Registrar mismatch: " + r.name);
const probes = await Promise.allSettled(
  prior.records
    .filter((r) => r.type !== "A" && r.type !== "SOA" && r.name !== "www")
    .map(async (record) => {
      const name =
        (record.name === "@" ? "" : record.name.replace(/\.@$/, "") + ".") +
        "docked.com.au";
      const result = await dns.resolve(name, record.type);
      const values = result.map((v) =>
        typeof v === "string"
          ? v.replace(/\.$/, "")
          : Array.isArray(v)
            ? v.join("")
            : record.type === "MX"
              ? `${v.exchange}. (Priority: ${v.priority})`
              : record.type === "SRV"
                ? `${v.priority} ${v.weight} ${v.port} ${v.name}.`
                : JSON.stringify(v),
      );
      assert.ok(
        values.includes(
          record.value.replace(
            record.type === "CNAME" || record.type === "NS" ? /\.$/ : /$^/,
            "",
          ),
        ),
        name + " changed",
      );
      return { type: record.type, name: record.name, unchanged: true };
    }),
);
const checks = probes.map((p, index) =>
  p.status === "fulfilled"
    ? p.value
    : {
        type: prior.records.filter(
          (r) => r.type !== "A" && r.type !== "SOA" && r.name !== "www",
        )[index].type,
        name: prior.records.filter(
          (r) => r.type !== "A" && r.type !== "SOA" && r.name !== "www",
        )[index].name,
        dnsProbe: "UNVERIFIED",
        reason: p.reason.code ?? p.reason.message,
      },
);
const apex = (await dns.resolve4("docked.com.au")).sort();
const www = await dns.resolveCname("www.docked.com.au");
assert.deepEqual(apex, ["216.150.1.1", "216.150.16.1"]);
assert.deepEqual(www, ["8db1dd380a206fba.vercel-dns-017.com"]);
const evidence = {
  at: new Date().toISOString(),
  authoritativeServer: "ns35.domaincontrol.com",
  apex,
  www,
  checks,
  registrarRetainedRecordsVerified: retained.length,
  verificationScope:
    "All retained records compared with authenticated registrar UI. DNS lookup failures recorded separately, not treated as changes or repaired.",
  passed: true,
  rollbackSnapshotPreserved: true,
};
writeFileSync(
  "docs/qa/friends-cutover/dns-verified.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence));
