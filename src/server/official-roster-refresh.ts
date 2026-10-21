import type { Sql } from "postgres";
import { createHash } from "node:crypto";
import {
  officialUrl,
  parseOfficialRoster,
  matchKnownRoster,
} from "../core/official-roster-refresh";
/** Refresh only previously verified identities. New players/transfers/ambiguous
 * names stay excluded pending the existing reviewed roster audit. No minting. */
export async function refreshOfficialRosters(sql: Sql) {
  const known = await sql`select * from nfl_roster.refresh_candidates()`;
  const teams = [...new Set(known.map((r) => String(r.team)))];
  const outcomes: {
    team: string;
    refreshed: number;
    unresolved: number;
    status: string;
  }[] = [];
  // Four independent official teams at once; no unlimited network fan-out.
  for (let start = 0; start < teams.length; start += 4)
    await Promise.all(
      teams.slice(start, start + 4).map(async (team) => {
        const url = officialUrl(team);
        if (!url) return;
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(20000),
            redirect: "error",
            headers: { Accept: "text/html" },
          });
          if (!response.ok) throw Error("Official roster unavailable");
          const html = await response.text(),
            rows = parseOfficialRoster(html, url),
            checkedAt = new Date().toISOString(),
            hash = createHash("sha256").update(html).digest("hex");
          const candidates = known.filter((r) => r.team === team),
            updates = candidates.map((p) => {
              const row = matchKnownRoster(rows, p.name, p.fantasy_position);
              return {
                playerId: p.player_id,
                providerId: p.provider_id,
                team,
                position: row?.position ?? p.position,
                status: row?.status ?? "unknown",
                identityVerified: !!row,
                sourceUrl: url,
                sourceHash: hash,
                checkedAt,
                profile: row?.profile ?? null,
              };
            });
          await sql`select nfl_roster.record_refresh(${sql.json(updates)})`;
          outcomes.push({
            team,
            refreshed: updates.filter((r) => r.identityVerified).length,
            unresolved: updates.filter((r) => !r.identityVerified).length,
            status: "checked",
          });
        } catch {
          outcomes.push({
            team,
            refreshed: 0,
            unresolved: known.filter((p) => p.team === team).length,
            status: "unavailable; previous evidence retained",
          });
        }
      }),
    );
  return {
    status: outcomes.some((o) => o.status !== "checked")
      ? "partial"
      : "refreshed",
    teams: outcomes,
  };
}
