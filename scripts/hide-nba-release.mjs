// Preserve existing sport/commerce gates; this is a reversible display change.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/hide-nba/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`,
    r = JSON.parse(await fs.readFile(path, "utf8"));
  r.databaseMigrations = [];
  r.recovery =
    "Promote the captured previous application to restore NBA navigation. No database migrations, ownership changes, wallet mutations, schedule changes or activation changes in this release.";
  await fs.writeFile(path, JSON.stringify(r, null, 2));
}
