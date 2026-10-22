import { readFile, stat, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { reconcileOwnerSportFeed } from "../src/server/owner-sport-reconcile";
import { results } from "../src/core/scoring-engine";
/** Integration acceptance command. Hosted execution is intentionally unavailable
 * until a scoped service credential/deployment and source approvals are reviewed.
 * The reusable reconciler is the integration point for the separate service. */
async function main() {
  const [input, output] = process.argv.slice(2),
    url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (!input || !output || process.argv.length !== 4)
    throw Error(
      "Usage: tsx scripts/consume-sport-feed.ts input.json new-receipt.json",
    );
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error(
      "Disposable local integration database required; hosted imports await service release review",
    );
  if ((await stat(input)).size > 8_000_000) throw Error("Input exceeds 8 MB");
  const data = JSON.parse(await readFile(input, "utf8"));
  const sql = postgres(url, { max: 1 });
  try {
    const result = await reconcileOwnerSportFeed(
      sql,
      data.streamId,
      data.feed,
      data.mapping,
      data.permit,
      { id: "local-acceptance", role: "importer" },
    );
    const receipt = {
      replay: result.replay,
      missingPlayerIds: result.issues,
      results: results(result.state),
      liveActivation: false,
    };
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      "Local scoring import committed. No member assets or live activation.",
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    "Import failed; inspect source permission, frozen mapping, chronology and the private service log. No credentials printed.",
  );
  process.exitCode = 1;
});
