// Reuse the reviewed private-beta release recipe; this fix requires no migration.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/member-loading/release";
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
    "Application-only fix. Promote the captured compatible real-roster baseline deployment if necessary. No data rollback, migration, balance adjustment or inventory deletion is required.";
  await fs.writeFile(path, JSON.stringify(rollback, null, 2));
}
