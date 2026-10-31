// Application-only release; reuse the verified production/private-beta recipe.
// Legacy NBA umbrella settings are required for AFL/NRL. Customer NBA requests
// are denied by the shared server boundary; no database activation is changed.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/store-internal-release-20261031";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  const directory = process.env.NBA_RELEASE_EVIDENCE;
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${directory}/commerce-apply.json`,
  );
  const file = `${directory}/rollback.json`;
  const receipt = JSON.parse(await fs.readFile(file, "utf8"));
  receipt.databaseMigrations = [];
  receipt.recovery =
    "Application-only release. Retain this compatible Production baseline for rollback. Do not roll back wallet or inventory data. If rollback is needed, recheck NBA server denial before continuing Android distribution because the previous release only hid navigation.";
  await fs.writeFile(file, JSON.stringify(receipt, null, 2));
}
