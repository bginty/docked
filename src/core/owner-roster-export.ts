import { csvCell } from "./collection-export";
import type { OwnerRosterReport } from "./commercial-player-roster";

export const ownerRosterCsvColumns = [
  "sport",
  "current_club_id",
  "current_club_name",
  "player_name",
  "canonical_player_id",
  "registration_status",
  "availability_status",
  "roster_verification",
  "eligible_for_new_packs",
  "eligibility_reason",
  "commercial_definition_count",
  "approved_definition_count",
  "existing_commercial_cards",
  "lifetime_issued_including_history",
  "saved_card_clubs",
  "source_observed_at_utc",
  "status_effective_at_utc",
  "reviewed_at_utc",
  "source_url",
  "source_sha256",
  "roster_revision",
  "provider_aliases",
  "rarity_supply",
  "report_generated_at_utc",
];

/** Export the complete filtered SQL snapshot, in the same club/name order.
 * Refuse an incomplete page instead of silently producing a partial audit. */
export function ownerRosterCsv(report: OwnerRosterReport) {
  if (report.rows.length !== report.total)
    throw Error("A complete filtered roster is required for export");
  const seen = new Set<string>();
  const rows = [ownerRosterCsvColumns.map(csvCell).join(",")];
  for (const row of report.rows) {
    const key = `${row.sport}:${row.playerId}`;
    if (seen.has(key))
      throw Error("Duplicate canonical player in roster export");
    seen.add(key);
    rows.push(
      [
        row.sport,
        row.currentClubId,
        row.currentClubName,
        row.name,
        row.playerId,
        row.registration,
        row.availability,
        row.verification,
        row.eligibility ? "Yes" : "No",
        row.eligibilityReason,
        row.definitionCount,
        row.approvedDefinitions,
        row.existingCards,
        row.lifetimeIssued,
        row.savedClubs.join(" | "),
        row.observedAt,
        row.effectiveAt,
        row.reviewedAt,
        row.evidenceUrl,
        row.evidenceHash,
        row.revision,
        JSON.stringify(row.aliases),
        JSON.stringify(row.supply),
        report.generatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}
