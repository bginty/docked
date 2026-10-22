// Reuse the established exact-project Production deployment controls and receipts.
process.env.NBA_RELEASE_EVIDENCE = "docs/qa/overnight-multisport/release";
await import("./nba-private-beta-release.mjs");
