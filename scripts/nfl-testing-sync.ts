import { readFile } from "node:fs/promises";
import { z } from "zod";
import { connectTestingFeedDatabase } from "../src/server/nfl-testing-connection";
import {
  NflTestingClient,
  FeedFailure,
} from "../src/server/nfl-testing-client";
import { NflTestingStore } from "../src/server/nfl-testing-store";
import { reconcileTestingGame } from "../src/server/nfl-testing-reconcile";
import { requirePostgamePermit } from "../src/server/postgame-download";
const argument = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  if (process.env.DOCKED_NFL_TEST_COLLECTOR !== "standalone-postgame")
    throw Error("Explicit isolated collector selection required");
  const permit = requirePostgamePermit(
    JSON.parse(
      await readFile(
        argument("permit") ?? "config/nfl-postgame-permit.json",
        "utf8",
      ),
    ),
    new Date(),
  );
  const client = new NflTestingClient(
    process.env.NFL_BASE_URL ?? "",
    process.env.NFL_API_KEY ?? "",
    (process.env.NFL_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()),
  );
  const c = connectTestingFeedDatabase(
    process.env.DOCKED_NFL_TEST_DATABASE_URL ?? "",
    process.env.VERCEL_ENV,
  );
  try {
    if (process.argv.includes("--initialize")) {
      if (
        !(await c.db.query("select to_regnamespace('nfl_test_feed') schema"))
          .rows[0].schema
      )
        await c.sql.unsafe(
          await readFile(
            "supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql",
            "utf8",
          ),
        );
      if (
        !(await c.db.query("select to_regnamespace('sports_feed') schema"))
          .rows[0].schema
      )
        await c.sql.unsafe(await readFile("sandbox/sports-feed.sql", "utf8"));
    }
    if (
      (
        await c.db.query(
          "select id from sports_feed.streams where id not like 'beta-real:qa:feed:%' limit 1",
        )
      ).rows.length ||
      (
        await c.db.query(
          "select id from sports_feed.jobs where state in('queued','leased') limit 1",
        )
      ).rows.length
    )
      throw Error("Other collector or member periods present; cutover refused");
    const store = new NflTestingStore(c.db),
      generation = await store.sync(client, process.argv.includes("--resync"));
    const dataset = (
      await c.db.query(
        "select dataset from nfl_test_feed.generations where id=$1",
        [generation],
      )
    ).rows[0].dataset;
    const mappingFile = argument("mappings");
    if (mappingFile) {
      const input = z
        .object({
          dataset: z.string().uuid(),
          reviewer: z.string().min(1),
          players: z.array(
            z.object({
              canonical: z.string(),
              docked: z.string(),
              position: z.enum(["QB", "RB", "WR", "TE"]),
              evidence: z.record(z.string(), z.unknown()),
            }),
          ),
        })
        .parse(JSON.parse(await readFile(mappingFile, "utf8")));
      if (input.dataset !== dataset)
        throw Error("Reviewed mapping dataset mismatch");
      for (const p of input.players)
        await store.map(
          dataset,
          p.canonical,
          p.docked,
          p.position,
          p.evidence,
          input.reviewer,
        );
    }
    // Only already-reviewed mappings and recorded QA periods are processed.
    // Missing mappings remain durably visible, never generated from current assets.
    const pending = (
      await c.db.query(
        "select distinct game from nfl_test_feed.outbox where generation=$1 and status<>'applied' order by game limit 500",
        [generation],
      )
    ).rows;
    let applied = 0,
      review = 0,
      unmapped = 0;
    for (const row of pending) {
      const r = await reconcileTestingGame(
        c.db,
        c.sql,
        generation,
        row.game,
        { id: "nfl-postgame-test-worker", role: "importer" },
        permit,
      );
      if (r.status === "applied") applied++;
      else if (r.status === "review") review++;
      else unmapped++;
    }
    console.log(
      JSON.stringify({
        generation,
        applied,
        review,
        unmapped,
        scope: "local testing; production disabled",
      }),
    );
  } finally {
    await c.close();
  }
}
main().catch((e) => {
  console.error(
    e instanceof FeedFailure
      ? e.code
      : "NFL testing sync failed; check local configuration, reviewed mappings and private diagnostics. No credentials logged.",
  );
  process.exitCode = 1;
});
