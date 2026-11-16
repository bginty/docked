import type { Sql, TransactionSql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
import { isFixtureSport } from "../core/fixture-sports";
import { isRosterBetaPlayer } from "../core/roster-beta";
/** Current season/team/status are observations, never new permanent identities. */
export async function refreshEconomyCatalogue(
  sql: Sql | TransactionSql,
  state: CreditsState,
  purchaseProduct?: string,
) {
  if (!state.economy) return;
  if (
    Object.values(state.economy.products).some(
      (p) => p.cataloguePolicy === "founder-credit-season-v1",
    )
  ) {
    const [row] = await sql`select beta_packs.catalogue() value`;
    const projection = row.value as {
      enabled: boolean;
      players: {
        legacyPlayer: string;
        canonicalPlayer: string;
        team: string;
        definitions: { rarity: string; issued: number }[];
      }[];
    };
    state.economy.founderCatalogue = {
      enabled: projection.enabled,
      players: {},
    };
    for (const p of projection.players) {
      if (
        !state.economy.players[p.legacyPlayer] ||
        p.definitions.length !== 5 ||
        p.definitions.some(
          (d) =>
            d.issued !==
            (state.economy!.definitions[`${p.legacyPlayer}:${d.rarity}`]
              ?.issued ?? 0),
        )
      )
        continue;
      state.economy.founderCatalogue.players[p.legacyPlayer] = {
        canonicalPlayer: p.canonicalPlayer,
        team: p.team,
      };
    }
  }
  // A season-approved purchase uses the retained, permission-checked catalogue
  // above. Live roster/jersey observations do not define that issuance pool.
  // Non-season products and ordinary presentation reads retain their checks.
  if (
    purchaseProduct &&
    state.economy.products[purchaseProduct]?.cataloguePolicy ===
      "founder-credit-season-v1"
  )
    return;
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
    // These registered, isolated catalogues have their own provenance. The NFL
    // observations cannot invalidate them or rewrite their immutable identity.
    // Invalid roster evidence still fails closed below; a sport alone is no bypass.
    if (
      (player.synthetic && isFixtureSport(player.sport)) ||
      isRosterBetaPlayer(player)
    )
      continue;
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
