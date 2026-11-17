import { custodyQuery } from "./lib/reviewed-inventory";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const q = (s: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "docked-commercial-restore-20261117b",
      "psql",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: s,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    },
  ).trim();
const custody = JSON.parse(q(custodyQuery));
const c = JSON.parse(
  q(
    "select jsonb_build_object('definitions',(select count(*)from commercial_billing.definitions),'issued',(select sum(issued)from commercial_billing.definitions),'beta_allocations',(select count(*)from beta_packs.issued),'legacy',(select sum(legacy_issued)from commercial_billing.definitions),'custody_nfl',(select count(*)from credits_sandbox.card_instances),'custody_fixture',(select count(*)from credits_sandbox.nba_fixture_instances),'mismatches',(select count(*)from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*)from beta_packs.issued b where b.definition=d.id)+(select count(*)from commercial_billing.cards c where c.definition=d.id)))",
  ),
);
const counts = (xs: any[]) =>
  xs.reduce((o, x) => ((o[x] = (o[x] ?? 0) + 1), o), {});
const result = {
  ...c,
  custody: custody.length,
  rawDocumentRarities: counts(custody.map((x: any) => x.doc.rarity)),
  locationSets: counts(custody.map((x: any) => x.locations.join(","))),
  rawInstances: custody.filter((x: any) => x.locations.includes("active"))
    .length,
};
writeFileSync(
  "docs/qa/clean-transition-20261117/supply-census.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(result);
