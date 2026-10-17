import { createHash } from "node:crypto";
import type { EconomyPlayer } from "./card-economy";
import { nflCardPositions } from "./nfl-card-eligibility";
export function nflEconomyCatalogue(
  mapped: { id: string; provider_id: string }[],
  rows: Record<string, string>[],
  checkedAt: string,
  rawId: string,
): EconomyPlayer[] {
  const known = new Map<string, string>();
  for (const p of mapped) {
    if (known.has(p.provider_id))
      throw Error("Duplicate permanent provider mapping");
    known.set(p.provider_id, p.id);
  }
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    if (
      !/^[0-9]{2}-[0-9]{7}$/.test(row.gsis_id ?? "") ||
      !nflCardPositions.includes(row.position)
    )
      continue;
    const week = Number(row.week);
    if (!Number.isInteger(week) || week < 0) throw Error("Invalid roster week");
    const prior = groups.get(row.gsis_id) ?? [];
    if (!prior.length || week > Number(prior[0].week))
      groups.set(row.gsis_id, [row]);
    else if (week === Number(prior[0].week)) prior.push(row);
  }
  const players: EconomyPlayer[] = [];
  for (const [gsis, records] of groups) {
    const r = records[0];
    if (
      new Set(
        records.map((v) =>
          [v.full_name, v.position, v.team, v.status].join("|"),
        ),
      ).size !== 1
    )
      throw Error(`Conflicting current roster mapping: ${gsis}`);
    if (!r.full_name?.trim() || !r.team?.trim()) continue;
    // Deterministic source namespace only for never-before-mapped identities.
    // Existing Docked UUIDs take precedence. Another provider requires audited reconciliation.
    const id =
      known.get(gsis) ??
      `nfl-${createHash("sha256")
        .update("nflverse:" + gsis)
        .digest("hex")
        .slice(0, 32)}`;
    players.push({
      id,
      provider: "nflverse",
      providerId: gsis,
      sport: "nfl",
      assetKind: "player",
      name: r.full_name,
      position: r.position,
      currentTeam: r.team,
      status:
        r.status === "ACT"
          ? "active"
          : r.status === "RET"
            ? "retired"
            : "inactive",
      observedAt: Date.parse(checkedAt),
      sourceRevision: rawId,
      presentation: "docked-original-shirt-v1",
    });
  }
  if (
    !Number.isFinite(Date.parse(checkedAt)) ||
    players.length < 100 ||
    new Set(
      players.filter((p) => p.status === "active").map((p) => p.currentTeam),
    ).size !== 32
  )
    throw Error("Complete current NFL catalogue evidence required");
  return players;
}
