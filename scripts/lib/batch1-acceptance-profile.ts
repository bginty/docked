/** Selects existing operators' smaller pack-only fixture; no new service. */
export const packOnly = process.argv.includes("--pack-only");
export const acceptanceDocs = packOnly
  ? "docs/qa/batch1-beta-alignment-20261116"
  : "docs/qa/batch1-hosted-20261116";
export const acceptancePrivate = packOnly
  ? "private-data/batch1-beta-alignment-20261116"
  : "private-data/batch1-hosted-20261116";
