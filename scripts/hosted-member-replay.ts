/** Explicit operator acceptance. Only replays already completed synthetic work. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { hostedGoogleCall } from "./hosted-google-client";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  assert.equal(process.env.DOCKED_HOSTED_MEMBER_ACCEPTANCE, "true");
  const config = JSON.parse(
    readFileSync(
      join(
        process.env.USERPROFILE!,
        ".docked-secrets/hosted-member-acceptance.json",
      ),
      "utf8",
    ),
  );
  const url = new URL(config.database);
  assert.equal(
    decodeURIComponent(url.username),
    "docked_billing_test.pojoymtniryarxxunyvz",
  );
  assert.equal(config.member, "synthetic-store-member-20261101");
  const sql = postgres(url.href, {
    ssl: { ca: config.databaseCa, rejectUnauthorized: true },
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
  try {
    await assert.rejects(
      sql`select document from credits_sandbox.state`,
      /permission denied/,
    );
    const read = async () =>
      (
        await sql`select revision,md5(document::text) hash,document from store_member_acceptance.state where id`
      )[0];
    const before = await read();
    const state = before.document as CreditsState;
    const inbox = new StoreTestInbox(
      { hostedAcceptance: sql, memberAcceptance: true },
      Buffer.from(config.encryptionKey, "hex"),
    );
    const refs = await inbox.references(config.member);
    assert.equal(
      refs.length,
      1,
      "Only the current known purchased test order may be replayed",
    );
    const [receipt] =
      await sql`select status from store_member_acceptance.store_receipts where receipt_key=${refs[0].key}`;
    assert.equal(receipt.status, "PURCHASED");
    await Promise.all(
      Array.from({ length: 4 }, () =>
        hostedGoogleCall({ operation: "receipt", token: refs[0].token }),
      ),
    );
    const operations = state.events.filter(
      (e) =>
        e.actor === config.member && ["buy-pack", "open-pack"].includes(e.kind),
    );
    assert.equal(
      operations.length,
      6,
      "Three purchased/opened test packs required",
    );
    for (const operation of operations) {
      const request = operation.id.slice(config.member.length + 1);
      await Promise.all(
        Array.from({ length: 2 }, () =>
          hostedGoogleCall({
            operation: "pack",
            request,
            command: operation.command,
          }),
        ),
      );
    }
    await assert.rejects(
      hostedGoogleCall({
        operation: "pack",
        request: "forged-test-funding",
        command: { kind: "credit-deposit", cents: 999999 },
      }),
    );
    const after = await read();
    assert.equal(after.revision, before.revision);
    assert.equal(after.hash, before.hash);
    const [{ count: unbalanced }] =
      await sql`select count(*)::int count from (select journal from store_member_acceptance.lines group by journal having sum(credits)<>0) t`;
    assert.equal(unbalanced, 0);
    const out = {
      at: new Date().toISOString(),
      source: "protected hosted endpoint",
      receiptReplays: 4,
      packOperationReplays: 12,
      forgedFundingDenied: true,
      customerSchemaDenied: true,
      before: { revision: before.revision, hash: before.hash },
      after: { revision: after.revision, hash: after.hash },
      unbalancedJournals: unbalanced,
    };
    writeFileSync(
      "docs/qa/hosted-member-20261101/hosted-replays.json",
      JSON.stringify(out, null, 2),
    );
    console.log(JSON.stringify(out));
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "Hosted replay acceptance not confirmed; private references were not logged",
  );
  process.exitCode = 1;
});
