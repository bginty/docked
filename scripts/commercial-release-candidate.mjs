// Reuse the existing reviewed private-beta deployment recipe, never promote.
if (!["prepare", "stage"].includes(process.argv[2]))
  throw Error("Only protected candidate preparation and staging are permitted");
process.env.NBA_RELEASE_EVIDENCE =
  "docs/qa/commercial-billing-20261101/candidate";
process.env.DOCKED_RELEASE_COMMERCIAL_DORMANT = "true";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile(
    "docs/qa/real-rosters/release/commerce-apply.json",
    `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`,
  );
  const file = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`,
    r = JSON.parse(await fs.readFile(file, "utf8"));
  r.databaseMigrations = [];
  r.recovery =
    "Candidate only. No alias, database migration or customer mutation. Keep the captured live deployment; commercial service, surfaces, checkout, public registration and prizes remain disabled. NBA remains hidden. Migration and activation require separate approval.";
  await fs.writeFile(file, JSON.stringify(r, null, 2));
}
