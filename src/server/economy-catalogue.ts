import type { Sql, TransactionSql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
import { isFixtureSport } from "../core/fixture-sports";
/** Current season/team/status are observations, never new permanent identities. */
export async function refreshEconomyCatalogue(
  sql: Sql | TransactionSql,
  state: CreditsState,
) {
  if (!state.economy) return;
  const rows =
    await sql`select c.*,j.verified_jersey_number from credits_sandbox.current_player_status c left join credits_sandbox.current_player_jerseys j on j.id=c.id`;
  const current = new Map(rows.map((r) => [String(r.id), r]));
  // Explicit versioned rollout only. Legacy deployments need no new table until
  // the reviewed migration and official evidence have been installed.
  const official = state.economy.rosterPolicy
    ? await sql`select * from nfl_roster.current_evidence`
    : [];
  const roster = new Map(official.map((r) => [String(r.player_id), r]));
  for (const player of Object.values(state.economy.players)) {
    // Fixtures are explicitly reviewed synthetic observations, never NFL feed rows.
    // Do not silently renew their freshness or change their registered identity.
    if (player.synthetic && isFixtureSport(player.sport)) continue;
    if (state.economy.rosterPolicy && player.sport === "nfl") {
      const o = roster.get(player.id);
      player.roster = o
        ? {
            policy: "official-nfl-roster-v1",
            playerId: player.id,
            providerId: String(o.provider_id),
            team: String(o.team),
            position: String(o.position),
            status: o.status,
            identityVerified: o.identity_verified,
            sourceUrl: o.source_url,
            sourceHash: o.source_hash,
            checkedAt: new Date(o.checked_at).getTime(),
          }
        : undefined;
    }
    const r = current.get(player.id);
    player.verifiedJerseyNumber = r?.verified_jersey_number ?? null;
    if (state.economy.rosterPolicy && player.sport === "nfl") {
      const o = player.roster;
      if (!o) {
        player.status = "unknown";
        continue;
      }
      player.currentTeam = o.team;
      player.status =
        o.status === "active"
          ? "active"
          : o.status === "retired"
            ? "retired"
            : "inactive";
      player.observedAt = o.checkedAt;
      player.sourceRevision = o.sourceHash;
      // Preserve the existing fantasy position. Official source labels are
      // checked separately; a feed relabel must not rewrite lineup identities.
      continue;
    }
    if (!r?.checked_at || !r.team || !r.position) {
      player.status = "unknown";
      continue;
    }
    player.currentTeam = String(r.team);
    player.position = String(r.position);
    player.status =
      r.status === "ACT"
        ? "active"
        : r.status === "RET"
          ? "retired"
          : r.status
            ? "inactive"
            : "unknown";
    player.observedAt = new Date(r.checked_at).getTime();
    player.sourceRevision = String(r.raw_id);
  }
}
