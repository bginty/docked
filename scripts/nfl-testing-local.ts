import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { NflTestingClient } from "../src/server/nfl-testing-client";
import { NflTestingStore, type FeedDb } from "../src/server/nfl-testing-store";
import { nflTestingReport } from "../src/server/nfl-testing-report";
import { reviewTestingIdentities } from "../src/server/nfl-testing-identities";
import { nflPostgameTestRules } from "../src/core/scoring-v1";
import { nflPostgameWeights } from "../src/core/nfl-postgame-policy";
import { realGameProof, verifyRestoredGame } from "./nfl-testing-game-proof";

async function main() {
  const out = resolve(
      process.argv.find((a) => a.startsWith("--out="))?.slice(6) ??
        "docs/qa/nfl-testing",
    ),
    work = resolve(`tmp/nfl-testing-${Date.now()}`);
  await mkdir(out, { recursive: true });
  await mkdir(work, { recursive: true });
  const source = resolve("../docked-nfl-ingestion/data/nflverse.sqlite");
  const hash = async () =>
    createHash("sha256")
      .update(await readFile(source))
      .digest("hex");
  const before = await hash();
  let existingService = "unavailable";
  try {
    const r = await fetch("http://127.0.0.1:8080/health", {
      signal: AbortSignal.timeout(2000),
    });
    existingService = `HTTP ${r.status}`;
  } catch {
    /* record actual connectivity */
  }
  const key = randomBytes(32).toString("hex");
  const python =
    process.argv.find((a) => a.startsWith("--python="))?.slice(9) ?? "python";
  const ready = resolve(work, "ready.json");
  const child = spawn(python, ["scripts/nfl-feed-local-server.py"], {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      NFL_API_KEY: key,
      DOCKED_LOCAL_ADMIN_KEY: randomBytes(32).toString("hex"),
      DOCKED_FEED_COPY: resolve(work, "service.sqlite"),
      DOCKED_FEED_READY: ready,
    },
  });
  let serviceError = "";
  child.stderr.on("data", (b) => (serviceError += b));
  child.on("error", () => {
    serviceError = "Python launch failed";
  });
  const pg = new PGlite(resolve(work, "consumer"));
  const db = pg as unknown as FeedDb;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await stat(ready);
        break;
      } catch {
        if (child.exitCode !== null)
          throw Error("Local service failed: " + serviceError.slice(-500));
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const info = JSON.parse(await readFile(ready, "utf8")),
      base = `http://127.0.0.1:${info.port}`;
    const unauth = await fetch(base + "/v1/seasons");
    assert.equal(unauth.status, 401);
    const denied = await fetch(base + "/admin/status", {
      headers: { Authorization: `Bearer ${key}` },
    });
    assert.equal(denied.status, 401);
    const client = new NflTestingClient(base, key, [base]);
    const seasons = await client.get("/v1/seasons");
    await pg.exec(
      await readFile(
        "supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql",
        "utf8",
      ),
    );
    await pg.exec(await readFile("sandbox/sports-feed.sql", "utf8"));
    const store = new NflTestingStore(db),
      generation = await store.sync(client);
    const beforeCounts = (
      await db.query("select count(*)::int n from nfl_test_feed.records")
    ).rows[0].n;
    // Optional read-only catalogue export preserves the existing Docked identities.
    // Without one, the proof remains explicitly limited to disposable fixture identities.
    const cataloguePath = process.argv
      .find((a) => a.startsWith("--catalogue="))
      ?.slice(12);
    const catalogue = cataloguePath
      ? JSON.parse(await readFile(cataloguePath, "utf8"))
      : info.identities
          .filter((p: any) => ["QB", "RB", "WR", "TE"].includes(p.position))
          .map((p: any) => ({
            id:
              "local-test-player:" +
              createHash("sha256")
                .update(p.external_id)
                .digest("hex")
                .slice(0, 24),
            providerId: p.external_id,
            position: p.position,
          }));
    const positionReviewPath = process.argv
      .find((a) => a.startsWith("--position-reviews="))
      ?.slice(19);
    const positionReviews = positionReviewPath
      ? JSON.parse(await readFile(positionReviewPath, "utf8"))
      : [];
    const bridge = reviewTestingIdentities(
      catalogue,
      info.identities,
      positionReviews,
    );
    for (const m of bridge.approved)
      await store.map(
        seasons.dataset_id,
        m.canonical,
        m.docked,
        m.position,
        {
          identitySource: cataloguePath
            ? "Read-only Docked NFL roster catalogue snapshot + separate service verified mapping table"
            : "Separate service verified provider mapping table; isolated Docked catalogue fixture",
          verifiedIdentity: createHash("sha256")
            .update(m.verifiedIdentity)
            .digest("hex"),
          verifiedAt: new Date().toISOString(),
          positionReview:
            positionReviews.find(
              (r: any) => r.providerId === m.verifiedIdentity,
            ) ?? null,
        },
        "local-integration-review",
      );
    const report = await nflTestingReport(db);
    const sampleIdentity =
      info.identities.find((p: any) => p.external_id === "00-0032950") ??
      info.identities.find((p: any) => p.position === "QB");
    const sample = report.players.find(
      (p) => p.id === sampleIdentity.canonical_id,
    )!;
    assert.ok(
      sample && sample.history.some((h) => h.points !== null),
      "real player's complete data must score",
    );
    const raw = (
      await db.query(
        "select payload from nfl_test_feed.records where generation=$1 and player=$2 and game=$3",
        [
          generation,
          sample.id,
          sample.history.find((h) => h.points !== null)!.game,
        ],
      )
    ).rows[0].payload;
    const independent = Object.entries(nflPostgameWeights).reduce(
      (sum, [field, weight]) => sum + raw.stats[field] * weight,
      0,
    );
    assert.equal(
      sample.history.find((h) => h.game === raw.game_id)!.points,
      independent,
    );
    for (const s of sample.seasons) {
      assert.equal(
        s.points,
        sample.history
          .filter(
            (h) => `${h.season}:${h.seasonType}` === s.key && h.points !== null,
          )
          .reduce((n, h) => n + h.points!, 0),
      );
      if (s.complete)
        assert.equal(
          s.points,
          s.weeks.reduce((n, w) => n + w.points!, 0),
        );
    }
    const prior = JSON.stringify(report.players);
    await store.sync(client);
    assert.equal(
      JSON.stringify((await nflTestingReport(db)).players),
      prior,
      "duplicate import leaves scores unchanged",
    );
    assert.equal(
      (await db.query("select count(*)::int n from nfl_test_feed.records"))
        .rows[0].n,
      beforeCounts,
    );
    const historyApi = await client.get(`/v1/players/${sample.id}/game-stats`, {
      season: String(raw.season),
      limit: "500",
    });
    const weeklyApi = await client.get(
      `/v1/players/${sample.id}/weekly-stats`,
      { season: String(raw.season) },
    );
    const totalsApi = await client.get(
      `/v1/players/${sample.id}/season-totals`,
      { season: String(raw.season) },
    );
    for (const field of Object.keys(nflPostgameWeights)) {
      const sum = (data: any[]) =>
        data.reduce((n, r) => n + (r.stats[field] ?? 0), 0);
      assert.equal(sum(historyApi.data as any[]), sum(weeklyApi.data as any[]));
      assert.equal(sum(historyApi.data as any[]), sum(totalsApi.data as any[]));
    }
    const proof = await realGameProof(
      db,
      generation,
      report,
      JSON.parse(await readFile("config/nfl-postgame-permit.json", "utf8")),
    );
    await writeFile(
      resolve(out, "real-game-journal.json"),
      JSON.stringify(proof, null, 2),
    );
    // Explicit resync removes the isolated injected correction from raw history.
    const restored = await store.sync(client, true);
    const journalRestored = await verifyRestoredGame(
      db,
      restored,
      proof.game,
      proof.expectedCentipoints,
      JSON.parse(await readFile("config/nfl-postgame-permit.json", "utf8")),
    );
    const finalReport = await nflTestingReport(db);
    assert.equal(JSON.stringify(finalReport.players), prior);
    await writeFile(
      resolve(out, "resync.json"),
      JSON.stringify(
        {
          old: generation,
          replacement: restored,
          seasonTotalsRestored: JSON.stringify(finalReport.players) === prior,
          journalRestoredCentipoints: journalRestored,
        },
        null,
        2,
      ),
    );
    await writeFile(resolve(work, "report.json"), JSON.stringify(finalReport));
    await writeFile(
      resolve(out, "report.json"),
      JSON.stringify(finalReport, null, 2),
    );
    await writeFile(
      resolve(out, "scoring-configuration.json"),
      JSON.stringify(nflPostgameTestRules(), null, 2),
    );
    assert.equal(
      await hash(),
      before,
      "Original ingestion database must remain byte-for-byte unchanged",
    );
    await writeFile(
      resolve(out, "real-api-verification.json"),
      JSON.stringify(
        {
          existingPort8080: existingService,
          verifiedService:
            "isolated copy of actual separate service over authenticated loopback HTTP",
          production: false,
          sourceUnchanged: before === (await hash()),
          originalSourceHash: before,
          dataset: seasons.dataset_id,
          seasons: seasons.data,
          records: report.rawRecords,
          games: report.games.length,
          incompleteGames: report.incompleteGames,
          states: report.games.reduce(
            (a: any, g) => ({ ...a, [g.status]: (a[g.status] ?? 0) + 1 }),
            {},
          ),
          mappedFixturePlayers: bridge.approved.length,
          catalogueKind: cataloguePath
            ? "Read-only existing Docked identity export, imported only to local testing"
            : "isolated fixture identities",
          catalogueRecords: catalogue.length,
          quarantined: bridge.quarantined,
          noRecordedAppearances: bridge.noAppearances,
          duplicateImportUnchanged: true,
          unauthenticatedStatus: unauth.status,
          readerAdminStatus: denied.status,
          sample: {
            name: sample.name,
            canonical: sample.id,
            raw: raw.stats,
            expectedCentipoints: independent,
            seasons: sample.seasons,
          },
          rawWeeklySeasonReconciled: true,
          localDatabase: work,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        evidence: out,
        localDatabase: work,
        records: report.rawRecords,
        games: report.games.length,
        incomplete: report.incompleteGames,
        score: independent,
      }),
    );
  } finally {
    child.kill();
    await pg.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Integration failed");
  process.exitCode = 1;
});
