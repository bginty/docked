// Reuse the approved private-beta recipe, preserving all existing feature gates.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/global-sport/release";
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
    "Promote the captured prior application. This release has no database migrations, data mutations, schedule activation or feature-gate expansion. Match archives are versioned application data and roll back with code.";
  await fs.writeFile(path, JSON.stringify(r, null, 2));
}
