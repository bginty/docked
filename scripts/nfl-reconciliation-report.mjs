import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "docs/qa/nfl-roster-reconciliation";
const read = async (file) =>
  JSON.parse(await readFile(`${dir}/${file}`, "utf8"));
const a = await read("reconciliation.json");
const v = await read("local-verification.json");
const s = a.summary;
assert.equal(a.records.length, 986);
assert.equal(
  a.records.filter((p) => p.previousDecision === "quarantine").length,
  208,
);
assert.equal(a.originalMissing.length, 49);
assert.equal(a.coverage.filter((p) => p.outcome === "unresolved").length, 0);
const table = (headers, rows) =>
  [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
const csv = (headers, rows) =>
  [
    headers.join(","),
    ...rows.map((r) =>
      r.map((s) => `"${String(s ?? "").replaceAll('"', '""')}"`).join(","),
    ),
  ].join("\n") + "\n";
const positionRows = s.byTeam.flatMap((t) =>
  Object.entries(t.positions).map(([position, counts]) => [
    t.team,
    position,
    counts.rows,
    counts.eligible ?? 0,
    counts["practice-squad"] ?? 0,
    counts.reserve ?? 0,
    counts["intentionally-unreleased"] ?? 0,
    counts["superseded-roster-row"] ?? 0,
  ]),
);
const positionHeaders = [
  "Team",
  "Position",
  "Official rows",
  "Eligible",
  "Practice squad",
  "Reserve",
  "Unreleased",
  "Superseded",
];
await writeFile(
  `${dir}/team-position-coverage.csv`,
  csv(positionHeaders, positionRows),
);
const teamRows = s.byTeam.map((t) => {
  const rows = a.coverage.filter((p) => p.team === t.team);
  return [
    t.team,
    ...["QB", "RB", "WR", "TE"].map((p) => t.positions[p].eligible ?? 0),
    ...[
      "eligible",
      "practice-squad",
      "reserve",
      "intentionally-unreleased",
      "superseded-roster-row",
    ].map((status) => rows.filter((p) => p.outcome === status).length),
  ];
});
const pending = a.records.filter((p) =>
  ["quarantine", "reserve-review"].includes(p.decision),
);
await writeFile(
  `${dir}/pending-status-cases.csv`,
  csv(
    [
      "Player",
      "Provider ID",
      "Position",
      "Decision",
      "Reason",
      "Official evidence",
    ],
    pending.map((p) => [
      p.name,
      p.providerId,
      p.position,
      p.decision,
      p.reason,
      p.verification?.url ?? p.transactions?.at(-1)?.url,
    ]),
  ),
);
await writeFile(
  `${dir}/original-49-roster-rows.csv`,
  csv(
    [
      "Team",
      "Player",
      "Position",
      "Roster section",
      "Docked ID",
      "Provider ID",
      "Classification",
      "Outcome",
      "Reason",
      "Official evidence",
    ],
    a.originalMissing.map((p) => [
      p.team,
      p.name,
      p.position,
      p.section,
      p.docked,
      p.providerId ?? a.records.find((r) => r.id === p.docked)?.providerId,
      p.classification ?? a.records.find((r) => r.id === p.docked)?.classification,
      p.outcome,
      p.reason,
      p.profile,
    ]),
  ),
);
await writeFile(
  `${dir}/eligible-statistics.csv`,
  csv(
    [
      "Team",
      "Player",
      "Position",
      "Docked ID",
      "Provider ID",
      "Statistical identity",
      "Status",
    ],
    a.records
      .filter((p) => p.decision === "eligible")
      .map((p) => [
        p.official.team,
        p.name,
        p.position,
        p.id,
        p.providerId,
        p.statistics.canonical,
        p.statistics.status,
      ]),
  ),
);
const categories = [
  "Current supported-position player missing from the catalogue",
  "Existing player with an ID, name, team or position mismatch",
  "Reserve/practice-squad status requiring explicit classification",
  "Unsupported position",
  "Confirmed released, retired or unsigned player",
  "Historical identity retained only for statistics",
  "Genuinely unresolved identity",
];
const body = `# NFL roster reconciliation — 17 October 2026

Continuation of accepted commit 08298555. This is isolated local verification, not hosted activation. The fresh 32-team official roster collection from 05:22–05:23 UTC was reused; targeted official transactions and seven supplementary official news pages resolve exceptions. Source URLs, timestamps and SHA-256 hashes are retained in reconciliation.json and supplemental-evidence.json. No player is removed solely for an absent statistic or failed name match.

## Outcome and overlap

${table(
  ["Classification", "Original 208 identities"],
  categories.map((c) => [c, s.quarantineClassifications[c] ?? 0]),
)}

The 49 original missing roster rows overlap the 208 quarantined identities by **${s.overlapIdentities} distinct identities / ${s.overlapRows} rows**. Audric Estimé appears on both MIN and CLE roster pages; CLE's dated 13 October signing from MIN's practice squad supersedes the stale MIN row. The other four rows are actual catalogue omissions. Therefore the two exception lists must not be added as 257 separate people. All 208 cases are in [exceptions.csv](exceptions.csv); all 49 original rows are in [original-49-roster-rows.csv](original-49-roster-rows.csv).

${table(["Original 49 outcome", "Rows"], Object.entries(s.originalMissingOutcomes))}

Four formerly quarantined identities now qualify: Audric Estimé, Joe Milton III, Marquise/Hollywood Brown and Andrew/Drew Ogletree. The fifth identity mismatch is Ty Pezza: corrected **only in the prepared unissued local catalogue** from WR to official TE. His stable identity has no editions, owned cards or historical lineup records; practice-squad status still excludes acquisition. Full team IDs and historical raw provider positions remain intact.

## Coverage in both directions

**493 active supported catalogue players** pass fresh official evidence and position checks. All **791 supported official roster rows** have an explicit outcome: 493 eligible, 189 practice squad, 104 reserve, four deliberately unreleased catalogue omissions and one superseded row. Zero current supported roster rows remain unaccounted for. Practice-squad/development and reserve players are excluded from new acquisition by the existing active-only policy, not declared departed.

The four verified omissions are **Justin Watson (KC), Jake Browning (LAC), Luke Grimm (LAC), Al-Jay Henderson (NYJ)**. All are practice squad. They remain intentionally unreleased; no new player, edition, card or scarcity allocation was created. Roster eligibility is only a gate: product, release, permanent supply and serial rules remain authoritative.

Active eligible counts by team and fantasy position follow. RB includes already-approved FB/HB mappings (including FB/DL); dual-role players count once in their existing Docked fantasy position, for example WR/CB as WR and Eli Heidenreich's RB/WR as RB. PS/reserve counts include supported positions, while the four missing catalogue rows are shown separately to avoid double counting.

${table(["Team", "QB", "RB", "WR", "TE", "Eligible", "PS", "Reserve", "Unreleased", "Superseded"], teamRows)}

The full team × position × disposition matrix is [team-position-coverage.csv](team-position-coverage.csv). Individual official roster evidence is [roster-coverage.csv](roster-coverage.csv).

## Remaining evidence limitations

**Cam Camper (00-0040324) and Cody Hardy (00-0041327)** have official NYJ practice-squad signing evidence but are absent from the current official roster page. Their current status remains genuinely unresolved. Neither has an owned test card. They cannot enter new packs or administrative issuance. Do not declare them released without a subsequent official transaction or corrected roster evidence.

**${pending.filter((p) => p.decision === "reserve-review").length} additional reserve-status cases** have explicit reserve/retired, waived-injured or practice-squad-injured evidence but are absent from the current roster page. They remain retained and excluded pending authoritative status clarification. This includes retirement-list identities; retirement alone does not justify deleting a still-reserved identity. These are status exceptions, not statistical mapping failures. The complete list and specific evidence are in [pending-status-cases.csv](pending-status-cases.csv).

${table(
  ["Player", "Position", "Disposition"],
  pending.map((p) => [p.name, p.position, p.decision]),
)}

There are **zero uncertain owned cards** across both the aggregate economy and legacy inventory, and **zero uncertain recorded lineup selections**. Thus no uncertain owned card is currently selectable. This does not add a blanket injury-based lineup prohibition: ordinary ownership, position, salary, duplicate-player and kickoff rules remain unchanged for retained owned cards. Audric Estimé's existing card is retained under the corrected CLE evidence.

## Cleanup and integrity

**No additional players, cards, ownership records or dependent test records were removed.** The accepted eight-card/seven-player cleanup remains the only removal. Its manifest and recovery snapshot are untouched. New preimage recovery and an empty additional-removal manifest were written before preparing the local catalogue. No replacement cards or credits were issued, and no lineup total needed recalculation.

- Accepted original snapshot SHA-256: ${s.snapshotSha256}.
- Prepared-copy preimage SHA-256: ${v.recoverySnapshot} (private recovery files are not committed).
- Preserved active aggregate cards: ${v.activeAggregateCards}; legacy cards: ${v.legacyCards}.
- Existing consumed serial tombstones, allocation receipts, supply definitions, ownership, wallets, accounts, historical statistics and recorded entries are unchanged.
- Dependency checks passed for ${Object.entries(v.checkedLegacyReferences)
  .map(([k, n]) => `${k}: ${n}`)
  .join(
    ", ",
  )}. No active orphan references found. Original removed IDs remain absent.
- Local preparation uses a PGlite audit mirror and a separate prepared state file, not a full production database restore. No remote connection or production mutation is in the apply runner.

## Feed mapping and proof

${table(
  ["Eligible Docked players", "Count"],
  [
    ["Verified statistical identities", v.mapped],
    [
      "No recorded appearances in supplied season dataset",
      v.noRecordedAppearances,
    ],
    ["Mapping conflicts", v.mappingConflicts],
    ["Total", v.verifiedEligible],
  ],
)}

The 60 players without observations have verified roster identities. Their lack of a canonical feed observation is **not a mapping failure, DNP or confirmed zero**. The dataset's canonical entities are observation-derived. Eight explicit position reviews resolve six existing RB/FB/HB labels plus Travis Hunter's offensive WR/CB role and Jackson Meeks' current TE role. Raw historical positions are retained; no IDP scoring or competition rules were added. See [position-reviews.json](position-reviews.json), [eligible-statistics.csv](eligible-statistics.csv) and the dataset-bound [reviewed-feed-mappings.json](reviewed-feed-mappings.json).

The actual separate Python API ran against an isolated copy of its SQLite database over authenticated loopback HTTP. The existing localhost:8080 service was unavailable; this is not evidence of a running hosted service. The original SQLite hash was unchanged. The API returned **5,569 records**, **272 scheduled games**, **74 available games**, **six incomplete games** and **192 not-started games**. The handover's 80 final games includes the six incomplete games, rather than 80 fully complete games plus six.

Real Carson Wentz week 2: 143 × 0.04 passing yards + 6 × 0.1 rushing yards = **6.32**. Week 1 19.22 + week 2 6.32 = observed season **25.54**. The isolated recorded seven-card lineup scored **33.64**. Duplicate import produced no new journal revision. A labelled local +1 reception correction changed it to **34.64** and the affected season subtotal by 1.00; explicit resync restored original totals. Missing required fields stay incomplete. The six anonymous source rows are a separate source-data blocker to affected result finalisation, not one of the two roster identity exceptions.

Configuration: **docked-nfl-postgame-full-ppr-test-v1**, fumbles lost **−2 once per player**, receptions **1**; existing approved competition versions are unchanged. No current ownership is used to award historical team points. Evidence: [real-api-verification.json](feed-verification/real-api-verification.json), [real-game-journal.json](feed-verification/real-game-journal.json), [resync.json](feed-verification/resync.json), [scoring-configuration.json](feed-verification/scoring-configuration.json).

## Acquisition guards and next step

The prepared aggregate state explicitly enables official-nfl-roster-v1. Both active Standard and Premium product pools contain 493 verified players; uncertain, reserve, unsupported and departed identities are excluded. Stale evidence fails closed after 72 hours. Pregenerated ineligible packs require review rather than rerolling or charging.

Focused SQL tests exercise the existing shared eligibility guard on direct administrative issuance and pack allocation, including legacy and aggregate paths; Starter/Weekly Core migrations also use it. These tests run on isolated databases. Hosted controls were **not enabled**, and production's configuration has not been asserted to match this prepared state. Hosted activation must install fresh evidence and verify all guards on the exact isolated target.

Focused verification: **12 platform tests and four database tests passed**, plus typecheck and targeted lint. The actual API proof passed; the existing-build client scan found no known canary markers. Scope, commands and limitations are recorded in [VERIFICATION.md](VERIFICATION.md).

See [the concrete hosted testing plan](../../NFL_HOSTED_TESTING_PLAN.md). No services were purchased, computer exposed, production changes made or hosted ingestion activated.
`;
await writeFile(`${dir}/README.md`, body);
console.log({
  eligible: v.verifiedEligible,
  teamPositionRows: positionRows.length,
  pendingStatusCases: pending.length,
});
