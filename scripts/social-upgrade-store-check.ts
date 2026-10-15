// LOCAL ONLY: separate PostgreSQL connections, not an authenticated HTTP test.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { executePrivateOffer } from "../src/core/private-card-offers";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  const config = JSON.parse(
    await readFile("tmp/marketplace-auth/status.private.json", "utf8"),
  );
  const url = new URL(config.DB_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55322");
  assert.equal(url.pathname, "/postgres");
  const sql = postgres(url.href, { max: 3, onnotice: () => {} });
  try {
    const users = JSON.parse(
      await readFile("tmp/marketplace-auth/fixtures.private.json", "utf8"),
    ).users.slice(0, 3);
    const [row] =
      await sql`select revision,document from credits_sandbox.state where id`;
    const before = row.document as CreditsState;
    const [{ n: journals }] =
      await sql`select count(*)::int n from credits_sandbox.journal`;
    const [{ n: history }] =
      await sql`select count(*)::int n from credits_sandbox.history`;
    const request = randomUUID(),
      offer = randomUUID(),
      permission = { allowed: true, minimum: null };
    let selection: { seller: string; buyer: string; card: string } | undefined;
    for (const card of Object.keys(before.cards)) {
      const seller = before.commerce.cards[card].owner;
      if (!seller) continue;
      if (!users.some((u: any) => u.id === seller)) continue;
      for (const u of users.filter((u: any) => u.id !== seller)) {
        try {
          executePrivateOffer(
            before,
            { id: u.id, role: "member" },
            offer,
            { kind: "private-offer", card, price: 100 },
            Date.now(),
            permission,
          );
          selection = { seller, buyer: u.id, card };
          break;
        } catch {}
      }
      if (selection) break;
    }
    assert.ok(
      selection,
      "Eligible isolated QA card and buyer within real offer limits",
    );
    const chosen = selection;
    const store = new CreditsSandboxStore(
      sql,
      undefined,
      undefined,
      async () => {
        const [visible] =
          await sql`select revision,document from credits_sandbox.state where id`;
        assert.equal(visible.revision, row.revision);
        assert.deepEqual(
          visible.document,
          before,
          "Separate connection sees original committed state only",
        );
        throw Error("Injected settlement failure after ledger/state writes");
      },
      (state, actor, id, _command, now) => {
        const proposed = executePrivateOffer(
          state,
          { id: chosen.buyer, role: "member" },
          offer,
          { kind: "private-offer", card: chosen.card, price: 100 },
          now,
          permission,
        );
        return executePrivateOffer(
          proposed.state,
          actor,
          id,
          { kind: "private-accept", offer },
          now,
          permission,
        );
      },
    );
    await assert.rejects(
      store.execute({ id: chosen.seller, role: "member" }, request, {}),
      /Injected settlement failure/,
    );
    const [after] =
      await sql`select revision,document from credits_sandbox.state where id`;
    assert.deepEqual(after, row);
    assert.equal(
      (await sql`select count(*)::int n from credits_sandbox.journal`)[0].n,
      journals,
    );
    assert.equal(
      (await sql`select count(*)::int n from credits_sandbox.history`)[0].n,
      history,
    );
    const report = {
      passed: true,
      scope:
        "Actual local PostgreSQL store fault injection, separate observer connection; not HTTP/authentication",
      checks: [
        "OPEN→SOLD existing database guards preserved",
        "Intermediate private listing never visible outside transaction",
        "Injected failure rolls back ownership, balances, journal, offer, operation identity, history and revision",
      ],
      at: new Date().toISOString(),
    };
    await writeFile(
      "docs/qa/social-upgrade/postgres-rollback.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
