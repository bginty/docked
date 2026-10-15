// Deliberately local-only. This command cannot deploy or use a hosted database.
import postgres from "postgres";
import { applyPremiumPackTransition } from "../src/server/premium-pack-transition";
async function main() {
  const url = new URL(process.env.LOCAL_PREMIUM_DATABASE_URL ?? "invalid:");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/^\/docked_[a-z0-9_]*local[a-z0-9_]*$/.test(url.pathname)
  )
    throw Error("An explicit localhost docked_*local* QA database is required");
  const sql = postgres(url.toString(), { max: 1, ssl: false });
  let receipt:
    Awaited<ReturnType<typeof applyPremiumPackTransition>> | undefined;
  try {
    try {
      await sql.begin(async (tx) => {
        receipt = await applyPremiumPackTransition(async (q, v = []) => ({
          rows: await tx.unsafe(q, v as never[]),
        }));
        if (!process.argv.includes("--apply"))
          throw Error("LOCAL_REVIEW_ROLLBACK");
      });
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "LOCAL_REVIEW_ROLLBACK")
        throw e;
    }
    console.log(
      JSON.stringify({
        ...receipt,
        applied: process.argv.includes("--apply"),
        environment: "local QA only",
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
