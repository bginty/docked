// Protected, non-promoted application candidate. Reuse the reviewed private-beta
// recipe and current baseline; no member grant, migration or purchase activation.
if (!["prepare", "stage"].includes(process.argv[2]))
  throw Error("Only prepare/stage allowed; no public promotion in this workflow");
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/public-launch-final/candidate";
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
    "Candidate only: no live alias changes, migration or data rollback. Keep the captured live deployment. Google member TEST remains disabled without its explicit server flag, exact expiring admission, secrets and native allowlist; all free-Core programmes default disabled. Do not promote with commercial, public registration, NBA or prize activation.";
  await fs.writeFile(file, JSON.stringify(receipt, null, 2));
}
