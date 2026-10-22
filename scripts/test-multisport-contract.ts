import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { pgliteSql } from "../tests/fixtures/pglite-sql";
import { MultisportDeliveryStore } from "../src/server/multisport-delivery-store";
import { ingestionHealth, ingestionJobs } from "../src/core/multisport-health";
import { type FeedSport } from "../src/core/multisport-delivery";
import { serviceScoringPreview } from "../src/core/multisport-scoring-bridge";
import { sportEventRules } from "../src/core/sport-event-rules";
import { previewOwnerSportFeed } from "../src/core/owner-sport-feed";
import { serviceRosterCandidate } from "../src/core/multisport-roster-bridge";
import { nbaWeeklyRules } from "../src/core/nba-weekly";
async function main() {
  const [repo, python] = process.argv.slice(2);
  if (!repo || !python)
    throw Error(
      "Usage: tsx scripts/test-multisport-contract.ts service-repository python-executable",
    );
  const raw = execFileSync(
    python,
    [resolve(repo, "scripts/export_docked_contract_fixture.py")],
    { cwd: repo, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  const fixture = JSON.parse(raw);
  ingestionHealth.parse(fixture.health);
  ingestionJobs.parse(fixture.jobs);
  assert.equal(fixture.synthetic, true);
  const db = await multiSportDatabase();
  const checks = [];
  try {
    for (const sport of ["epl", "nba", "afl", "nrl"] as FeedSport[]) {
      const first = fixture.initial[sport],
        second = fixture.corrected[sport],
        store = new MultisportDeliveryStore(pgliteSql(db.pg), {
          source: "qa-cross-repo",
          dataset: first.dataset_id,
          allowSynthetic: true,
        });
      const before = await db.q(
        "select count(*)::int n from credits_sandbox.state",
      );
      await store.apply(sport, first);
      const roster = first.data.find((c: any) => c.kind === "roster").payload;
      const rosterBinding = {
        sport,
        season: "synthetic-2026",
        provider: roster.provider,
        canonicalPlayerId: roster.player_id,
        providerPlayerId: roster.provider_id,
        playerId: "qa:" + sport,
        canonicalTeamId: roster.team_id,
        teamId: "qa:team",
        teamName: "Isolated team",
        evidenceUrl: "https://example.invalid/isolated-roster",
      };
      assert.throws(
        () => serviceRosterCandidate(roster, rosterBinding),
        /Synthetic/,
      );
      const candidate = serviceRosterCandidate(
        { ...roster, synthetic: false },
        rosterBinding,
      );
      assert.equal(candidate.jerseyNumber, null);
      assert.equal(candidate.availability, "injured");
      assert.equal(candidate.registration, "active");
      assert.throws(
        () =>
          serviceRosterCandidate(
            { ...roster, synthetic: false },
            { ...rosterBinding, season: "wrong" },
          ),
        /binding/,
      );
      assert.equal((await store.apply(sport, first)).replay, true);
      await store.apply(sport, second);
      assert.equal((await store.apply(sport, second)).replay, true);
      assert.equal(
        (
          await db.q(
            "select count(*)::int n from sports_feed.delivery_records where sport=$1 and kind='player_game'",
            [sport],
          )
        )[0].n,
        2,
      );
      const bad = structuredClone(second);
      const sequenceOffset = Number(second.next_cursor.split(":").at(-1));
      for (const change of bad.data) change.seq += sequenceOffset;
      bad.next_cursor = bad.next_cursor.replace(
        /\d+$/,
        String(Number(bad.next_cursor.split(":").at(-1)) + sequenceOffset),
      );
      const changed = bad.data.find((r: any) => r.kind === "player_game");
      changed.payload.stats[
        sport === "nba" ? "points" : sport === "nrl" ? "tries" : "goals"
      ] += 99;
      await assert.rejects(store.apply(sport, bad), /Conflicting/);
      await assert.rejects(
        new MultisportDeliveryStore(pgliteSql(db.pg), {
          source: "qa-forbidden",
          dataset: first.dataset_id,
          allowSynthetic: false,
        }).apply(sport, first),
        /synthetic/,
      );
      assert.deepEqual(
        await db.q("select count(*)::int n from credits_sandbox.state"),
        before,
      );
      const [f] = await db.q(
        "select * from sports_feed.delivery_records where sport=$1 and kind='fixture' order by entity limit 1",
        [sport],
      );
      const records = await db.q(
        "select payload from sports_feed.delivery_records where sport=$1 and kind='player_game' and payload->>'fixture_id'=$2",
        [sport, f.entity],
      );
      const scoring = sport === "nba" ? "basketball" : sport,
        rules = sportEventRules(scoring),
        map = {
          sport: scoring,
          season: f.payload.season,
          provider: f.payload.provider,
          providerFixtureId: f.payload.provider_id,
          fixtureId: "qa:canonical",
          scoringVersion: rules.version,
          maxAgeSeconds: 3600,
          players: records.map((r: any) => ({
            providerPlayerId: r.payload.provider_player_id,
            playerId: "qa:player",
            position: rules.positions[0],
          })),
        };
      const input = {
        fixture: f.payload,
        records: records.map((r) => r.payload),
        fixtureRevision: Number(f.revision),
        mapping: map,
        sourceEvidence: "https://example.invalid/isolated-contract",
        now: new Date(f.payload.last_success * 1000).toISOString(),
      };
      assert.throws(() => serviceScoringPreview(input), /Synthetic/);
      // Isolated decoder test only. The retained service/DB evidence stays synthetic.
      const normal = serviceScoringPreview({
        ...input,
        fixture: { ...f.payload, synthetic: false },
        records: records.map((r) => ({ ...r.payload, synthetic: false })),
      });
      const preview = previewOwnerSportFeed(normal.feed, map, rules, input.now);
      if (sport === "nba") {
        const proposal = nbaWeeklyRules();
        const checked = previewOwnerSportFeed(
          normal.feed,
          { ...map, scoringVersion: proposal.version },
          proposal,
          input.now,
        );
        const row = normal.feed.players[0].stats as Record<string, number>;
        const categories = [
          row.points,
          row.rebounds,
          row.assists,
          row.steals,
          row.blocks,
        ].filter((n) => n >= 10).length;
        const expected =
          row.points * 100 +
          row.rebounds * 120 +
          row.assists * 150 +
          row.steals * 300 +
          row.blocks * 300 -
          row.turnovers * 100 +
          (categories >= 2 ? 150 : 0) +
          (categories >= 3 ? 300 : 0);
        assert.equal(checked.players[0].baseCentipoints, expected);
        checks.push({
          sport: "nba-weekly-proposal",
          synthetic: true,
          baseCentipoints: expected,
          sharedProviderContract: true,
        });
      }
      assert.equal(
        preview.players[0].availability,
        sport === "epl" ? "pending" : "complete",
      );
      checks.push({
        sport,
        records: 2,
        replays: true,
        correction: true,
        conflictRollback: true,
        scoring: preview.players[0].availability,
        baseCentipoints: preview.players[0].baseCentipoints,
      });
    }
    mkdirSync("docs/qa/multi-sport/integration", { recursive: true });
    writeFileSync(
      "docs/qa/multi-sport/integration/cross-repository.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          serviceCommit: fixture.service_commit,
          isolated: true,
          checks,
          authenticationNegativeChecks: fixture.authentication_negative_checks,
          hosted: false,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      "tmp/ingestion-browser-fixture.json",
      JSON.stringify({
        health: { state: "connected", ...fixture.health },
        jobs: fixture.jobs.data,
      }),
    );
    console.log(JSON.stringify(checks));
  } finally {
    await db.pg.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
