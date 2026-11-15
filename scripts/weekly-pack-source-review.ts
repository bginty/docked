// Read-only hosted inspection + public source research. Never refreshes hosted
// evidence, changes a permit, opens a pack or writes any hosted database row.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { fetchNflDataset } from "../src/server/nflverse-bundle";
import {
  officialUrl,
  parseOfficialRoster,
  matchKnownRoster,
} from "../src/core/official-roster-refresh";

async function main() {
  const root = process.cwd();
  process.chdir(process.env.DOCKED_PRIVATE_ROOT ?? root);
  const db = ownerDatabase();
  process.chdir(root);
  const snapshot = await db
    .begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local statement_timeout='30s'`;
      const known = await tx`select * from nfl_roster.refresh_candidates()`;
      const pool =
        await tx`select np.player_id::text, np.provider_id, pl.position,
      nfl_roster.can_issue(pl.id::text,pl.position) official_fresh,
      np.source_status='ACT' and np.observed_at<=now() and np.observed_at>now()-interval '72 hours' feed_fresh
      from sports_feed.nfl_players np join beta_fantasy.players pl on pl.id=np.player_id
      join beta_fantasy.editions e on e.id=np.edition_id
      where pl.sport='nfl' and pl.position in('QB','RB','WR','TE') and pl.status not in('retired','delisted')
      and e.tier='CORE' and e.status='launched' and e.launch_at<=now() and e.issued<e.max_supply`;
      const dates =
        await tx`select (select max(observed_at) from sports_feed.nfl_players) feed,
      (select max(checked_at) from nfl_roster.current_evidence) official`;
      return { known, pool, dates: dates[0] };
    })
    .finally(() => db.end());

  const source = await fetchNflDataset("rosters", 2026, {});
  assert(
    !source.notModified,
    "Unconditional source check must return source bytes",
  );
  const teams = [...new Set(snapshot.known.map((p) => String(p.team)))];
  const official = new Set<string>();
  const outcomes: {
    team: string;
    checkedAt: string;
    sourceHash?: string;
    active?: number;
    status: string;
  }[] = [];
  for (let offset = 0; offset < teams.length; offset += 4) {
    await Promise.all(
      teams.slice(offset, offset + 4).map(async (team) => {
        const url = officialUrl(team);
        if (!url) throw Error("Unrecognised previously reviewed team");
        try {
          const r = await fetch(url, {
            redirect: "error",
            signal: AbortSignal.timeout(20000),
            headers: { Accept: "text/html" },
          });
          if (!r.ok) throw Error("Roster unavailable");
          const html = await r.text();
          const rows = parseOfficialRoster(html, url);
          let active = 0;
          for (const p of snapshot.known.filter((p) => p.team === team)) {
            if (
              matchKnownRoster(rows, p.name, p.fantasy_position)?.status ===
              "active"
            ) {
              official.add(p.player_id);
              active++;
            }
          }
          outcomes.push({
            team,
            checkedAt: new Date().toISOString(),
            status: "checked",
            active,
            sourceHash: createHash("sha256").update(html).digest("hex"),
          });
        } catch {
          outcomes.push({
            team,
            checkedAt: new Date().toISOString(),
            status: "unavailable; no eligibility inferred",
          });
        }
      }),
    );
  }
  const active = new Set(
    source.body.rows.filter((r) => r.status === "ACT").map((r) => r.gsis_id),
  );
  const eligible = snapshot.pool.filter(
    (p) => official.has(p.player_id) && active.has(p.provider_id),
  );
  const report = {
    checkedAt: new Date().toISOString(),
    scope: "read-only research; no hosted evidence refreshed or cards issued",
    hosted: {
      candidates: snapshot.pool.length,
      eligible: snapshot.pool.filter((p) => p.official_fresh && p.feed_fresh)
        .length,
      lastObservations: snapshot.dates,
    },
    source: {
      url: source.body.source,
      sha256: source.body.sourceSha256,
      modifiedAt: source.modified,
      rows: source.body.rows.length,
    },
    officialTeams: outcomes.sort((a, b) => a.team.localeCompare(b.team)),
    projectedEligibleWeeklyPlayers: eligible.length,
    enoughForFourCoreCards: eligible.length >= 4,
    limitations:
      "Projection only. Requires approved genuine refresh and fresh hosted postcheck; source research does not approve commercial player, image or trademark rights.",
  };
  const directory = resolve("docs/qa/weekly-pack-recovery-20261115");
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "source-review.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      hostedEligible: report.hosted.eligible,
      projectedEligible: eligible.length,
      officialTeamsChecked: outcomes.filter((o) => o.status === "checked")
        .length,
      noHostedWrites: true,
    }),
  );
}
main().catch(() => {
  console.error(
    "Read-only source review incomplete; no hosted writes attempted. Inspect source availability before approval.",
  );
  process.exitCode = 1;
});
