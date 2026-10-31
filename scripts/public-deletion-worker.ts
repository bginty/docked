// Isolated acceptance worker. Real public-mode service; local Auth transport only.
import { processAccountDeletion } from "../src/server/account-deletion";
import { db } from "../src/server/db";
const database = new URL(process.env.DATABASE_URL ?? "https://invalid");
const auth = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid");
if (
  database.hostname !== "127.0.0.1" ||
  auth.hostname !== "127.0.0.1" ||
  !database.pathname.startsWith("/docked_free_play_test_")
)
  throw Error("Disposable loopback acceptance only");
async function main() {
  try {
    await processAccountDeletion(process.env.DELETION_FIXTURE_USER!);
    console.log(JSON.stringify({ ok: true }));
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : "Deletion failed",
      }),
    );
    process.exitCode = 1;
  } finally {
    await db().end();
  }
}
void main();
