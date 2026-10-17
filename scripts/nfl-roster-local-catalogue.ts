import { readFile, writeFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { digest } from "../src/core/scoring-engine";
import { eligibleCatalogue } from "../src/core/card-economy";
import {
  nflCardEligibility,
  type NflRosterEvidence,
} from "../src/core/nfl-card-eligibility";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  if (process.env.VERCEL) throw Error("Local only");
  const audit = JSON.parse(
    await readFile("docs/qa/nfl-roster-audit/catalogue-audit.json", "utf8"),
  );
  const clean = JSON.parse(
    await readFile(
      "private-data/nfl-roster-audit/cleaned-local-copy.json",
      "utf8",
    ),
  );
  const before: CreditsState =
    clean.tables["credits_sandbox.state"][0].document;
  const s = structuredClone(before),
    e = s.economy!;
  const now = Date.now();
  e.rosterPolicy = "official-nfl-roster-v1";
  const observations: NflRosterEvidence[] = [];
  for (const p of Object.values(e.players)) {
    const r = audit.records.find((r: any) => r.id === p.id);
    if (!r || r.decision === "quarantine") {
      delete p.roster;
      p.status = "unknown";
      continue;
    }
    const source =
      r.official ?? r.transactions.find((t: any) => t.team === r.sourceTeam);
    if (!source) throw Error("Verified source missing");
    const statuses: Record<string, NflRosterEvidence["status"]> = {
      eligible: "active",
      unsupported: "active",
      "practice-squad": "practice-squad",
      reserve: "reserve",
      released: "released",
      retired: "retired",
    };
    const status = statuses[r.decision];
    const observation: NflRosterEvidence = {
      policy: "official-nfl-roster-v1",
      playerId: p.id,
      providerId: p.providerId,
      team: r.official?.team ?? r.sourceTeam,
      position: r.official?.position ?? r.position,
      status,
      identityVerified: true,
      sourceUrl: source.url,
      sourceHash: source.sha256,
      checkedAt: Date.parse(source.checkedAt),
    };
    p.roster = observation;
    p.currentTeam = observation.team;
    p.observedAt = observation.checkedAt;
    p.sourceRevision = observation.sourceHash;
    p.status =
      status === "active"
        ? "active"
        : status === "retired"
          ? "retired"
          : "inactive";
    observations.push(observation);
  }
  const sourceState = JSON.parse(
    await readFile(
      JSON.parse(
        await readFile("private-data/nfl-roster-audit/latest.json", "utf8"),
      ).file,
      "utf8",
    ),
  ).tables["credits_sandbox.state"][0].document;
  const active = e.activeProductVersions ?? Object.keys(e.products);
  const counts = active.map((id) => ({
    product: id,
    beforeFreshPool: eligibleCatalogue(
      sourceState.economy,
      sourceState.economy.products[id],
      now,
    ).length,
    afterVerifiedPool: eligibleCatalogue(e, e.products[id], now).length,
  }));
  const verified = Object.values(e.players).filter(
    (p) => nflCardEligibility(p, now).eligible,
  );
  const eligibleByTeam: Record<string, Record<string, number>> = {};
  for (const p of verified) {
    const team = p.roster!.team;
    eligibleByTeam[team] ??= {};
    eligibleByTeam[team][p.position] =
      (eligibleByTeam[team][p.position] ?? 0) + 1;
  }
  assert.equal(digest(before.journal), digest(s.journal));
  assert.equal(digest(before.lots), digest(s.lots));
  assert.equal(digest(before.economy!.definitions), digest(e.definitions));
  // A separate local, versioned prepared state; do not overwrite cleanup pre/post images.
  await writeFile(
    "private-data/nfl-roster-audit/verified-local-state.json",
    JSON.stringify(s),
    { mode: 0o600 },
  );
  const db = new PGlite(resolve("tmp/nfl-roster-evidence-local"));
  try {
    await db.exec(
      "create schema if not exists roster_audit;create table if not exists roster_audit.evidence(player_id text primary key,document jsonb not null);",
    );
    await db.transaction(async (tx) => {
      for (const r of observations)
        await tx.query(
          "insert into roster_audit.evidence values($1,$2) on conflict(player_id) do update set document=excluded.document where roster_audit.evidence.document<>excluded.document",
          [r.playerId, r],
        );
    });
  } finally {
    await db.close();
  }
  const feed = JSON.parse(
    await readFile("docs/qa/nfl-testing/mapping-review.json", "utf8"),
  );
  const rows = Array.isArray(feed)
    ? feed
    : (feed.rows ?? feed.records ?? feed.mappings);
  const feedReview = rows
    .filter((r: any) => r.status !== "Verified exact provider identity")
    .map((r: any) => {
      const roster = audit.records.find((a: any) => a.id === r.docked);
      return {
        ...r,
        rosterDecision: roster?.decision ?? "quarantine",
        rosterEvidence: roster?.official ?? null,
        interpretation:
          roster?.decision === "eligible"
            ? "Current roster identity retained; historical feed mapping still requires independent proof"
            : (roster?.reason ??
              "Unresolved identity retained; no new issuance"),
      };
    });
  await writeFile(
    "docs/qa/nfl-roster-audit/feed-mapping-review.json",
    JSON.stringify(feedReview, null, 2),
  );
  await writeFile(
    "docs/qa/nfl-roster-audit/local-catalogue.json",
    JSON.stringify(
      {
        scope: "local-only",
        checkedAt: new Date(now).toISOString(),
        counts,
        verifiedActive: verified.length,
        eligibleByTeam,
        observations: observations.length,
        quarantined: Object.values(e.players).filter((p) => !p.roster).length,
        feedExceptions: feedReview.length,
        rosterRowsMissingOrUnresolved: audit.missing.length,
        scarcityUnchanged: true,
        issuedCards: 0,
        creditsIssued: 0,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      counts,
      verified: verified.length,
      observations: observations.length,
      feedExceptions: feedReview.length,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
