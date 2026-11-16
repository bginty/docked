/** Genuine hosted HTTP harness. Requires separately applied isolated Preview. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";
import { wallet } from "../src/core/credits-sandbox";
import {
  acceptanceDocs,
  acceptancePrivate,
  packOnly,
} from "./lib/batch1-acceptance-profile";
assert(packOnly, "Use reduced pack-only hosted prerequisite");
const dir = acceptanceDocs,
  priv = acceptancePrivate + "/http";
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const marker = "\nDOCKED_CURL_METRICS:";
const percentile = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * q) - 1];
async function main() {
  assert(
    process.argv.includes("--approved-synthetic-window"),
    "Explicit synthetic test invocation required",
  );
  const deployed = JSON.parse(
    readFileSync(dir + "/hosted-deployment.json", "utf8"),
  );
  assert.equal(deployed.projectId, "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR");
  assert.equal(deployed.target, "preview");
  assert.equal(deployed.readyState, "READY");
  assert.equal(deployed.protected, true);
  const origin = new URL(deployed.url);
  assert.match(origin.hostname, /^docked-preview-[a-z0-9-]+\.vercel\.app$/);
  assert.equal(origin.protocol, "https:");
  const runtime = JSON.parse(
    readFileSync(
      process.env.USERPROFILE +
        "/.docked-secrets/batch1-preview-runtime-20261116.json",
      "utf8",
    ),
  );
  assert.equal(runtime.state, "applied");
  assert.equal(runtime.projectRef, "bckkllmndoxzpzdqrevb");
  const database = new URL(runtime.databaseUrl);
  assert.equal(
    decodeURIComponent(database.username),
    "docked_pack_acceptance." + runtime.projectRef,
  );
  assert.match(
    database.hostname,
    /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/,
  );
  assert.equal(database.port, "5432");
  assert(
    Date.parse(runtime.expiry) - Date.now() > 3600000,
    "At least one hour must remain",
  );
  const fixture = JSON.parse(
    readFileSync(acceptancePrivate + "/fixtures.json", "utf8"),
  );
  const auth = JSON.parse(
    readFileSync(
      process.env.USERPROFILE + "/.docked-secrets/batch1-hosted-20261116.json",
      "utf8",
    ),
  );
  const connection = JSON.parse(
    readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(auth.projectRef, "bckkllmndoxzpzdqrevb");
  assert.equal(connection.projectRef, auth.projectRef);
  mkdirSync(priv, { recursive: true });
  assert(
    !process.argv.includes("--precondition"),
    "Large hosted workload removed; measure real Production beta after approved deployment",
  );
  const mode = "minimum-hosted";
  const operationFile = priv + "/" + mode + "-operation.json";
  assert(
    !existsSync(operationFile),
    "Existing run record: reconcile it before any rerun",
  );
  // This local observer is read-only and restricted to exact Preview metadata.
  // Operator credentials never enter the web deployment or an HTTP request.
  const auditDatabase = new URL(connection.databaseUrl);
  assert.equal(
    decodeURIComponent(auditDatabase.username),
    "postgres." + runtime.projectRef,
  );
  assert.equal(auditDatabase.hostname, database.hostname);
  assert.equal(auditDatabase.port, "5432");
  const observer = postgres(auditDatabase.href, {
    max: 1,
    prepare: false,
    connect_timeout: 20,
    connection: { options: "-c default_transaction_read_only=on" },
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
    onnotice: () => {},
  });
  async function snapshot() {
    const [row] =
      await observer`select document from b1_credits_sandbox.state where id`;
    assert(row?.document, "Isolated fixture required");
    const document = row.document;
    const [counts] =
      await observer`select (select count(*)::int from b1_beta_packs.issued) allocations,(select sum(issued)::int from b1_commercial_billing.definitions) lifetime`;
    return {
      document,
      packs: Object.keys(document.economy.packs).length,
      cards: Object.keys(document.economy.instances).length,
      allocations: Number(counts.allocations),
      lifetime: Number(counts.lifetime),
    };
  }
  try {
    const initial = await snapshot();
    const maximumNewPurchases = 20;
    assert(
      initial.packs + maximumNewPurchases <= 24,
      "Approved total purchase budget exhausted",
    );
    const operation = {
      mode,
      at: new Date().toISOString(),
      state: "running",
      initialPacks: initial.packs,
      maximumNewPurchases,
      requests: [] as string[],
    };
    const persistOperation = () =>
      writeFileSync(operationFile, JSON.stringify(operation, null, 2));
    persistOperation();
    function newPurchaseRequest() {
      assert(operation.requests.length < maximumNewPurchases);
      const id = randomUUID();
      operation.requests.push(id);
      persistOperation(); // Persist before HTTP, including interrupted requests.
      return id;
    }
    const sessions: { id: string; cookie: string }[] = [];
    for (const account of auth.accounts) {
      const jar = new Map<string, string>();
      const client = createServerClient(
        connection.supabaseUrl,
        connection.publishableKey,
        {
          cookies: {
            getAll: () => [...jar].map(([name, value]) => ({ name, value })),
            setAll: (items) => items.forEach((i) => jar.set(i.name, i.value)),
          },
        },
      );
      const result = await client.auth.setSession(account.session);
      assert(!result.error, "Refresh genuine synthetic Auth first");
      const session = result.data.session!;
      const claims = JSON.parse(
        Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
      );
      assert.equal(claims.aal, "aal2");
      assert(
        claims.exp * 1000 - Date.now() > 1800000,
        "Refresh synthetic MFA before measurement",
      );
      const verified = await client.auth.getUser();
      assert.equal(verified.data.user?.id, account.id);
      assert.equal(
        verified.data.user?.app_metadata.docked_acceptance,
        "batch1-hosted-20261116",
      );
      sessions.push({
        id: account.id,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      });
    }
    const records: any[] = [];
    let serial = 0;
    const sent: number[] = [0, 0];
    async function send(
      account: number,
      body: unknown,
      phase: string,
      maxSeconds = 45,
      options: { unpaced?: boolean; anonymous?: boolean } = {},
    ) {
      const file = priv + "/" + ++serial,
        headers = file + ".headers";
      const delay = 3500 - (Date.now() - sent[account]);
      if (delay > 0 && !options.unpaced)
        await new Promise((r) => setTimeout(r, delay));
      sent[account] = Date.now();
      const config = [
        'request = "POST"',
        `header = ${JSON.stringify("Origin: " + origin.origin)}`,
        ...(options.anonymous
          ? []
          : [
              `header = ${JSON.stringify("Cookie: " + sessions[account].cookie)}`,
            ]),
        'header = "Content-Type: application/json"',
        `data = ${JSON.stringify(JSON.stringify(body))}`,
        `dump-header = ${JSON.stringify(headers.replaceAll("\\", "/"))}`,
        `max-time = ${maxSeconds}`,
      ].join("\n");
      writeFileSync(file + ".curl", config);
      const start = Date.now();
      let stdout = "";
      try {
        const r = await promisify(execFile)(
          process.execPath,
          [
            cli,
            "curl",
            origin.origin + "/api/test-wallet?view=packs&result=receipt",
            "--global-config",
            authDir,
            "--scope",
            "team_tf6xweKKyVCj9bTppUKttJ4l",
            "--",
            "--silent",
            "--show-error",
            "--config",
            file + ".curl",
            "--write-out",
            marker + "%{json}",
          ],
          { windowsHide: true, maxBuffer: 8e6, timeout: 60000 },
        );
        stdout = r.stdout;
      } catch (e: any) {
        stdout = String(e.stdout ?? "");
        if (maxSeconds >= 1)
          throw Error(
            "Protected HTTP command failed; private synthetic response retained",
          );
      }
      const cut = stdout.lastIndexOf(marker);
      assert(cut >= 0, "Actual curl timing required");
      const metrics = JSON.parse(stdout.slice(cut + marker.length)),
        payload = stdout.slice(0, cut);
      writeFileSync(file + ".response", payload);
      let response = null;
      try {
        response = payload ? JSON.parse(payload) : null;
      } catch {
        assert(maxSeconds < 1, "Expected a complete JSON response");
      }
      const h = readFileSync(headers, "utf8");
      const row = {
        phase,
        account: account === 0 ? "synthetic-owner" : "synthetic-tester",
        status: Number(metrics.http_code),
        httpMs: metrics.time_total * 1000,
        ttfbMs: metrics.time_starttransfer * 1000,
        cliAndHttpMs: Date.now() - start,
        serverTiming: h
          .split(/\r?\n/)
          .filter((l) => /^server-timing:/i.test(l)),
        requestBytes: metrics.size_upload,
        responseBytes: metrics.size_download,
      };
      records.push(row);
      writeFileSync(
        priv + "/" + mode + "-progress.json",
        JSON.stringify(records, null, 2),
      );
      return { row, response };
    }
    const offers = fixture.products.filter((p: any) => p.cards === 9);
    assert.equal(offers.length, 6);
    const purchaseBody = (p: any) => ({
      request: newPurchaseRequest(),
      command: {
        kind: "buy-pack",
        product: p.id,
        configuration: p.version,
        confirmed: true,
        policy: fixture.state.policy.version,
        expectedPrice: p.priceCredits,
      },
    });
    const openBody = (request: string) => ({
      request: randomUUID(),
      command: { kind: "open-pack", entitlement: request },
    });
    const bought: { account: number; body: any; product: any }[] = [];
    // Eighteen actual offers plus two adversarial purchases, not a load benchmark.
    for (const [i, p] of fixture.products.entries()) {
      const account = i % 2,
        body = purchaseBody(p);
      bought.push({ account, body, product: p });
      const purchase = await send(account, body, "offer-confirmation");
      assert.equal(purchase.row.status, 200);
      assert.equal(purchase.response.packUpdate.pack.cardCount, p.cards);
      Object.assign(purchase.row, {
        sport: p.sport,
        packType: p.type,
        cardCount: p.cards,
        firstObserved: i === 0,
      });
      const replay = await send(account, body, "saved-result-recovery");
      assert.equal(replay.row.status, 200);
      assert.deepEqual(
        replay.response.packUpdate,
        purchase.response.packUpdate,
      );
      const opened = await send(
        account,
        openBody(body.request),
        "offer-opening",
      );
      assert.equal(opened.row.status, 200);
      assert.equal(
        new Set(
          opened.response.packUpdate.pack.receipt.cards.map((c: any) => c.id),
        ).size,
        p.cards,
      );
      const before = await snapshot();
      const denied = await send(
        1 - account,
        openBody(body.request),
        "cross-account-denial",
      );
      assert.notEqual(denied.row.status, 200);
      assert.deepEqual((await snapshot()).document, before.document);
    }
    const duplicate = purchaseBody(offers[0]);
    bought.push({ account: 0, body: duplicate, product: offers[0] });
    const races = await Promise.all(
      Array.from({ length: 8 }, () =>
        send(0, duplicate, "concurrent-duplicate", 45, { unpaced: true }),
      ),
    );
    for (const r of races) {
      assert.equal(r.row.status, 200);
      assert.deepEqual(r.response.packUpdate, races[0].response.packUpdate);
    }
    const interrupted = purchaseBody(offers[1]);
    bought.push({ account: 1, body: interrupted, product: offers[1] });
    await send(1, interrupted, "deliberate-interruption", 0.05);
    const recovered = await send(1, interrupted, "interrupted-result-recovery");
    assert.equal(recovered.row.status, 200);
    assert.equal(recovered.response.packUpdate.pack.cardCount, 9);
    const beforeAnonymous = await snapshot();
    assert.notEqual(
      (await send(0, duplicate, "anonymous-denial", 45, { anonymous: true }))
        .row.status,
      200,
    );
    assert.deepEqual((await snapshot()).document, beforeAnonymous.document);
    const final = await snapshot();
    assert.equal(final.packs - initial.packs, bought.length);
    assert.equal(
      final.document.journal.length - initial.document.journal.length,
      bought.length,
    );
    assert.equal(
      final.cards - initial.cards,
      bought.reduce((sum, b) => sum + b.product.cards, 0),
    );
    assert.equal(final.lifetime, final.allocations);
    for (const b of bought)
      assert.equal(
        new Set(final.document.economy.packs[b.body.request].cards).size,
        b.product.cards,
      );
    for (let account = 0; account < 2; account++)
      assert.equal(
        wallet(initial.document, sessions[account].id).available -
          wallet(final.document, sessions[account].id).available,
        bought
          .filter((b) => b.account === account)
          .reduce((sum, b) => sum + b.product.priceCredits, 0),
      );
    const summary = Object.fromEntries(
      [...new Set(records.map((r) => r.phase))].map((phase) => {
        const times = records
          .filter((r) => r.phase === phase)
          .map((r) => r.httpMs);
        return [
          phase,
          {
            n: times.length,
            p50Ms: percentile(times, 0.5),
            p95Ms: percentile(times, 0.95),
          },
        ];
      }),
    );
    writeFileSync(
      dir + "/hosted-http-measurements.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          deployment: deployed,
          actualHttp: true,
          genuinePreviewAuth: true,
          physicalAndroid: false,
          coldStartProven: false,
          scope:
            "Minimum hosted gate: all 18 offers, 8 duplicates, interruption/recovery and account isolation. Small fictional fixture, not Production-scale performance. First request is not proof of cold start",
          integrity: {
            oneDebitPerPurchase: true,
            exactCardCounts: true,
            allocationEqualsLifetime: true,
            actualRefundProviderTest: false,
            browserReloadOrThrottleTest: false,
          },
          workload: {
            initialCards: initial.cards,
            finalCards: final.cards,
            initialDocumentBytes: Buffer.byteLength(
              JSON.stringify(initial.document),
            ),
            finalDocumentBytes: Buffer.byteLength(
              JSON.stringify(final.document),
            ),
          },
          records,
          summary,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify(summary));
    operation.state = "completed";
    persistOperation();
  } finally {
    await observer.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
