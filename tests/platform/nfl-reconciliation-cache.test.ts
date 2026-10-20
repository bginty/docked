import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { digest } from "../../src/core/scoring-engine";
import { nflResource } from "../../src/server/nflverse-bundle";
import { prepareNflBundleReconciliation } from "../../src/server/nfl-postgame-reconcile";
import type { PostgameMapping } from "../../src/core/postgame-nflverse";
import permit from "../../config/nfl-postgame-permit.json";

test("one reconciliation run verifies each season source once; games without completion cannot write scores", async () => {
  const sources = ["weekly", "pbp"].map((dataset, i) => {
    const body = {
      dataset,
      season: 2026,
      rows:
        dataset === "pbp"
          ? [
              {
                game_id: "2026_06_TEN_IND",
                home_team: "IND",
                away_team: "TEN",
                play_id: "1",
                play_deleted: "0",
                play_type_nfl: "PASS",
              },
              {
                game_id: "2026_06_HOU_JAX",
                home_team: "JAX",
                away_team: "HOU",
                play_id: "1",
                play_deleted: "0",
                play_type_nfl: "PASS",
              },
            ]
          : [],
    };
    return {
      id: i + 1,
      body,
      body_hash: digest(body),
      resource: nflResource(dataset as "weekly" | "pbp", 2026),
      checked_at: new Date(),
      expires_at: new Date(Date.now() + 86400000),
    };
  });
  let loads = 0;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    assert.match(strings.join(""), /select r\.\*,c.checked_at/);
    loads++;
    return [sources.find((r) => r.id === values[0])];
  }) as unknown as Sql;
  const reconcile = await prepareNflBundleReconciliation(sql, 1, 2, 2026);
  for (const gameId of ["2026_06_TEN_IND", "2026_06_HOU_JAX"]) {
    await assert.rejects(
      reconcile(
        "isolated",
        { gameId, season: 2026 } as PostgameMapping,
        permit,
        { id: "test", role: "importer" },
      ),
      /completed-game marker/,
    );
  }
  assert.equal(loads, 2);
  await assert.rejects(
    reconcile("isolated", { season: 2027 } as PostgameMapping, permit, {
      id: "test",
      role: "importer",
    }),
    /season mismatch/,
  );
  sources[0].expires_at = new Date(0);
  await assert.rejects(
    reconcile("isolated", { season: 2026 } as PostgameMapping, permit, {
      id: "test",
      role: "importer",
    }),
    /expired/,
  );
  // A new run must validate sources again, rather than use process-global data.
  sources[0].body_hash = "corrupt";
  await assert.rejects(
    prepareNflBundleReconciliation(sql, 1, 2, 2026),
    /mismatch/,
  );
});
