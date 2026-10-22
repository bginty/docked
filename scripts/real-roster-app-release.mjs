process.env.NBA_RELEASE_EVIDENCE = "docs/qa/real-rosters/release";
await import("./nba-private-beta-release.mjs");
if (process.argv[2] === "prepare") {
  const fs = await import("node:fs/promises");
  const evidence = process.env.NBA_RELEASE_EVIDENCE;
  const rollback = JSON.parse(
    await fs.readFile(`${evidence}/rollback.json`, "utf8"),
  );
  rollback.databaseMigrations.push("20261022222531");
  rollback.recovery =
    "Before the real-roster import, the prior application can be promoted. AFTER import, retain the compatible roster/product parser and additive migration: old deployments cannot parse real-roster product IDs. Suspend affected private-sport/test-commerce gates and roll forward, or prepare a reviewed rollback build retaining parser compatibility. Never delete purchased cards, receipts or audit records to restore an old build.";
  await fs.writeFile(
    `${evidence}/rollback.json`,
    JSON.stringify(rollback, null, 2),
  );
  const previous = JSON.parse(
    await fs.readFile(
      "docs/qa/overnight-multisport/release/commerce-apply.json",
      "utf8",
    ),
  );
  await fs.writeFile(
    `${evidence}/commerce-apply.json`,
    JSON.stringify(
      {
        ...previous,
        provenance:
          "Existing authorised isolated-commerce preparation; docs/qa/overnight-multisport/release/commerce-apply.json. This is not the real-roster import receipt.",
      },
      null,
      2,
    ),
  );
}
