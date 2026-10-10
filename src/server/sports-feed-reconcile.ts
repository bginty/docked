import type { Sql } from "postgres";
import {
  digest,
  importStatistics,
  type Operator,
} from "../core/scoring-engine";
import {
  sportmonksFixture,
  sportsDataBoxscore,
  type FeedMapping,
} from "../core/sports-feed-adapters";
import { SportsFeedStore } from "./sports-feed-store";
import { requireFeedPermit } from "./sports-feed-client";

/** Reconciliation is deterministic against retained raw bytes and a frozen mapping.
 * A worker crash between fetch and reconciliation is recoverable by raw revision ID. */
export async function reconcileFeed(
  sql: Sql,
  period: string,
  rawId: number,
  mapping: FeedMapping,
  approval: unknown,
  operator: Operator,
  at = new Date().toISOString(),
  lateReason?: string,
) {
  const [raw] =
    await sql`select * from sports_feed.raw_revisions where id=${rawId} and expires_at>clock_timestamp()`;
  if (!raw || digest(raw.body) !== raw.body_hash)
    throw Error("Raw revision unavailable or corrupt");
  const permit = requireFeedPermit(approval, raw.provider, new Date(at));
  const resource = digest({
    provider: raw.provider,
    kind: raw.provider === "sportmonks" ? "fixture" : "boxscore",
    id: mapping.providerFixtureId,
  });
  if (
    resource !== raw.resource ||
    new Set(Object.values(mapping.providerPlayers)).size !==
      mapping.playerIds.length ||
    mapping.playerIds.some((p) => !mapping.providerPlayers[p])
  )
    throw Error("Fixture/player mapping mismatch");
  const store = new SportsFeedStore(sql);
  let issues: string[] = [];
  const state = await store.change(
    period,
    (s) => {
      const fixture = s.period.fixtures.find((f) => f.id === mapping.fixtureId);
      if (
        !fixture ||
        digest([...fixture.playerIds].sort()) !==
          digest([...mapping.playerIds].sort())
      )
        throw Error("Frozen fixture mapping mismatch");
      const previous = s.sources
        .filter((x) => x.fixtureId === mapping.fixtureId)
        .at(-1);
      const normalise =
        raw.provider === "sportmonks" ? sportmonksFixture : sportsDataBoxscore;
      const r = normalise(
        raw.body,
        mapping,
        (previous?.revision ?? 0) + 1,
        new Date(raw.observed_at).toISOString(),
      );
      issues = r.issues;
      // A repeat raw payload cannot generate a new correction/version merely on retry.
      if (
        previous &&
        digest({ ...r.snapshot, revision: previous.revision }) ===
          digest(previous)
      )
        return s;
      return importStatistics(s, r.snapshot, operator, at, lateReason, {
        provider: permit.provider,
        competition: r.snapshot.competition,
        commercialFantasy: true,
        storage: true,
        evidence: permit.evidence,
        reviewExpires: permit.expiresAt,
        maxAgeSeconds: 86400,
      });
    },
    rawId,
  );
  return {
    state,
    issues,
    status: issues.length ? "pending-evidence" : "reconciled",
  };
}
