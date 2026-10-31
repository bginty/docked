/** Private operator acceptance only. Not imported by Docked customer routes. */
import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import type { IncomingMessage, ServerResponse } from "node:http";
import { GooglePlayTestVerifier } from "./store-purchase-verification";
import { StoreTestInbox } from "./store-test-inbox";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { wallet } from "../core/credits-sandbox";
import draft from "../../config/store-credit-package-drafts.json";
import { MemberStoreTestPurchases } from "./member-store-purchases";
import {
  assertMemberTestEconomy,
  memberTestCommand,
  testReceipt,
} from "../core/member-test-wallet";
import { storeAccountId } from "./store-purchase-verification";

export type HostedAcceptanceConfig = {
  secret: string;
  expiresAt: number;
  database: string;
  databaseCa: string;
  encryptionKey: string;
  account: string;
  member: string;
  memberAcceptance?: boolean;
  bindingSecret?: string;
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
    config.member !==
      (config.memberAcceptance
        ? "synthetic-store-member-20261101"
        : "synthetic-store-acceptance") ||
    (config.memberAcceptance &&
      (!/^[a-f0-9]{64}$/.test(config.bindingSecret ?? "") ||
        storeAccountId(config.member, config.bindingSecret!) !==
          config.account)) ||
    !/^[a-f0-9]{64}$/.test(config.secret) ||
    !/^[a-f0-9]{64}$/.test(config.encryptionKey) ||
    !/^[a-f0-9]{64}$/.test(config.account) ||
    !Number.isSafeInteger(config.expiresAt) ||
    config.expiresAt <= 0
  )
    throw Error("Invalid isolated acceptance configuration");
  const schema = config.memberAcceptance
    ? "store_member_acceptance"
    : "store_billing_acceptance";
  const sql = postgres(url.href, {
    ssl: { ca: config.databaseCa, rejectUnauthorized: true },
    prepare: false,
    max: 2,
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {},
  });
  const inbox = new StoreTestInbox(
    {
      hostedAcceptance: sql,
      memberAcceptance: config.memberAcceptance,
      authorize: async (_tx, _receipt, member) => {
        if (member !== config.member || Date.now() >= config.expiresAt)
          throw Error("Test session expired");
      },
    },
    Buffer.from(config.encryptionKey, "hex"),
  );
  const ledger = new CreditsSandboxStore(
    sql,
    async (_tx, state) => {
      if (Date.now() >= config.expiresAt) throw Error("Test session expired");
      if (config.memberAcceptance) assertMemberTestEconomy(state);
    },
    (_state, command) => memberTestCommand(command),
    undefined,
    undefined,
    undefined,
    schema,
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
  const memberService = config.memberAcceptance
    ? new MemberStoreTestPurchases({
        // Private native-paired session, not an impersonated Production Auth user.
        // The HTTP bearer, Vercel protection and expiring DB login gate this identity.
        authenticate: async () => ({
          member: config.member,
          session: config.secret,
        }),
        admission: async () => ({
          version: "hosted-member-test-v1",
          expiresAt: config.expiresAt,
          products: draft.products.map((p) => ({
            id: p.id,
            credits: p.credits,
            scope: "account" as const,
            version: draft.version,
          })),
        }),
        rateLimit: async () => Date.now() < config.expiresAt,
        bindingSecret: config.bindingSecret!,
        verify: (token, account) => verifier.verify(token, account),
        accept: (receipt, member, account, token) =>
          inbox.accept(receipt, member, account, token),
      })
    : null;
  const status = async () => {
    await inbox.references(config.member); // Role/marker admission precedes every status read.
    const state = await ledger.read();
    const funds = wallet(state, config.member);
    if (config.memberAcceptance) assertMemberTestEconomy(state);
    return {
      mode: "isolated-google-license-test",
      expiresAt: config.expiresAt,
      accountBinding: config.account,
      products: draft.products.map((p) => ({ ...p, currency: "AUD" })),
      balance: funds.available,
      spendable: funds.spendable,
      member: config.member,
      backend: "protected-vercel-isolated-supabase",
      policy: state.policy.version,
      packProducts: config.memberAcceptance
        ? state.economy!.activeProductVersions!.map(
            (id) => state.economy!.products[id],
          )
        : [],
      packs: config.memberAcceptance
        ? Object.values(state.economy!.packs)
            .filter((p) => p.member === config.member)
            .map((p) => ({
              id: p.id,
              name: p.product.name,
              sport: p.product.sport,
              cards: p.cards.length,
              opened: !!p.openedAt,
              status: state.entitlements[p.id]?.status,
            }))
        : [],
      collection: config.memberAcceptance
        ? Object.values(state.economy!.packs)
            .filter((p) => p.member === config.member && p.openedAt)
            .flatMap((p) => testReceipt(state, p.id, config.member).cards)
        : [],
      receipts: (
        await sql`select receipt_key,status from ${sql(schema)}.store_receipts where member_id=${config.member} order by updated_at,receipt_key`
      ).map((r) => ({ key: r.receipt_key, state: r.status })),
    };
  };
  const accept = async (token: string) =>
    memberService
      ? memberService.receipt({ token })
      : inbox.accept(
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
    let stage = "database-admission";
    try {
      // Durable rate ceiling across serverless instances. No bypass through cold starts.
      const granted =
        await sql`update ${sql(schema)}.control set calls=calls+1 where id and calls<1000 returning calls`;
      if (!granted.length)
        return send(429, { error: "Acceptance request limit reached" });
      stage = "request-validation";
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
      stage = ["status", "receipt", "reconcile", "pack", "refund"].includes(
        body.operation,
      )
        ? body.operation
        : "unknown-operation";
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
        config.memberAcceptance &&
        body.operation === "pack" &&
        keys === "command,operation,request" &&
        typeof body.request === "string" &&
        /^[a-zA-Z0-9_-]{8,80}$/.test(body.request)
      ) {
        const command = memberTestCommand(body.command);
        if (!["buy-pack", "open-pack"].includes(command.kind))
          throw Error("Pack actions only");
        await ledger.execute(
          { id: config.member, role: "member" },
          body.request,
          command,
        );
        return send(200, await status());
      }
      if (
        body.operation === "refund" &&
        keys === "key,operation" &&
        /^[a-f0-9]{64}$/.test(body.key)
      ) {
        // Terminal receipts remain retriable after a lost refund response.
        // Recheck their original member, then read Google's state before mutation.
        const ref = await inbox.reference(body.key);
        if (!ref || ref.member !== config.member) throw Error();
        await verifier.refundTestPurchase(ref.token, config.account);
        return send(200, await reconcile());
      }
      return send(400, { error: "Unsupported acceptance operation" });
    } catch (error) {
      // Only bounded error classification; never SQL, tokens, identity or bodies.
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        /^[A-Z0-9_]{1,40}$/.test(String(error.code))
          ? String(error.code)
          : "UNCLASSIFIED";
      console.error(
        JSON.stringify({ event: "isolated-acceptance-deferred", stage, code }),
      );
      return send(400, {
        error: "Test operation not confirmed; reconcile before retrying",
        stage,
        code,
      });
    }
  };
}
