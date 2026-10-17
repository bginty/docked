import { readFile, writeFile } from "node:fs/promises";
const dir = "docs/qa/nfl-roster-audit";
const read = async (name) =>
  JSON.parse(await readFile(`${dir}/${name}.json`, "utf8"));
const audit = await read("catalogue-audit"),
  catalogue = await read("local-catalogue"),
  cleanup = await read("cleanup-result"),
  feed = await read("feed-mapping-review");
const transactions = JSON.parse(
  await readFile("tmp/nfl-roster-audit/official-transactions.json", "utf8"),
);
const count = (rows, key) =>
  Object.fromEntries(
    [...new Set(rows.map((r) => r[key]))].map((k) => [
      k,
      rows.filter((r) => r[key] === k).length,
    ]),
  );
const positionCounts = count(
  audit.records.filter((r) => r.decision === "eligible"),
  "position",
);
const feedCounts = count(feed, "rosterDecision");
const csv = (rows) =>
  rows
    .map((r) =>
      r.map((x) => '"' + String(x ?? "").replaceAll('"', '""') + '"').join(","),
    )
    .join("\n") + "\n";
await writeFile(
  `${dir}/catalogue-audit.csv`,
  csv([
    [
      "Docked ID",
      "GSIS ID",
      "Name",
      "Fantasy position",
      "Source position",
      "Current official team",
      "Official section",
      "Decision",
      "Reason",
      "Definitions",
      "Owned/issued card IDs",
      "Official source",
      "Checked UTC",
    ],
    ...audit.records.map((r) => [
      r.id,
      r.providerId,
      r.name,
      r.position,
      r.official?.position ?? r.sourcePosition,
      r.official?.team,
      r.official?.section,
      r.decision,
      r.reason,
      r.definitions,
      r.cardIds.join(";"),
      r.official?.url ?? r.transactions[0]?.url,
      r.official?.checkedAt ?? r.transactions[0]?.checkedAt,
    ]),
  ]),
);
await writeFile(
  `${dir}/removals.csv`,
  csv([
    ["Player", "Player ID", "Card ID", "Reason"],
    ...cleanup.removedPlayers.flatMap((p) =>
      p.cards.map((id) => [
        p.name,
        p.id,
        id,
        audit.records.find((r) => r.id === p.id).reason,
      ]),
    ),
  ]),
);
const teamTable = audit.summary.teams
  .map((t) => {
    const tx = transactions.find((x) => x.team === t.team),
      positions = catalogue.eligibleByTeam[t.team] ?? {};
    return `| ${t.team} | [Roster](${t.url}) | ${t.checkedAt} | ${t.rows} | ${positions.QB ?? 0}/${positions.RB ?? 0}/${positions.WR ?? 0}/${positions.TE ?? 0} | [${tx.status}](${tx.url}) |`;
  })
  .join("\n");
const removedTable = cleanup.removedPlayers
  .flatMap((p) =>
    p.cards.map(
      (id) =>
        `| ${p.name} | ${id} | ${audit.records.find((r) => r.id === p.id).reason} |`,
    ),
  )
  .join("\n");
const text = `# NFL roster audit and isolated test cleanup — 17 October 2026

Production was read only to create a consistent local snapshot. No hosted rows, balances, roles, feature flags or deployments were changed. Cleanup was committed atomically in an isolated PGlite audit mirror and exported as a separate local prepared state. This is **not** a claim that Barry's live collection has changed or that a full production-schema cleanup migration has run.

## Coverage and decisions

All 32 official team roster pages were retrieved and parsed; their player tables, sections, source URLs, retrieval dates and SHA-256 hashes were retained. Transaction tables were retrieved for 31 teams. Dallas's transaction endpoint returned HTTP 404; its roster was available. Pages are labelled parsed-review-required because unresolved identities remain, not because teams were skipped.

986 existing permanent NFL identities were reconciled. Decisions: ${Object.entries(
  audit.summary.decisions,
)
  .map(([k, v]) => `${k}: **${v}**`)
  .join("; ")}. Verified active positions: ${Object.entries(positionCounts)
  .map(([k, v]) => `${k}: ${v}`)
  .join(
    ", ",
  )}. The active Standard and Premium acquisition pools each changed **490 → 489** at the audit timestamp. These are fresh, supported product pools, not the total 986-identity historical catalogue.

49 supported-position official-roster rows need identity/catalogue reconciliation. They include unresolved matches as well as possible missing identities; they are **not 49 proven new players**. No new player IDs, definitions, cards or credits were created. A missing definition does not by itself prove a player is unreleased. The existing test product has no distinct first-year/release-approval field; this audit cannot certify a separate rookie release plan. It retains existing product/version, supply and issuance gates.

Full per-player evidence: [JSON](catalogue-audit.json), [CSV](catalogue-audit.csv). Team counts below list eligible QB/RB/WR/TE, excluding reserve/practice-squad/quarantined players.

| Team | Official source | Checked UTC | Roster rows | QB/RB/WR/TE | Transactions |
|---|---|---|---:|---|---|
${teamTable}

## Exact local removals

Eight active test card instances, eight current ownership records and eight active ownership-history projections were removed for seven players. Original history and approvals were archived, not erased. Six players are verified kickers; Docked's seven-player rules support QB/RB/WR/TE only. Ryan Miller has an explicit Miami release on 13 October and no match across all 32 current official roster pages. [Miami announcement](https://www.miamidolphins.com/news/dolphins-make-roster-moves-x9196).

| Player | Removed card ID | Evidence/reason |
|---|---|---|
${removedTable}

Exact player IDs and dependencies: [pre-execution removal manifest](removal-manifest.json), [result](cleanup-result.json), [CSV](removals.csv).

Zero listings, swaps, private offers, unopened packs, test lineups or drafts referenced these eight cards. No lineup recalculation was needed; no selections were invented. Six already-opened saved pack views now show seven or eight remaining cards and an audit notice. Their original nine-card issuance receipts remain immutable historical records. Eight retired allocation tombstones permanently consume their serials; scarcity and approved maximum supply are unchanged.

The cleanup checks active ownership, card instances, pack sources, listing and offer references, plus captured relational dependencies. There are zero active orphan references. Audit tombstones and immutable receipts intentionally reference removed allocations. Wallet journals/lots, accounts, unrelated cards and every other captured table compare unchanged. Historical player statistics were not written or recalculated.

## Recovery and execution evidence

The repeatable-read, read-only snapshot is stored privately at 'private-data/nfl-roster-audit/snapshot-1792214552985.json' (not committed). SHA-256: '${cleanup.snapshotSha256}'.

The pre-execution manifest was written before the local transaction. Reruns preserve its original timestamp and validate source, manifest and post-state hashes. The local PGlite transaction locks the copy, records the manifest/archive and changes the copy atomically. A second execution is a no-op. Local outputs: 'private-data/nfl-roster-audit/cleaned-local-copy.json' and 'verified-local-state.json'; audit database: 'tmp/nfl-roster-cleanup-7f79214ed0ae'.

The local runner fails closed if a new relational lineup/pack/trading dependency appears. It does not pretend to support arbitrary historical lineup rewrites. The captured removal set has none. Restore locally by verifying the snapshot hash, loading its preimage into a new isolated store and retaining the removal audit; never overwrite a hosted database with this export.

## Feed mapping review and remaining identities

All 56 missing feed identities and nine position conflicts were revisited. Current roster classification: ${Object.entries(
  feedCounts,
)
  .map(([k, v]) => `${k}: ${v}`)
  .join(
    ", ",
  )}. See [65-record review](feed-mapping-review.json). A roster match does not establish a historical feed identity; no fuzzy-name mappings or historical score rewrites were applied.

208 catalogue records remain quarantined from new issuance. Their owned cards remain unless separately verified for removal. Examples include Audric Estimé appearing on both Cleveland and Minnesota official rosters; that conflict does not justify deleting his card. Justin Jefferson and Michael Carter name collisions are disambiguated using the existing GSIS identity, official profile, team, jersey and position. Three explicit corroborated aliases are retained in the reconciliation command. IR, PUP/NFI, suspended and practice-squad identities are retained. Absence from a statistics feed never proves release.

## Implemented enforcement

The shared acquisition policy derives positions from 'config/nfl-seven-v1.json'. It requires a verified official identity, supported position, active status and evidence at most 72 hours old when the versioned roster policy is enabled. FB/HB labels preserve an existing fantasy RB classification; dual-role labels do not introduce IDP. The same gate is used in pack preview and secure allocation. Unopened pre-generated packs with newly ineligible players are held for review without charge, reroll or loss of entitlement. Existing saved results remain viewable.

The prepared SQL migration adds private append-only evidence, least-privilege runtime reads and direct mint guards on both card stores. Official evidence is explicitly disabled in the migration until reviewed activation; unsupported NFL positions are always denied by its mint guard. Historical lineup/scoring rules are unchanged. The schema is tested locally; it has not been installed remotely.

See [central policy and rollout plan](../../NFL_ROSTER_POLICY.md) for refresh, outage, activation and rollback details. Hosted cleanup requires a separate reviewed archive/projection-guard transition: the current production immutable aggregate guard must not be bypassed to install the cleaned JSON. The second prepared migration applies the same gate before starter and Weekly Core SQL selection. The full-schema weekly test verifies insufficient-pool rollback, entitlement preservation and successful opening after a verified roster update. Hosted acceptance remains pending.

## Verification

- Platform regressions: 454 cases; initial run passed 451, with three disposable Git-fixture failures caused by sandbox permissions. Those same three passed outside the sandbox. Both logs retained.
- Database regressions: 177/177 passed in isolated PostgreSQL-compatible tests.
- Focused eligibility/cleanup/catalogue and SQL tests: 7/7 passed, including stale evidence, reserve/PS, upstream failure, trades, conflicting IDs, direct mint denial, rollback, private evidence, entitlement preservation, retry identity validation and replay notices.
- Clean production build and client-boundary canary scan passed; initial build attempt was blocked by Windows junction permissions and was retried outside the sandbox. No credentials were used by the build.
- Typecheck and lint passed. Final logs are retained beside this report.
- Actual shared pack viewer rendered at 1440, 1024, 412 and 360px with a real cleaned local saved receipt. Removal notice and controls were inspected. Reveal All showed only retained cards; Escape closed the dialog and released the body scroll lock at all four widths. No horizontal overflow. These are local component/browser checks, not authenticated hosted or physical Samsung acceptance.

[Desktop replay](replay-1440.png) · [Tablet replay](replay-1024.png) · [412px replay](replay-412.png) · [360px replay](replay-360.png).

No Preview or production deployment was performed. Production cleanup, unresolved identity approval, hosted evidence refresh and physical-device checks remain pending.
`;
await writeFile(`${dir}/README.md`, text);
console.log({
  positionCounts,
  feedCounts,
  removals: cleanup.removedCards,
  teams: audit.summary.teams.length,
});
