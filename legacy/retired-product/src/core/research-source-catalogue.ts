import { validateResearchSource, type ResearchSource } from "./research-engine";

export const OPENFOOTBALL_REVIEWED_REVISION =
  "e6744429ee395bc86f247348c6184bb08d4eb361";
/** Reviewed preparation. No import, staff identity, source registration or scheduler activation is implied. */
export function reviewedOpenFootballSources(): ResearchSource[] {
  return (["2025-26", "2026-27"] as const).map((season) =>
    validateResearchSource({
      schemaVersion: "research-source-v1",
      sourceId: `openfootball-epl-${season}`,
      version: `review-2026-10-04-${OPENFOOTBALL_REVIEWED_REVISION}`,
      name: `OpenFootball EPL ${season} research dataset`,
      domain: "raw.githubusercontent.com",
      category: "STRUCTURED_DATA",
      accessMethod: "DATASET",
      endpoint: `https://raw.githubusercontent.com/openfootball/football.json/${OPENFOOTBALL_REVIEWED_REVISION}/${season}/en.1.json`,
      rightsState: "APPROVED_AUTOMATED",
      commercialUse: "ALLOWED",
      publicDisplay: "ALLOWED",
      storage: {
        permission: "ALLOWED",
        maxDays: 36500,
        immutableEvidenceAllowed: true,
      },
      derivedUse: "ALLOWED",
      modelUse: "ALLOWED",
      automation: "ALLOWED",
      robots: "NOT_APPLICABLE",
      etiquette: { minimumIntervalSeconds: 86400, maximumRequestsPerDay: 1 },
      attribution: {
        label: "OpenFootball (CC0); source-reported research data",
        url: "https://github.com/openfootball/football.json",
      },
      dataTypes: ["MATCH_RESULT"],
      reliability: "TIER_2_AUTHORISED_STRUCTURED",
      jurisdictions: ["AU:NSW"],
      reviewedAt: "2026-10-04T02:38:22Z",
      reviewDueAt: "2026-11-04T00:00:00Z",
      effectiveFrom: "2026-10-04T02:38:22Z",
      effectiveTo: "2126-09-10T00:00:00Z",
      evidenceUrls: [
        `https://github.com/openfootball/football.json/blob/${OPENFOOTBALL_REVIEWED_REVISION}/LICENSE.md`,
        "https://github.com/openfootball/football.json",
        "https://raw.githubusercontent.com/openfootball/england/master/LICENSE.md",
        "https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api",
      ],
      notes:
        "CC0 dataset licence supports commercial retained/derived research. No trademark or correctness guarantee. Review interval and 100-year retention cap are Docked policy, not licence expiry. Pinned dataset snapshots only; no authoritative finality, UTC kickoff, original publication timestamp or correction lineage inferred. Quality/mapping acceptance is separate from rights. No automatic conversion to canonical results, model inputs, member facts or official records. Source catalogue is not runtime registration; audited staff registration and separately disabled job configuration remain required. Attribution is voluntary provenance under CC0. AU:NSW scopes this reviewed Preview use, not product jurisdiction approval.",
    }),
  );
}
