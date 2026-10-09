import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    )
      .split("\0")
      .filter((f) => f && existsSync(f)),
  ),
];
const pattern =
  /\b(?:edges?|odds|bookmakers?|betting|tips?|backtests?)\b|BUILT FOR AN EDGE|Edge Signal|Market Reference|fair[- ](?:odds|price)|(?:ODDS|EDGE|RESEARCH|FORWARD_PAPER)_[A-Z_]+|officialEdges|communityEdgeId|official_tip_id|community_edge_id/gim;
function reason(f) {
  if (f.startsWith("db/"))
    return "Historical schema baseline used by migration/RLS regression tests; never reapplied as an active product setup.";
  if (f.startsWith("artifacts/"))
    return "Preserved historical artifact receipt; current delivery instructions supersede old product releases.";
  if (f === "public/images/sports/manifest.json")
    return "Image provenance: original generation prompts exclude betting imagery; generic visual edge terminology, not product functionality.";
  if (f === "src/app/beta-policies/page.tsx")
    return "Explicit notice distinguishing the immutable historical policy wording from current fantasy cards.";
  if (/notification-centre|preview-invitations/.test(f))
    return "Legacy preference field explicitly forced false; no retired capability granted.";
  if (f.startsWith("legacy/"))
    return "Archived source/history, excluded from application/build entry points. Not current instructions.";
  if (f.startsWith("supabase/"))
    return "Immutable database migration/history; retirement/revocation requires the separate migration described in DATABASE_RETIREMENT.md.";
  if (
    f === "config/beta-policy-content.json" ||
    f.startsWith("docs/legal/") ||
    f.startsWith("docs/policies/")
  )
    return "Approved historical consent/policy wording preserved byte-for-byte; replace only with a newly approved version.";
  if (f.startsWith("docs/qa/") && !f.startsWith("docs/qa/fantasy-cleanup"))
    return "Historical or isolation-test evidence, not active product instructions.";
  if (f.startsWith("docs/"))
    return "Supersession/retirement documentation or explicitly labelled historical plans; PRODUCT_DIRECTION.md takes precedence.";
  if (f.startsWith("tests/"))
    return "Regression fixture or assertion: verifies rejection, historical account rights or database isolation; never production data.";
  if (
    /retired-product|deployment-environment|hosted-|config\.ts|android-preview-config|native-navigation|prepare-.*environment|deploy-beta|guard-hosted|android-live/.test(
      f,
    )
  )
    return "Fail-closed retirement/deployment guard or tombstone; retained names reject old clients/configuration, never enable the service.";
  if (/app-onboarding|app-auth-forms|preview-testers/.test(f))
    return "Stored onboarding enum compatibility (edges means Fantasy cards in current UI); no pricing/publication permission.";
  if (/signup-profile|unsubscribe/.test(f))
    return "Historical consent column/purpose explicitly set false or revoked; account data preserved.";
  if (
    /community-social|social-interactions|preview-export|community-policy|account-deletion/.test(
      f,
    )
  )
    return "Historical schema/type compatibility, exclusion of retired posts, owner-only export or audit preservation; no retired publishing route.";
  if (f.endsWith(".css") || f.includes("app-icon"))
    return "Unused presentation selector/icon identifier; no route, data query or product copy. Retained to avoid unrelated styling regressions.";
  if (f.includes("analytics"))
    return "Data minimisation comment or historical query metadata; retired event submissions are rejected.";
  if (f.startsWith("scripts/"))
    return "Controlled verification/retirement tooling or retained shared infrastructure; no active odds provider/worker entry point.";
  if (f.startsWith("config/") || f === ".env.example")
    return "Closed deployment compatibility flag or historical receipt; no credential or provider adapter.";
  return "Review required; inspect this occurrence before acceptance.";
}
const rows = [];
for (const file of files) {
  if (
    !/\.(?:md|txt|ts|tsx|js|mjs|json|css|sql|html|xml|yml|yaml|ps1)$/.test(
      file,
    ) &&
    file !== ".env.example"
  )
    continue;
  if (
    file.startsWith("docs/qa/fantasy-cleanup/legacy-") ||
    file === "scripts/fantasy-legacy-inventory.mjs"
  )
    continue;
  const body = readFileSync(file, "utf8");
  if (body.length > 3_000_000) continue;
  body.split(/\r?\n/).forEach((line, i) => {
    pattern.lastIndex = 0;
    const matches = [...line.matchAll(pattern)];
    for (const m of matches)
      rows.push({
        file,
        line: i + 1,
        column: m.index + 1,
        term: m[0],
        reason: reason(file),
      });
  });
}
const out = "docs/qa/fantasy-cleanup";
mkdirSync(out, { recursive: true });
const quote = (s) => '"' + String(s).replaceAll('"', '""') + '"';
writeFileSync(
  out + "/legacy-occurrences.csv",
  [
    "file,line,column,term,reason",
    ...rows.map((r) => Object.values(r).map(quote).join(",")),
  ].join("\n") + "\n",
);
const counts = {};
for (const row of rows) counts[row.reason] = (counts[row.reason] ?? 0) + 1;
const report = {
  capturedAt: new Date().toISOString(),
  scope:
    "Tracked/unignored existing text files; binary supplied artwork inspected separately. Archived snapshots intentionally retained. One row per matching occurrence, including compatibility identifiers.",
  occurrences: rows.length,
  reasons: counts,
  unclassified: rows.filter((r) => r.reason.startsWith("Review required")),
};
writeFileSync(
  out + "/legacy-summary.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
