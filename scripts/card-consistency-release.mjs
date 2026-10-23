// Reviewed application + additive NBA scoring rounds; existing private-beta gates retained.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/card-consistency/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  await fs.copyFile("docs/qa/real-rosters/release/commerce-apply.json", `${process.env.NBA_RELEASE_EVIDENCE}/commerce-apply.json`);
  const path = `${process.env.NBA_RELEASE_EVIDENCE}/rollback.json`;
  const rollback = JSON.parse(await fs.readFile(path, "utf8"));
  rollback.databaseMigrations = ["20261023130000_nba_private_beta_rarity_v2"];
  rollback.recovery = "Promote the captured previous application if needed. Before rollback, suspend private NBA access using the existing server gate so an old binary cannot interpret V2 scoring. Retain V2 rules, successor rounds and all audits/entries; never delete or reinterpret results. Restore access only with a V2-compatible build. NFL and wallet gates are independent. No ownership/balance changes require reversal.";
  await fs.writeFile(path, JSON.stringify(rollback, null, 2));
}
