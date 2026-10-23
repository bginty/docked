// Uses the established exact-target private-beta deployment, staged before promotion.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/three-sport-parity/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`;
  const r = JSON.parse(await fs.readFile(path, "utf8"));
  r.databaseMigrations = ["20261023092404"];
  r.recovery =
    "Pause new AFL/NRL weekly programmes and product availability if required. Promote the captured prior application. Retain additive schema, issued entitlements and all audit history; old NFL function signatures remain compatible. Never delete grants or shrink composite keys as rollback.";
  await fs.writeFile(path, JSON.stringify(r, null, 2));
}
