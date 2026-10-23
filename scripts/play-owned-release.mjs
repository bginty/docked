process.env.NBA_RELEASE_EVIDENCE = "docs/qa/play-owned/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`,
    r = JSON.parse(await fs.readFile(path, "utf8"));
  r.databaseMigrations = ["20261023052447_play_owned_inventory.sql"];
  r.recovery =
    "Promote captured prior application. Restore original function definitions saved under private-data/play-owned if database rollback is needed. No member data, historical results, schedules or feature gates are modified.";
  await fs.writeFile(path, JSON.stringify(r, null, 2));
}
