// Owner-authorised website/policy publication. No Play/public-registration release.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/customer-billing-20261101/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  const directory = process.env.NBA_RELEASE_EVIDENCE;
  await fs.copyFile("docs/qa/real-rosters/release/commerce-apply.json", `${directory}/commerce-apply.json`);
  const file = `${directory}/rollback.json`;
  const receipt = JSON.parse(await fs.readFile(file, "utf8"));
  receipt.databaseMigrations = ["20261031123611", "20261031123931"];
  receipt.recovery = "Keep the captured compatible previous website deployment for alias rollback. Both approved additive migrations stay in place disabled; do not restore wallet/inventory snapshots over subsequent activity or delete receipt/audit records. The new notification queue migration is separately prepared and not activated. Payments, member TEST grants, free-Core programmes, public signup, NBA, withdrawals and prizes remain closed.";
  await fs.writeFile(file, JSON.stringify(receipt, null, 2));
}
