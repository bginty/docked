import type { Sql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
/** Current season/team/status are observations, never new permanent identities. */
export async function refreshEconomyCatalogue(sql: Sql, state: CreditsState) {
  if (!state.economy) return;
  const rows =
    await sql`select c.*,j.verified_jersey_number from credits_sandbox.current_player_status c left join credits_sandbox.current_player_jerseys j on j.id=c.id`;
  const current = new Map(rows.map((r) => [String(r.id), r]));
  for (const player of Object.values(state.economy.players)) {
    const r = current.get(player.id);
    player.verifiedJerseyNumber = r?.verified_jersey_number ?? null;
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
