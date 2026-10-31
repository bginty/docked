/** Private operator acceptance only. Not imported by Docked customer routes. */
import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import type { IncomingMessage, ServerResponse } from "node:http";
import { GooglePlayTestVerifier } from "./store-purchase-verification";
import { StoreTestInbox } from "./store-test-inbox";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { wallet } from "../core/credits-sandbox";
import draft from "../../config/store-credit-package-drafts.json";

export type HostedAcceptanceConfig = {
  secret: string;
  expiresAt: number;
  database: string;
  databaseCa: string;
  encryptionKey: string;
  account: string;
  member: string;
};
export function hostedGoogleAcceptance(
  config: HostedAcceptanceConfig,
  oauth: () => Promise<string>,
) {
  const url = new URL(config.database);
  if (
    !/^docked_billing_test\.pojoymtniryarxxunyvz$/.test(
      decodeURIComponent(url.username),
    ) ||
    !/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(url.hostname) ||
    config.member !== "synthetic-store-acceptance" ||
    !/^[a-f0-9]{64}$/.test(config.secret) ||
    !/^[a-f0-9]{64}$/.test(config.encryptionKey) ||
    !/^[a-f0-9]{64}$/.test(config.account) ||
    !Number.isSafeInteger(config.expiresAt) ||
    config.expiresAt <= 0
  )
    throw Error("Invalid isolated acceptance configuration");
  const sql = postgres(url.href, {
    ssl: { ca: config.databaseCa, rejectUnauthorized: true },
    prepare: false,
    max: 2,
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {},
  });
  const inbox = new StoreTestInbox(
    { hostedAcceptance: sql },
    Buffer.from(config.encryptionKey, "hex"),
  );
  const ledger = new CreditsSandboxStore(
    sql,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "store_billing_acceptance",
  );
  const verifier = new GooglePlayTestVerifier(
    "docked.fantasy",
    draft.products.map((p) => ({
      id: p.id,
      credits: p.credits,
      scope: "account" as const,
      version: draft.version,
    })),
    oauth,
  );
  const status = async () => {
    await inbox.references(config.member); // Role/marker admission precedes every status read.
    return {
      mode: "isolated-google-license-test",
      expiresAt: config.expiresAt,
      accountBinding: config.account,
      products: draft.products.map((p) => ({ ...p, currency: "AUD" })),
      balance: wallet(await ledger.read(), config.member).available,
      receipts: (
        await sql`select receipt_key,status from store_billing_acceptance.store_receipts where member_id=${config.member}`
      ).map((r) => ({ key: r.receipt_key, state: r.status })),
    };
  };
  const accept = async (token: string) =>
    inbox.accept(
      await verifier.verify(token, config.account),
      config.member,
      config.account,
      token,
    );
  const reconcile = async () => {
    for (const ref of await inbox.references(config.member))
      await accept(ref.token);
    for (let i = 0; i < 8; i++)
      if (
        !(await inbox.deliverOne(async (provider, token, product) => {
          if (provider !== "google") throw Error("Unsupported provider");
          await verifier.consume(token, product, config.account);
        }))
      )
        break;
    return status();
  };
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (code: number, value: unknown) => {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    const auth = req.headers.authorization ?? "";
    if (
      Date.now() >= config.expiresAt ||
      !/^Bearer [a-f0-9]{64}$/.test(auth) ||
      !timingSafeEqual(
        Buffer.from(auth),
        Buffer.from("Bearer " + config.secret),
      )
    )
      return send(401, { error: "Unauthorised" });
    if (req.headers.origin || req.headers.cookie)
      return send(403, { error: "Operator testing only" });
    if (
      req.method !== "POST" ||
      !req.headers["content-type"]?.startsWith("application/json")
    )
      return send(405, { error: "POST JSON required" });
    try {
      // Durable rate ceiling across serverless instances. No bypass through cold starts.
      const granted =
        await sql`update store_billing_acceptance.control set calls=calls+1 where id and calls<1000 returning calls`;
      if (!granted.length)
        return send(429, { error: "Acceptance request limit reached" });
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (Buffer.byteLength(text) > 8192)
          return send(413, { error: "Request too large" });
      }
      const body = JSON.parse(text);
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw Error();
      const keys = Object.keys(body).sort().join(",");
      if (body.operation === "status" && keys === "operation")
        return send(200, await status());
      if (
        body.operation === "receipt" &&
        keys === "operation,token" &&
        typeof body.token === "string"
      ) {
        await accept(body.token);
        return send(200, await reconcile());
      }
      if (body.operation === "reconcile" && keys === "operation")
        return send(200, await reconcile());
      if (
        body.operation === "refund" &&
        keys === "key,operation" &&
        /^[a-f0-9]{64}$/.test(body.key)
      ) {
        const ref = (await inbox.references(config.member)).find(
          (r) => r.key === body.key,
        );
        if (!ref) throw Error();
        await verifier.refundTestPurchase(ref.token, config.account);
        return send(200, await reconcile());
      }
      return send(400, { error: "Unsupported acceptance operation" });
    } catch {
      return send(400, {
        error: "Test operation not confirmed; reconcile before retrying",
      });
    }
  };
}
