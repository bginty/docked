import { readFile, writeFile, mkdir } from "node:fs/promises";
const out = "docs/qa/nfl-roster-audit";
await mkdir(out, { recursive: true });
const rosters = JSON.parse(
  await readFile("tmp/nfl-roster-audit/official-rosters.json", "utf8"),
);
const { file, sha256 } = JSON.parse(
  await readFile("private-data/nfl-roster-audit/latest.json", "utf8"),
);
const s = JSON.parse(await readFile(file, "utf8"));
let previous = { records: [] };
try {
  previous = JSON.parse(await readFile(`${out}/catalogue-audit.json`, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const normal = (n) =>
  n
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
const team = (t) => ({ LA: "LAR", JAC: "JAX", WSH: "WAS" })[t] ?? t;
const rosterRows = rosters.flatMap((t) =>
  (t.players ?? []).map((p) => ({
    ...p,
    team: t.team,
    url: t.url,
    checkedAt: t.checkedAt,
    sha256: t.sha256,
  })),
);
const sourceRows = s.source[0].body.rows;
const transactions = JSON.parse(
  await readFile("tmp/nfl-roster-audit/official-transactions.json", "utf8"),
);
const aliases = {
  "00-0036988": "Joshua Palmer",
  "00-0038839": "Mitch Tinsley",
  "00-0040879": "Matt Hibner",
};
const compatible = (official, fantasy) =>
  official
    .split("/")
    .some(
      (pos) =>
        pos === fantasy || (fantasy === "RB" && ["FB", "HB"].includes(pos)),
    );
const latest = new Map();
for (const r of sourceRows) {
  if (!latest.has(r.gsis_id) || +latest.get(r.gsis_id).week < +r.week)
    latest.set(r.gsis_id, r);
}
const identities = new Map(
  s.tables["credits_sandbox.permanent_players"]
    .filter((p) => p.sport === "nfl")
    .map((p) => [
      p.id,
      {
        id: p.id,
        name: p.identity.name,
        position: p.identity.position,
        team: p.identity.currentTeam,
        providerId: p.provider_id,
      },
    ]),
);
for (const p of s.tables["beta_fantasy.players"].filter(
  (p) => p.sport === "nfl",
)) {
  const np = s.tables["sports_feed.nfl_players"].find(
    (n) => n.player_id === p.id,
  );
  identities.set(p.id, {
    id: p.id,
    name: p.name,
    position: p.position,
    team: p.team,
    providerId: np?.provider_id ?? null,
  });
}
const records = [...identities.values()].map((p) => {
  const source = latest.get(p.providerId);
  const candidates = rosterRows.filter(
    (r) => normal(r.name) === normal(aliases[p.providerId] ?? p.name),
  );
  const positionCandidates = candidates.filter((r) =>
    compatible(r.position, p.position),
  );
  const narrowed = positionCandidates.length ? positionCandidates : candidates;
  const match = narrowed.length === 1 ? narrowed[0] : null;
  // Name alone never grants eligibility. Independently retained GSIS roster team
  // and jersey number must agree with a unique official team profile.
  const verified = !!(
    source &&
    match &&
    team(source.team) === match.team &&
    String(source.jersey_number) === match.cells[1] &&
    normal(source.full_name) === normal(p.name)
  );
  let decision = "quarantine",
    reason = "No unique corroborated current official identity";
  const tx = transactions.flatMap((t) =>
    (t.rows ?? [])
      .filter((row) => row.toLowerCase().includes(p.name.toLowerCase()))
      .map((row) => ({
        team: t.team,
        url: t.url,
        checkedAt: t.checkedAt,
        sha256: t.sha256,
        row,
      })),
  );
  if (verified) {
    if (
      [
        "K",
        "P",
        "LS",
        "DL",
        "DT",
        "DE",
        "LB",
        "CB",
        "S",
        "DB",
        "OL",
        "OT",
        "OG",
        "C",
      ].includes(match.position)
    ) {
      decision = "unsupported";
      reason = `Official position ${match.position}`;
    } else if (
      !["QB", "RB", "WR", "TE"].includes(p.position) ||
      !match.position
        .split("/")
        .some(
          (pos) =>
            pos === p.position ||
            (p.position === "RB" && ["FB", "HB"].includes(pos)),
        )
    ) {
      decision = "quarantine";
      reason = "Position label requires an audited fantasy mapping";
    } else if (match.section.includes("Retired")) {
      decision = "retired";
      reason = "Official Reserve/Retired listing";
    } else if (/Practice|DEV/.test(match.section)) {
      decision = "practice-squad";
      reason = "Retain identity; no new issuance";
    } else if (match.section !== "Active") {
      decision = "reserve";
      reason = "Retain team-listed identity; distinguish availability";
    } else {
      decision = "eligible";
      reason =
        "Unique official profile corroborated by provider identity, team and jersey";
    }
  }
  // Confirmed explicit release, no current team-listed match anywhere. Never
  // infer this from missing player statistics or an unresolved provider ID.
  if (
    p.providerId === "00-0038824" &&
    candidates.length === 0 &&
    rosters.length === 32 &&
    rosters.every((t) => t.checkedAt.startsWith("2026-")) &&
    rosters.every((t) => t.status === "parsed-review-required") &&
    tx.some(
      (t) =>
        t.team === "MIA" &&
        /10\/13.*Waived wide receiver Ryan Miller/i.test(t.row),
    )
  ) {
    decision = "released";
    reason =
      "Miami official 13 October release; absent across all 32 current official roster pages";
  }
  const legacy = s.tables["beta_fantasy.cards"].filter((c) =>
    s.tables["beta_fantasy.editions"].some(
      (e) => e.id === c.edition_id && e.player_id === p.id,
    ),
  );
  const issued = s.tables["credits_sandbox.card_instances"].filter(
    (c) => c.document.playerId === p.id,
  );
  const prior = previous.records.find(
    (r) => r.id === p.id && r.providerId === p.providerId,
  );
  const priorTeam = prior?.official?.team;
  const teamResponse = rosters.find((t) => t.team === priorTeam);
  const retainPrior =
    decision === "quarantine" &&
    prior?.decision !== "quarantine" &&
    prior?.official &&
    teamResponse?.status !== "parsed-review-required";
  return {
    ...p,
    sourcePosition: source?.position,
    sourceStatus: source?.status,
    sourceTeam: source?.team,
    official: match
      ? {
          name: match.name,
          team: match.team,
          position: match.position,
          section: match.section,
          profile: match.profile,
          url: match.url,
          checkedAt: match.checkedAt,
          sha256: match.sha256,
        }
      : null,
    candidateCount: candidates.length,
    decision,
    reason,
    transactions: tx.map(({ row, ...source }) => ({
      ...source,
      date: row.slice(0, 5),
      matchedName: p.name,
    })),
    definitions:
      s.tables["credits_sandbox.card_definitions"].filter(
        (d) => d.player_id === p.id,
      ).length +
      s.tables["beta_fantasy.editions"].filter((e) => e.player_id === p.id)
        .length,
    cardIds: [...legacy, ...issued].map((c) => c.id),
    ...(retainPrior
      ? {
          official: prior.official,
          decision: prior.decision,
          reason:
            "Upstream roster incomplete: retaining last verified observation; freshness gate still applies",
          freshnessWarning: true,
        }
      : {}),
  };
});
const known = new Set(
  records
    .filter((r) => r.official && r.decision !== "quarantine")
    .map((r) => r.official.profile),
);
const missing = rosterRows.filter(
  (r) => ["QB", "RB", "WR", "TE"].includes(r.position) && !known.has(r.profile),
);
const summary = {
  snapshotSha256: sha256,
  checkedAt: new Date().toISOString(),
  teams: rosters.map((t) => ({
    team: t.team,
    url: t.url,
    transactions: t.transactions,
    checkedAt: t.checkedAt,
    sha256: t.sha256,
    status: t.status,
    rows: t.players?.length ?? 0,
    supported:
      t.players?.filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
        .length ?? 0,
  })),
  players: records.length,
  decisions: Object.fromEntries(
    [...new Set(records.map((p) => p.decision))].map((k) => [
      k,
      records.filter((p) => p.decision === k).length,
    ]),
  ),
  missingCandidates: missing.length,
};
await writeFile(
  `${out}/catalogue-audit.json`,
  JSON.stringify({ summary, records, missing }, null, 2),
);
console.log(JSON.stringify({ ...summary, teams: summary.teams.length }));
console.log(
  "Affected verified unsupported",
  records
    .filter(
      (p) =>
        ["unsupported", "retired"].includes(p.decision) && p.cardIds.length,
    )
    .map((p) => ({
      name: p.name,
      pos: p.official.position,
      cards: p.cardIds.length,
    })),
);
console.log(
  "Unmatched with cards",
  records
    .filter((p) => !p.official && p.cardIds.length)
    .map((p) => ({
      name: p.name,
      team: p.team,
      status: p.sourceStatus,
      cards: p.cardIds.length,
    })),
);
