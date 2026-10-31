// Read-only acceptance evidence. Never prints tokens, bindings, order IDs or credentials.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet } from "../src/core/credits-sandbox";
async function main() {
  const session = JSON.parse(
    readFileSync(
      join(
        process.env.USERPROFILE ?? "",
        ".docked-secrets/google-lab-session.json",
      ),
      "utf8",
    ),
  );
  const label = process.argv[2];
  if (!/^[a-z0-9-]{1,50}$/.test(label ?? ""))
    throw Error("Safe evidence label required");
  const inbox = new StoreTestInbox(
    session.database,
    Buffer.from(session.encryptionKey, "hex"),
  );
  try {
    const state = await new CreditsSandboxStore(inbox.sql).read();
    const receipts =
      await inbox.sql`select status,count(*)::integer as count from credits_sandbox.store_receipts group by status order by status`;
    const events =
      await inbox.sql`select status,count(*)::integer as count from credits_sandbox.store_events group by status order by status`;
    const outbox =
      await inbox.sql`select state,count(*)::integer as count,sum(attempts)::integer as attempts from credits_sandbox.store_outbox group by state order by state`;
    const evidence = {
      at: new Date().toISOString(),
      label,
      source: "disposable local PostgreSQL",
      balance: wallet(state, session.member).available,
      receipts,
      events,
      outbox,
      productionConnections: 0,
    };
    writeFileSync(
      `docs/qa/public-play-readiness-20261031/google-lab-${label}.json`,
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await inbox.close();
  }
}
void main().catch(() => {
  console.error("Local evidence unavailable; private data redacted.");
  process.exitCode = 1;
});
