// Existing approved private-beta release recipe. No new feature activation.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/owned-collection/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`,
    rollback = JSON.parse(await fs.readFile(path, "utf8"));
  rollback.databaseMigrations = ["20261023022240_owned_collection_read"];
  rollback.recovery =
    "Promote the captured prior application. The additive collection read function may remain unused. No inventory, ownership, wallet, pricing, rules, feature gate, result or schedule is changed by this migration; no data rollback is required.";
  await fs.writeFile(path, JSON.stringify(rollback, null, 2));
}
