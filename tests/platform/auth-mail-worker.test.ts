import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { Webhook } from "svix";
import {
  queueJobs,
  drainOne,
} from "../../supabase/functions/docked-auth-email/queue.mjs";
import { hookRouter } from "../../supabase/functions/docked-auth-email/router.mjs";
import {
  messagesFor,
  projectUrl,
} from "../../supabase/functions/docked-auth-email/mail.mjs";
let pg: PGlite;
const secret = "v1,whsec_" + Buffer.alloc(32, 7).toString("base64"); // authored test secret, never deployed
const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = {
  SUPABASE_URL: projectUrl,
  DOCKED_GRAPH_TEST_ENABLED: "true",
  DOCKED_GRAPH_MAIL_ENABLED: "false",
  DOCKED_GRAPH_RECIPIENT_MODE: "support-test",
  SEND_EMAIL_HOOK_SECRET: secret,
  GRAPH_TENANT_ID: "b34880d6-d28e-40c2-b389-232506c69650",
  GRAPH_CLIENT_ID: "b725bf93-6183-40c5-9aac-839e02ace03a",
  GRAPH_PRIVATE_KEY_PEM: key.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString(),
  GRAPH_CERTIFICATE_PEM:
    "-----BEGIN CERTIFICATE-----\n" +
    Buffer.from("authored test certificate").toString("base64") +
    "\n-----END CERTIFICATE-----",
};
const payload = (token = "a") => ({
  user: { email: "support@docked.com.au" },
  email_data: {
    site_url: "https://docked-production.netlify.app",
    redirect_to: "https://docked-production.netlify.app/auth/callback",
    email_action_type: "recovery",
    token_hash: token.repeat(64),
  },
});
async function rpc(action: string, data: object) {
  return (
    await pg.query<{ r: any }>(
      "select public.docked_mail_queue($1,$2::jsonb) r",
      [action, JSON.stringify(data)],
    )
  ).rows[0].r;
}
async function enqueue(token: string) {
  const jobs = await queueJobs(
    messagesFor(payload(token)),
    secret,
    "controlled",
  );
  await rpc("enqueue", { mode: "controlled", jobs });
  return jobs[0].id;
}
before(async () => {
  pg = new PGlite();
  await pg.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  await pg.exec(
    await readFile(
      "config/production-email/supabase/migrations/20261008121711_docked_auth_email_outbox.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "config/production-email/supabase/migrations/20261008133413_docked_auth_mail_scheduler.sql",
      "utf8",
    ),
  );
});
after(async () => await pg.close());
test("production dispatch rejects previously queued unapproved recipients before certificate or Graph requests", async () => {
  const input = payload("r");
  input.user.email = "other@example.test";
  const jobs = await queueJobs(messagesFor(input), secret, "production");
  await rpc("enqueue", { mode: "production", jobs });
  let fetched = 0;
  const result = await drainOne({
    env: { ...env, DOCKED_GRAPH_MAIL_ENABLED: "true" },
    mode: "production",
    rpc,
    id: jobs[0].id,
    fetcher: async () => {
      fetched++;
      throw Error("must not call provider");
    },
  });
  assert.equal(result.state, "failed");
  assert.equal(fetched, 0);
});
test("ciphertext is randomized, identities stable, tampering fails before Graph", async () => {
  const m = messagesFor(payload());
  const a = await queueJobs(m, secret, "controlled"),
    b = await queueJobs(m, secret, "controlled");
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].fingerprint, b[0].fingerprint);
  assert.notDeepEqual(a[0].envelope, b[0].envelope);
  assert.doesNotMatch(JSON.stringify(a), /support@|token=/);
  await assert.rejects(() =>
    queueJobs(
      messagesFor({ ...payload(), user: { email: "other@example.test" } }),
      secret,
      "controlled",
    ),
  );
  a[0].envelope.ciphertext = "broken";
  await rpc("enqueue", { mode: "controlled", jobs: a });
  let fetches = 0;
  const result = await drainOne({
    env,
    mode: "controlled",
    rpc,
    id: a[0].id,
    fetcher: async () => {
      fetches++;
      throw Error("must not reach Graph");
    },
  });
  assert.equal(result.state, "failed");
  assert.equal(fetches, 0);
});
test("two concurrent workers make one Graph submission; accepted retry is idle", async () => {
  const id = await enqueue("b");
  let sends = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).includes("oauth2"))
      return Response.json({ access_token: "authored", token_type: "Bearer" });
    sends++;
    return new Response(null, { status: 202 });
  };
  const results = await Promise.all([
    drainOne({ env, mode: "controlled", rpc, id, fetcher }),
    drainOne({ env, mode: "controlled", rpc, id, fetcher }),
  ]);
  assert.equal(sends, 1);
  assert.ok(results.some((r) => r.state === "accepted"));
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
    "idle",
  );
  assert.equal(sends, 1);
});

test("bounded worker clears 32 healthy queued jobs in eight ticks and admission rejects overflow", async () => {
  await pg.query(
    "update private.docked_auth_mail_outbox set expires_at=clock_timestamp()-interval '1 second' where state in ('pending','authorizing','dispatching')",
  );
  const jobs = [];
  for (let index = 0; index < 32; index++) {
    const job = (
      await queueJobs(
        messagesFor(payload((index + 32).toString(16))),
        secret,
        "production",
      )
    )[0];
    jobs.push(job);
    await rpc("enqueue", { mode: "production", jobs: [job] });
  }
  await rpc("enqueue", { mode: "production", jobs: [jobs[0]] });
  const overflow = await queueJobs(
    messagesFor(payload("o")),
    secret,
    "production",
  );
  await assert.rejects(
    () => rpc("enqueue", { mode: "production", jobs: overflow }),
    /capacity unavailable/,
  );
  let sends = 0;
  const router = hookRouter(
    {
      ...env,
      DOCKED_GRAPH_MAIL_ENABLED: "true",
      DOCKED_GRAPH_WORKER_READY: "true",
    },
    () => {},
    rpc,
    async (url) => {
      if (String(url).includes("oauth2"))
        return Response.json({
          access_token: "authored",
          token_type: "Bearer",
        });
      sends++;
      return new Response(null, { status: 202 });
    },
  );
  for (let tick = 0; tick < 8; tick++) {
    const response = await router(
      new Request(projectUrl + "/functions/v1/docked-auth-email/worker", {
        method: "POST",
        body: JSON.stringify({ mode: "production", control: "drain" }),
      }),
    );
    assert.deepEqual((await response.json()).states, [
      "accepted",
      "accepted",
      "accepted",
      "accepted",
    ]);
  }
  assert.equal(sends, 32);
  const idle = await router(
    new Request(projectUrl + "/functions/v1/docked-auth-email/worker", {
      method: "POST",
      body: JSON.stringify({ mode: "production", control: "drain" }),
    }),
  );
  assert.deepEqual((await idle.json()).states, [
    "idle",
    "idle",
    "idle",
    "idle",
  ]);
  assert.equal(sends, 32);
  assert.ok(8 * 60 < 15 * 60); // One-minute healthy schedule, not measured cloud throughput.
});
test("Graph response lost after acceptance is held unknown and never resubmitted", async () => {
  const id = await enqueue("c");
  let sends = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).includes("oauth2"))
      return Response.json({ access_token: "authored", token_type: "Bearer" });
    sends++;
    throw new DOMException(
      "Response lost after remote acceptance",
      "TimeoutError",
    );
  };
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
    "unknown",
  );
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
    "idle",
  );
  assert.equal(sends, 1);
});
test("authorization failure is retriable but dispatch-fence failure never sends", async () => {
  const id = await enqueue("d");
  let sends = 0;
  const badAuth: typeof fetch = async () => new Response(null, { status: 503 });
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher: badAuth }))
      .state,
    "pending",
  );
  const id2 = await enqueue("e");
  const ambiguousFence = async (action: string, data: object) => {
    const result = await rpc(action, data);
    if (action === "dispatch") throw Error("RPC response lost");
    return result;
  };
  await assert.rejects(() =>
    drainOne({
      env,
      mode: "controlled",
      rpc: ambiguousFence,
      id: id2,
      fetcher: async () => {
        sends++;
        return Response.json({
          access_token: "authored",
          token_type: "Bearer",
        });
      },
    }),
  );
  assert.equal(sends, 1); // authorization only; no Graph send after unknown fence outcome
});
test("confirmed Graph 429 and 5xx are held; invalid transition cannot retry dispatch", async () => {
  for (const [token, status] of [
    ["f", 429],
    ["g", 503],
  ] as const) {
    const id = await enqueue(token);
    let sends = 0;
    const fetcher: typeof fetch = async (url) => {
      if (String(url).includes("oauth2"))
        return Response.json({
          access_token: "authored",
          token_type: "Bearer",
        });
      sends++;
      return new Response(null, { status });
    };
    assert.equal(
      (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
      "unknown",
    );
    assert.equal(
      (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
      "idle",
    );
    assert.equal(sends, 1);
  }
});
test("signed controlled queue is support-only and production path stays disabled", async () => {
  const webhook = new Webhook(secret.slice(3));
  const router = hookRouter(
    env,
    (body: string, headers: Record<string, string>) =>
      webhook.verify(body, headers),
    rpc,
  );
  const request = (value: object, path = "/control", signed = true) => {
    const body = JSON.stringify(value),
      now = new Date(),
      id = "test-" + now.getTime();
    return new Request(projectUrl + "/functions/v1/docked-auth-email" + path, {
      method: "POST",
      body,
      headers: signed
        ? {
            "webhook-id": id,
            "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
            "webhook-signature": webhook.sign(id, now, body),
          }
        : {},
    });
  };
  assert.equal(
    (
      await router(
        request(
          { control: "enqueue", mode: "controlled", auth: payload("h") },
          "/control",
          false,
        ),
      )
    ).status,
    401,
  );
  assert.equal((await router(request(payload("h"), ""))).status, 503);
  const body = { control: "enqueue", mode: "controlled", auth: payload("h") };
  const first = await router(request(body));
  assert.equal(first.status, 200);
  const initial = await first.json();
  assert.deepEqual(await (await router(request(body))).json(), initial);
  assert.equal(
    (
      await router(
        request({
          ...body,
          auth: { ...payload("h"), user: { email: "other@example.test" } },
        }),
      )
    ).status,
    503,
  );
  const disabled = hookRouter(
    { ...env, DOCKED_GRAPH_TEST_ENABLED: "false" },
    () => {},
    rpc,
  );
  assert.equal((await disabled(request(body))).status, 400);
});

test("production enqueue and worker require both activation gates", async () => {
  const signed = (body: object, path: string) =>
    new Request(projectUrl + "/functions/v1/docked-auth-email" + path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  for (const flags of [
    { DOCKED_GRAPH_MAIL_ENABLED: "false", DOCKED_GRAPH_WORKER_READY: "true" },
    { DOCKED_GRAPH_MAIL_ENABLED: "true", DOCKED_GRAPH_WORKER_READY: "false" },
  ]) {
    let calls = 0;
    const router = hookRouter(
      { ...env, ...flags },
      () => {},
      async () => {
        calls++;
        throw Error("must not call");
      },
    );
    assert.equal((await router(signed(payload("j"), ""))).status, 503);
    assert.equal(
      (
        await router(
          signed({ mode: "production", control: "drain" }, "/worker"),
        )
      ).status,
      400,
    );
    assert.equal(calls, 0);
  }
});
test("controlled diagnostic fixes recipient and content and deduplicates", async () => {
  const router = hookRouter(env, () => {}, rpc);
  const body = {
    mode: "controlled",
    control: "diagnostic",
    id: "9".repeat(64),
    recipient: "other@example.test",
    content: "untrusted",
  };
  const request = () =>
    new Request(projectUrl + "/functions/v1/docked-auth-email/control", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const first = await router(request());
  assert.equal(first.status, 200);
  const result = await first.json();
  assert.deepEqual(await (await router(request())).json(), result);
  let sent: any;
  await drainOne({
    env,
    mode: "controlled",
    rpc,
    id: result.jobs[0].id,
    fetcher: async (url, init) => {
      if (String(url).includes("oauth2"))
        return Response.json({
          access_token: "authored",
          token_type: "Bearer",
        });
      sent = JSON.parse(String(init?.body));
      return new Response(null, { status: 202 });
    },
  });
  assert.equal(
    sent.message.toRecipients[0].emailAddress.address,
    "support@docked.com.au",
  );
  assert.doesNotMatch(sent.message.body.content, /untrusted|token=/);
});
test("accepted Graph send with failed receipt write never sends again", async () => {
  const id = await enqueue("k");
  let sends = 0;
  const failingSettle = async (action: string, data: object) => {
    if (action === "settle") throw Error("receipt unavailable");
    return rpc(action, data);
  };
  const fetcher: typeof fetch = async (url) => {
    if (String(url).includes("oauth2"))
      return Response.json({ access_token: "authored", token_type: "Bearer" });
    sends++;
    return new Response(null, { status: 202 });
  };
  await assert.rejects(() =>
    drainOne({ env, mode: "controlled", rpc: failingSettle, id, fetcher }),
  );
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
    "idle",
  );
  await pg.query(
    "update private.docked_auth_mail_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1",
    [id],
  );
  assert.equal(
    (await rpc("status", { mode: "controlled", id })).state,
    "unknown",
  );
  assert.equal(
    (await drainOne({ env, mode: "controlled", rpc, id, fetcher })).state,
    "idle",
  );
  assert.equal(sends, 1);
});
