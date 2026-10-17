import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  normalName,
  aliases,
  supported,
  corroborate,
  rosterDecision,
  mappingOutcome,
  transactionAction,
} from "./nfl-reconciliation-lib.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const out = "docs/qa/nfl-roster-reconciliation";
await mkdir(out, { recursive: true });
const base = await read("docs/qa/nfl-roster-audit/catalogue-audit.json");
const source = await read("private-data/nfl-roster-reconciliation/source.json");
const teams = await read("tmp/nfl-roster-audit/official-rosters.json");
const transactions = await read(
  "tmp/nfl-roster-audit/official-transactions.json",
);
const supplemental = await read(`${out}/supplemental-evidence.json`);
const snapshot = await read("private-data/nfl-roster-audit/latest.json");
assert.equal(
  createHash("sha256")
    .update(await readFile(snapshot.file))
    .digest("hex"),
  snapshot.sha256,
);
const original = await read(snapshot.file);
const providerRows = original.source[0].body.rows;
assert.equal(teams.length, 32);
assert.ok(
  teams.every(
    (t) =>
      t.status === "parsed-review-required" &&
      Date.now() - Date.parse(t.checkedAt) < 72 * 3600000,
  ),
);
const rows = teams.flatMap((t) =>
  t.players.map((r) => ({
    ...r,
    team: t.team,
    url: t.url,
    checkedAt: t.checkedAt,
    sha256: t.sha256,
  })),
);
const key = (r) => `${r.team}|${r.profile}|${r.section}`;
const matchedRows = new Map();
const selectedTeam = { "00-0039373": "CLE" }; // Explicit 13 October signing from MIN PS; source transaction below.
// Individually reviewed multi-action/subject-first rows. Do not let another
// player's injury designation apply to the subject being reviewed.
const reviewedTransactions = {
  "Luke Floriea": [
    "CLE",
    "08/30",
    "released",
    "Ordinary waiver; parenthetical injury designations apply to Travis Bell, Elijah Chatman and Edefuan Ulofoshio, not Luke Floriea",
  ],
  "Jordan Mims": [
    "PHI",
    "08/30",
    "released",
    "Ordinary waiver list; injured qualifier belongs to Andre Sam",
  ],
  "Tahj Washington": [
    "PHI",
    "08/30",
    "released",
    "Ordinary waiver list; injured qualifier belongs to Andre Sam",
  ],
  "Samori Toure": [
    "PHI",
    "08/30",
    "released",
    "Official waiver row spells Samari; same team signing and retained stable ID identify Samori Toure",
  ],
  "Chris Hilton Jr.": [
    "GB",
    "09/15",
    "released",
    "Subject-first official release sentence",
  ],
  "Kobe Prentice": [
    "NYG",
    "08/29",
    "released",
    "Subject-first official waived/no-recall list",
  ],
  "Cody Hardy": [
    "NYJ",
    "09/22",
    "quarantine",
    "Practice-squad signing contradicts absence from current team roster; injury designation in same row concerns other players",
  ],
};
const records = base.records.map((p) => {
  const directories = source.players.filter((d) => d.gsis_id === p.providerId);
  const d = directories.length === 1 ? directories[0] : null;
  let candidates = rows.filter((r) => d && corroborate(d, r));
  const allCandidates = [...candidates];
  if (selectedTeam[p.providerId]) {
    assert.ok(
      transactions
        .find((t) => t.team === "CLE")
        .rows.some(
          (r) =>
            r.startsWith("10/13") &&
            /Signed RB Audric Estime.*active roster from Minnesota/.test(r),
        ),
    );
    candidates = candidates.filter(
      (r) => r.team === selectedTeam[p.providerId],
    );
  }
  let decision = p.decision,
    official = p.official,
    reason = p.reason,
    classification =
      "Existing player with an ID, name, team or position mismatch";
  let verification = "Retained earlier verified official evidence";
  if (candidates.length === 1) {
    official = candidates[0];
    decision = rosterDecision(official, p.position);
    verification =
      "Unique stable provider ID; official profile name/approved alias + college + age (or missing-age exact height/weight)";
    reason =
      decision === "eligible"
        ? "Verified active supported player; existing release/supply rules still apply"
        : decision === "position-review"
          ? "Identity verified; catalogue position differs from official position. Retain historical classification; block new issuance pending reviewed catalogue correction"
          : `Verified ${official.section}; acquisition rule: active supported players only`;
    for (const r of allCandidates)
      matchedRows.set(key(r), {
        id: p.id,
        decision: r.team === official.team ? decision : "superseded-roster-row",
        reason:
          r.team === official.team
            ? reason
            : "13 October CLE signing supersedes stale MIN practice-squad row",
      });
  } else if (p.decision === "quarantine") {
    decision = "quarantine";
    official = null;
    verification = "Insufficient or conflicting official corroboration";
    reason =
      candidates.length > 1
        ? "Multiple corroborated official roster rows; needs dated transaction resolution"
        : "No unique corroborated official current roster identity";
  } else if (p.official) {
    rows
      .filter(
        (r) => r.profile === p.official.profile && r.team === p.official.team,
      )
      .forEach((r) => matchedRows.set(key(r), { id: p.id, decision, reason }));
  }
  if (decision === "quarantine" && !allCandidates.length) {
    // Only unambiguous single-action official transaction sentences qualify.
    // Mixed lists remain unresolved rather than assigning a verb to the wrong player.
    const names = [p.name, aliases[p.providerId], d?.display_name]
      .filter(Boolean)
      .map(normalName);
    const matches = transactions
      .flatMap((t) =>
        (t.rows ?? [])
          .filter((row) => names.some((n) => normalName(row).includes(n)))
          .map((row) => ({
            team: t.team,
            url: t.url,
            checkedAt: t.checkedAt,
            sha256: t.sha256,
            row,
            date: row.slice(0, 5),
          })),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const latest = matches[0];
    const text = latest?.row.slice(5) ?? "";
    const action = transactionAction(text, names);
    const release = action === "released";
    const nameAbsent = rows.every((r) => !names.includes(normalName(r.name)));
    const providerProof =
      (d && normalName(d.display_name) === normalName(p.name)) ||
      providerRows.some(
        (r) =>
          r.gsis_id === p.providerId &&
          normalName(r.full_name) === normalName(p.name) &&
          ({ LA: "LAR", JAC: "JAX", WSH: "WAS" }[r.team] ?? r.team) ===
            latest?.team,
      );
    if (latest && release && nameAbsent && providerProof) {
      decision = "released";
      reason = `Official ${latest.team} ${latest.date} release/waiver/settlement; absent from all 32 current roster lists`;
      official = null;
      verification = {
        url: latest.url,
        sha256: latest.sha256,
        checkedAt: latest.checkedAt,
        date: latest.date,
        team: latest.team,
        kind: "positive-release",
      };
    } else if (action === "reserve-review" && latest) {
      decision = "reserve-review";
      classification =
        "Reserve/practice-squad status requiring explicit classification";
      reason =
        "Latest official transaction records reserve/retirement/injury designation; absent current roster page. Retain identity, no acquisition or removal pending status clarification";
      verification = {
        url: latest.url,
        sha256: latest.sha256,
        checkedAt: latest.checkedAt,
        date: latest.date,
        team: latest.team,
        kind: "reserve-review",
      };
    } else if (!supported(p.position)) {
      decision = "unsupported";
      reason =
        "Catalogue and stable provider identity have unsupported position; no owned assets removed without official proof";
    } else if (source.identities.some((i) => i.external_id === p.providerId)) {
      classification = "Historical identity retained only for statistics";
      reason =
        "Statistics identity exists; current team-listed identity not established. Historical data retained, acquisition blocked";
    } else classification = "Genuinely unresolved identity";
  }
  const supplement = supplemental.find((s) => s.providerId === p.providerId);
  if (supplement && !allCandidates.length) {
    decision =
      supplement.decision === "reserve-retired"
        ? "reserve-review"
        : supplement.decision;
    reason = supplement.reason;
    verification = supplement;
  }
  if (reviewedTransactions[p.name] && !allCandidates.length) {
    const [team, date, result, explanation] = reviewedTransactions[p.name];
    const tx = transactions.find((t) => t.team === team);
    const row = tx.rows.find(
      (r) =>
        r.startsWith(date) &&
        normalName(r).includes(
          normalName(p.name === "Samori Toure" ? "Samari Toure" : p.name),
        ),
    );
    assert.ok(row, "Reviewed transaction preimage missing");
    decision = result;
    reason = explanation;
    verification = {
      url: tx.url,
      sha256: tx.sha256,
      checkedAt: tx.checkedAt,
      date,
      team,
      kind: "individual-review",
      rowHash: createHash("sha256").update(row).digest("hex"),
    };
    classification =
      result === "quarantine"
        ? "Genuinely unresolved identity"
        : classification;
  }
  if (["practice-squad", "reserve", "reserve-review"].includes(decision))
    classification =
      "Reserve/practice-squad status requiring explicit classification";
  if (decision === "unsupported") classification = "Unsupported position";
  if (["released", "retired"].includes(decision))
    classification = "Confirmed released, retired or unsigned player";
  if (decision === "quarantine" && allCandidates.length > 1)
    classification = "Genuinely unresolved identity";
  let correctedPosition;
  if (decision === "position-review") {
    classification =
      "Existing player with an ID, name, team or position mismatch";
    if (p.providerId === "00-0040986") {
      assert.equal(p.definitions, 0);
      assert.equal(p.cardIds.length, 0);
      assert.equal(official.position, "TE");
      assert.equal(d.position, "TE");
      correctedPosition = "TE";
      decision = "practice-squad";
      reason =
        "Correct unissued local catalogue WR to verified TE; no editions, cards or lineup records exist. Practice squad remains excluded from acquisition";
      for (const r of allCandidates)
        matchedRows.set(key(r), { id: p.id, decision, reason });
    }
  }
  const statistics = mappingOutcome(p, source.identities, source.appearances);
  // Current official offensive role validates historical offensive statistics
  // identity; never import IDP fields or rewrite a frozen competition position.
  if (
    decision === "eligible" &&
    statistics.status === "mapping-conflict" &&
    ["Travis Hunter", "Jackson Meeks"].includes(p.name)
  ) {
    statistics.status = "matched-statistical-identity";
    statistics.reason =
      "Individually reviewed stable ID and current official offensive role; source position retained in raw history";
  }
  return {
    ...p,
    previousDecision: p.decision,
    decision,
    correctedPosition,
    classification,
    reason,
    official,
    verification,
    statistics,
  };
});
const coverage = rows
  .filter((r) => supported(r.position))
  .map((r) => {
    const match = matchedRows.get(key(r));
    if (match)
      return {
        ...r,
        docked: match.id,
        outcome: match.decision,
        reason: match.reason,
      };
    const identities = source.players.filter((d) => corroborate(d, r));
    const existing = records.filter((p) =>
      identities.some((d) => d.gsis_id === p.providerId),
    );
    return {
      ...r,
      docked: existing.length === 1 ? existing[0].id : null,
      providerId: identities.length === 1 ? identities[0].gsis_id : null,
      outcome: existing.length
        ? "unresolved"
        : identities.length === 1
          ? "intentionally-unreleased"
          : "unresolved",
      classification: existing.length
        ? "Existing player with an ID, name, team or position mismatch"
        : identities.length === 1
          ? "Current supported-position player missing from the catalogue"
          : "Genuinely unresolved identity",
      reason:
        identities.length === 1 && !existing.length
          ? "Verified current team-listed identity missing from catalogue. No identity, edition, scarcity allocation or cards created; release approval required"
          : "Official roster row retained pending stable-ID corroboration",
    };
  });
const originalMissing = base.missing.map(
  (r) =>
    coverage.find((c) => key(c) === key(r)) ?? { ...r, outcome: "unresolved" },
);
const overlapIds = new Set(
  originalMissing
    .filter(
      (r) =>
        r.docked &&
        base.records.some(
          (p) => p.id === r.docked && p.decision === "quarantine",
        ),
    )
    .map((r) => r.docked),
);
const count = (array, fn) =>
  Object.fromEntries(
    [...new Set(array.map(fn))]
      .sort()
      .map((k) => [k, array.filter((r) => fn(r) === k).length]),
  );
const byTeam = teams.map((t) => ({
  team: t.team,
  positions: Object.fromEntries(
    ["QB", "RB", "WR", "TE"].map((pos) => {
      const rs = coverage.filter((r) => {
        const player = records.find((p) => p.id === r.docked);
        const position =
          player?.correctedPosition ??
          player?.position ??
          r.position
            .split("/")
            .map((p) => (["FB", "HB"].includes(p) ? "RB" : p))
            .find((p) => ["QB", "RB", "WR", "TE"].includes(p));
        // Count each player exactly once in the existing fantasy position:
        // FB/DL remains RB; an existing RB/WR player is not counted twice.
        return r.team === t.team && position === pos;
      });
      return [pos, { rows: rs.length, ...count(rs, (r) => r.outcome) }];
    }),
  ),
}));
for (const t of byTeam) {
  assert.equal(
    Object.values(t.positions).reduce((n, p) => n + p.rows, 0),
    coverage.filter((r) => r.team === t.team).length,
  );
  assert.equal(
    Object.values(t.positions).reduce((n, p) => n + (p.eligible ?? 0), 0),
    coverage.filter((r) => r.team === t.team && r.outcome === "eligible")
      .length,
  );
}
const summary = {
  at: new Date().toISOString(),
  snapshotSha256: snapshot.sha256,
  sourceCache: source.cache,
  dataset: source.meta,
  originalQuarantine: 208,
  originalMissingRows: 49,
  overlapIdentities: overlapIds.size,
  overlapRows: originalMissing.filter((r) => overlapIds.has(r.docked)).length,
  originalMissingOutcomes: count(originalMissing, (r) => r.outcome),
  quarantineClassifications: count(
    records.filter((r) => r.previousDecision === "quarantine"),
    (r) => r.classification,
  ),
  decisions: count(records, (r) => r.decision),
  coverageRows: coverage.length,
  coverageOutcomes: count(coverage, (r) => r.outcome),
  eligibleStatistics: count(
    records.filter((r) => r.decision === "eligible"),
    (r) => r.statistics.status,
  ),
  byTeam,
};
await writeFile(
  `${out}/reconciliation.json`,
  JSON.stringify({ summary, records, coverage, originalMissing }, null, 2),
);
const csv = (rows, fields) =>
  [
    fields.join(","),
    ...rows.map((r) =>
      fields.map((f) => JSON.stringify(String(r[f] ?? ""))).join(","),
    ),
  ].join("\n") + "\n";
await writeFile(
  `${out}/exceptions.csv`,
  csv(
    records
      .filter((r) => r.previousDecision === "quarantine")
      .map((r) => ({
        ...r,
        officialTeam: r.official?.team,
        officialPosition: r.official?.position,
        officialStatus: r.official?.section,
        sourceUrl: r.official?.url ?? r.verification?.url,
      })),
    [
      "id",
      "providerId",
      "name",
      "position",
      "classification",
      "decision",
      "officialTeam",
      "officialPosition",
      "officialStatus",
      "reason",
      "sourceUrl",
    ],
  ),
);
await writeFile(
  `${out}/roster-coverage.csv`,
  csv(coverage, [
    "team",
    "name",
    "position",
    "section",
    "docked",
    "providerId",
    "outcome",
    "reason",
    "profile",
  ]),
);
console.log(JSON.stringify({ ...summary, byTeam: undefined }, null, 2));
console.log(
  "Unresolved roster",
  coverage
    .filter((r) => r.outcome === "unresolved")
    .map((r) => ({ name: r.name, team: r.team })),
);
console.log(
  "Unreleased",
  coverage
    .filter((r) => r.outcome === "intentionally-unreleased")
    .map((r) => ({ name: r.name, team: r.team, id: r.providerId })),
);
