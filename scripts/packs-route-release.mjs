// Application-only repair using the existing reviewed private-beta release.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/packs-route/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`;
  const rollback = JSON.parse(await fs.readFile(path, "utf8"));
  rollback.databaseMigrations = [];
  rollback.recovery =
    "Application-only repair; no migration or data rollback. Captured baseline retains the reported Packs URL defect and read-only transaction regression, so prefer a reviewed roll-forward unless this release introduces a more serious regression. No balance, ownership or security-control changes.";
  await fs.writeFile(path, JSON.stringify(rollback, null, 2));
}
