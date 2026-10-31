import { createServer } from "node:https";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  GooglePlayTestVerifier,
  storeAccountId,
  type StoreProduct,
} from "../src/server/store-purchase-verification";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet } from "../src/core/credits-sandbox";
import { newCreditOnly } from "../src/core/credit-only";
import { googleLabHandler } from "../src/server/google-play-lab-http";
import { creditsFixture, alice } from "./credits-fixture";
import { googleLabOAuth } from "./google-play-lab-oauth";
import draft from "../config/store-credit-package-drafts.json";

async function main() {
  const secretDir = join(process.env.USERPROFILE ?? "", ".docked-secrets");
  const tls = JSON.parse(
    readFileSync(join(secretDir, "google-lab-tls.json"), "utf8"),
  );
  const encryptionKey = randomBytes(32);
  const inbox = new StoreTestInbox(
    process.env.FANTASY_TEST_DATABASE_URL ?? "",
    encryptionKey,
  );
  const sql = inbox.sql;
  await sql.unsafe(readFileSync("sandbox/credits.sql", "utf8"));
  await sql.unsafe(readFileSync("sandbox/store-billing.sql", "utf8"));
  const initial = creditsFixture();
  initial.creditOnly = newCreditOnly();
  await sql`insert into credits_sandbox.state values(true,0,${sql.json(initial as any)})`;
  const store = new CreditsSandboxStore(sql);
  const products: StoreProduct[] = draft.products.map((p) => ({
    id: p.id,
    scope: "account",
    credits: p.credits,
    version: draft.version,
  }));
  const bindingSecret = randomBytes(32).toString("hex");
  const account = storeAccountId(alice.id, bindingSecret);
  const verifier = new GooglePlayTestVerifier(
    "docked.fantasy",
    products,
    googleLabOAuth(),
  );
  const secret = randomBytes(32).toString("hex"),
    expiresAt = Date.now() + 60 * 60_000;
  // ACL-protected local operator recovery material, never tracked or printed.
  writeFileSync(
    join(secretDir, "google-lab-session.json"),
    JSON.stringify({
      secret,
      expiresAt,
      database: process.env.FANTASY_TEST_DATABASE_URL,
      encryptionKey: encryptionKey.toString("hex"),
      account,
      member: alice.id,
    }),
  );
  let working = false;
  const status = async () => ({
    mode: "isolated-google-license-test",
    expiresAt,
    accountBinding: account,
    products: draft.products.map((p) => ({
      id: p.id,
      title: p.title,
      credits: p.credits,
      priceCents: p.priceCents,
      currency: "AUD",
    })),
    balance: wallet(await store.read(), alice.id).available,
    receipts: (
      await sql`select receipt_key,status from credits_sandbox.store_receipts where member_id=${alice.id}`
    ).map((r) => ({ key: r.receipt_key, state: r.status })),
  });
  const accept = async (token: string) => {
    const receipt = await verifier.verify(token, account);
    await inbox.accept(receipt, alice.id, account, token);
  };
  const reconcile = async () => {
    if (working) return status();
    working = true;
    try {
      for (const ref of await inbox.references(alice.id))
        await accept(ref.token);
      // Consumption is after committed local ledger; service re-verifies TEST.
      for (let i = 0; i < 20; i++)
        if (
          !(await inbox.deliverOne(async (provider, token, product) => {
            if (provider !== "google") throw Error();
            await verifier.consume(token, product, account);
          }))
        )
          break;
      return await status();
    } finally {
      working = false;
    }
  };
  const service = {
    session: status,
    receipt: async (token: string) => {
      await accept(token);
      return reconcile();
    },
    reconcile,
    refund: async (key: string) => {
      const ref = (await inbox.references(alice.id)).find((r) => r.key === key);
      if (!ref) throw Error("Unknown test receipt");
      await verifier.refundTestPurchase(ref.token, account);
      return reconcile();
    },
  };
  const server = createServer(
    {
      pfx: readFileSync(join(secretDir, "google-lab-loopback.p12")),
      passphrase: tls.password,
    },
    googleLabHandler(service, secret, expiresAt),
  );
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve) =>
    server.listen(48591, "127.0.0.1", resolve),
  );
  console.log(
    "Google license-test lab ready on loopback TLS port 48591. Pairing is in the protected local session file. No production database is connected. Products must remain unpublished until specifically approved.",
  );
  const timer = setInterval(() => {
    if (Date.now() < expiresAt)
      void reconcile().catch(() =>
        console.error(
          "Test reconciliation pending; no provider details logged.",
        ),
      );
  }, 30_000);
  const stop = async () => {
    clearInterval(timer);
    server.closeAllConnections();
    server.close();
    await inbox.close();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  setTimeout(() => {
    void stop();
  }, 60 * 60_000).unref();
}
void main().catch(() => {
  console.error(
    "Google local lab startup failed; private configuration was not logged.",
  );
  process.exitCode = 1;
});
