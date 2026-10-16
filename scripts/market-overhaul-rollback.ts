// Local PostgreSQL fault injection only; never loads application or hosted .env.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { executePrivateOffer } from "../src/core/private-card-offers";
import type { CreditsState } from "../src/core/credits-sandbox";
async function main() {
  const config = JSON.parse(
    await readFile("tmp/market-overhaul-auth/status.private.json", "utf8"),
  );
  const url = new URL(config.DB_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55342");
  assert.equal(url.pathname, "/postgres");
  const sql = postgres(url.href, { max: 3, onnotice: () => {} });
  try {
    const users = JSON.parse(
      await readFile("tmp/market-overhaul-auth/fixtures.private.json", "utf8"),
    ).users.slice(0, 3);
    const [before] =
      await sql`select revision,document from credits_sandbox.state where id`;
    const original = before.document as CreditsState;
    const [{ n: journals }] =
      await sql`select count(*)::int n from credits_sandbox.journal`;
    const [{ n: history }] =
      await sql`select count(*)::int n from credits_sandbox.history`;
    const permission = {
      allowed: true,
      minimum: null,
      swaps: true,
      combinedPolicy: "credit-commission-floor-v1" as const,
    };
    const proposal = randomUUID(),
      request = randomUUID();
    let selection:
      { buyer: string; seller: string; card: string; give: string } | undefined;
    for (const buyer of users)
      for (const seller of users.filter((x: any) => x.id !== buyer.id)) {
        for (const card of Object.keys(original.cards).filter(
          (id) => original.commerce.cards[id].owner === seller.id,
        )) {
          for (const give of Object.keys(original.cards).filter(
            (id) => original.commerce.cards[id].owner === buyer.id,
          ))
            try {
              executePrivateOffer(
                original,
                { id: buyer.id, role: "member" },
                proposal,
                {
                  kind: "private-offer",
                  card,
                  price: 100,
                  offeredCards: [give],
                },
                Date.now(),
                permission,
              );
              selection = { buyer: buyer.id, seller: seller.id, card, give };
              break;
            } catch {}
          if (selection) break;
        }
        if (selection) break;
      }
    assert.ok(selection, "Eligible pair within real rate and ownership rules");
    const chosen = selection;
    const store = new CreditsSandboxStore(
      sql,
      undefined,
      undefined,
      async () => {
        const [visible] =
          await sql`select revision,document from credits_sandbox.state where id`;
        assert.deepEqual(
          visible,
          before,
          "Separate connection cannot see intermediate cards or credits",
        );
        throw Error(
          "Injected local failure after both transfers and ledger writes",
        );
      },
      (state, actor, id, _command, now) => {
        const proposed = executePrivateOffer(
          state,
          { id: chosen.buyer, role: "member" },
          proposal,
          {
            kind: "private-offer",
            card: chosen.card,
            price: 100,
            offeredCards: [chosen.give],
          },
          now,
          permission,
        );
        return executePrivateOffer(
          proposed.state,
          actor,
          id,
          { kind: "private-accept", offer: proposal },
          now,
          permission,
        );
      },
    );
    await assert.rejects(
      store.execute({ id: chosen.seller, role: "member" }, request, {}),
      /Injected local failure/,
    );
    assert.deepEqual(
      (
        await sql`select revision,document from credits_sandbox.state where id`
      )[0],
      before,
    );
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
        "Local PostgreSQL separate connections, combined exchange failure after writes; no hosted operations",
      checks: [
        "Atomic rollback of both ownership transfers, credits, commission, journal, request identities, offers and revision",
        "Independent observer sees only original committed state",
      ],
      at: new Date().toISOString(),
    };
    await writeFile(
      "docs/qa/market-overhaul/postgres-rollback.json",
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
