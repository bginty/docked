import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  verify,
  constants,
  createHash,
  randomBytes,
} from "node:crypto";
import { Webhook } from "svix";
import {
  emailHandler,
  graphAssertion,
  messagesFor,
  projectUrl,
  sendGraph,
} from "../../supabase/functions/docked-auth-email/mail.mjs";

function payload(action = "signup") {
  return {
    user: {
      email: "member@example.test",
      new_email: "replacement@example.test",
    },
    email_data: {
      site_url: "https://docked-production.netlify.app",
      redirect_to: "https://docked-production.netlify.app/auth/callback",
      email_action_type: action,
      token_hash: "a".repeat(64),
      token_hash_new: "b".repeat(64),
    },
  };
}
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
test("real GoTrue project site_url is accepted only with the pinned beta callback", () => {
  const origin = "https://docked-production-fixture.vercel.app";
  for (const action of ["invite", "recovery", "signup"]) {
    const p = payload(action);
    p.email_data.site_url = projectUrl;
    p.email_data.redirect_to = origin + "/auth/callback?next=/app/verified";
    const options = { allowInvites: true, betaOrigin: origin };
    const messages = messagesFor(p, options);
    assert.equal(messages.length, 1);
    assert.ok(
      messages[0].body.content.includes(
        action === "invite"
          ? origin + "/auth/invite"
          : projectUrl + "/auth/v1/verify",
      ),
    );
    for (const badSite of [
      "https://other.supabase.co",
      projectUrl + ".evil.test",
      "https://example.test",
    ]) {
      assert.throws(
        () =>
          messagesFor(
            { ...p, email_data: { ...p.email_data, site_url: badSite } },
            options,
          ),
        /Unapproved/,
      );
    }
    for (const badCallback of [
      "https://docked.com.au/auth/callback",
      "https://docked-production.netlify.app/auth/callback",
      origin + "/auth/callback?next=https://example.test",
      "https://docked-production-other.vercel.app/auth/callback",
    ]) {
      assert.throws(
        () =>
          messagesFor(
            { ...p, email_data: { ...p.email_data, redirect_to: badCallback } },
            options,
          ),
        /Unapproved/,
      );
    }
  }
});
// Certificate bytes are authored test data; the real Entra certificate/key match is a deployment gate.
const certificate = Buffer.from(
  "authored certificate bytes for thumbprint test",
);
const env = {
  SUPABASE_URL: projectUrl,
  DOCKED_GRAPH_MAIL_ENABLED: "true",
  GRAPH_TENANT_ID: "11111111-1111-4111-8111-111111111111",
  GRAPH_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
  GRAPH_PRIVATE_KEY_PEM: pair.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString(),
  GRAPH_CERTIFICATE_PEM: `-----BEGIN CERTIFICATE-----\n${certificate.toString("base64")}\n-----END CERTIFICATE-----`,
};

test("Auth links bind production project and exact callbacks; secure email-change hashes map to their intended recipients", () => {
  for (const action of ["signup", "recovery", "magiclink"]) {
    const input = payload(action);
    input.email_data.token_hash = "pkce_" + "a".repeat(64);
    const [message] = messagesFor(input);
    const link = new URL(
      message.body.content
        .split("\n")
        .find((line: string) => line.startsWith("https://"))!,
    );
    assert.equal(link.origin, projectUrl);
    assert.equal(link.searchParams.get("type"), action);
    assert.equal(link.searchParams.get("token"), input.email_data.token_hash);
  }
  const messages = messagesFor(payload("email_change"));
  assert.equal(messages.length, 2);
  assert.equal(
    messages[0].toRecipients[0].emailAddress.address,
    "member@example.test",
  );
  assert.match(messages[0].body.content, new RegExp("b".repeat(64)));
  assert.equal(
    messages[1].toRecipients[0].emailAddress.address,
    "replacement@example.test",
  );
  assert.match(messages[1].body.content, new RegExp("a".repeat(64)));
  for (const destination of [
    "https://evil.invalid/",
    "https://docked.com.au.evil.invalid/auth/callback",
    "https://docked.com.au/auth/callback?next=https://evil.invalid",
    "http://docked.com.au/auth/callback",
  ]) {
    const p = payload();
    p.email_data.redirect_to = destination;
    assert.throws(() => messagesFor(p));
  }
  const bad = payload("email_change");
  bad.email_data.token_hash_new = "";
  assert.throws(() => messagesFor(bad));
  const badRecipient = payload();
  badRecipient.user.email = "victim@example.test\r\nBcc: other@example.test";
  assert.throws(() => messagesFor(badRecipient));
  assert.throws(() => messagesFor(payload("unknown")));
  assert.throws(() => messagesFor(payload("invite")));
  for (const action of ["toString", "__proto__", "constructor"])
    assert.throws(() => messagesFor(payload(action)));
});

test("Certificate OAuth assertion uses PS256, fixed tenant endpoint and short expiry", async () => {
  const { endpoint, assertion } = await graphAssertion(env, 1_800_000_000_000);
  const [headerPart, bodyPart, signature] = assertion.split(".");
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString());
  const body = JSON.parse(Buffer.from(bodyPart, "base64url").toString());
  assert.equal(header.alg, "PS256");
  assert.equal(
    header["x5t#S256"],
    createHash("sha256").update(certificate).digest("base64url"),
  );
  assert.equal(body.aud, endpoint);
  assert.equal(body.iss, env.GRAPH_CLIENT_ID);
  assert.equal(body.sub, env.GRAPH_CLIENT_ID);
  assert.equal(body.exp - body.iat, 300);
  assert.equal(
    verify(
      "sha256",
      Buffer.from(`${headerPart}.${bodyPart}`),
      {
        key: pair.publicKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      },
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
  await assert.rejects(() =>
    graphAssertion({ ...env, GRAPH_TENANT_ID: "common" }),
  );
});

test("Graph transport pins sender, refuses redirects/errors and does not interpret acceptance as delivery", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const fake: typeof fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return calls.length === 1
      ? Response.json({ access_token: "test-token", token_type: "Bearer" })
      : new Response(null, { status: 202 });
  };
  await sendGraph(messagesFor(payload()), env, fake);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(
    calls[1].url,
    "https://graph.microsoft.com/v1.0/users/support%40docked.com.au/sendMail",
  );
  assert.equal(calls[1].options.redirect, "error");
  const sent = JSON.parse(calls[1].options.body as string);
  assert.equal(sent.saveToSentItems, true);
  assert.equal(
    sent.message.toRecipients[0].emailAddress.address,
    "member@example.test",
  );
  const form = new URLSearchParams(calls[0].options.body as URLSearchParams);
  assert.equal(form.get("scope"), "https://graph.microsoft.com/.default");
  assert.equal(form.has("client_secret"), false);
  await assert.rejects(() =>
    sendGraph(
      messagesFor(payload()),
      { ...env, SUPABASE_URL: "https://other.supabase.co" },
      fake,
    ),
  );
  assert.equal(calls.length, 2);
  let count = 0;
  await assert.rejects(
    () =>
      sendGraph(messagesFor(payload()), env, async () =>
        ++count === 1
          ? Response.json({ access_token: "test-token", token_type: "Bearer" })
          : new Response("sensitive provider error", { status: 403 }),
      ),
    /submission not accepted/,
  );
});

test("Signed hook rejects unsigned, altered, expired and oversized requests before sending and redacts provider failures", async () => {
  const secret = "whsec_" + randomBytes(32).toString("base64");
  const webhook = new Webhook(secret);
  let sent = 0;
  const handler = emailHandler({
    verify: (body: string, headers: Record<string, string>) =>
      webhook.verify(body, headers),
    send: async () => {
      sent++;
    },
  });
  const body = JSON.stringify(payload());
  const now = new Date();
  const id = "msg_test_docked";
  const headers = {
    "webhook-id": id,
    "webhook-timestamp": Math.floor(now.getTime() / 1000).toString(),
    "webhook-signature": webhook.sign(id, now, body),
  };
  const req = (value = body, h: Record<string, string> = headers) =>
    new Request("https://hook.invalid", {
      method: "POST",
      headers: h,
      body: value,
    });
  assert.equal((await handler(req(body, {}))).status, 401);
  assert.equal((await handler(req(body + " "))).status, 401);
  const old = new Date(Date.now() - 600_000);
  assert.equal(
    (
      await handler(
        req(body, {
          ...headers,
          "webhook-timestamp": Math.floor(old.getTime() / 1000).toString(),
          "webhook-signature": webhook.sign(id, old, body),
        }),
      )
    ).status,
    401,
  );
  assert.equal((await handler(req("x".repeat(32769)))).status, 413);
  assert.equal(sent, 0);
  assert.equal((await handler(req())).status, 200);
  assert.equal(sent, 1);
  const failure = emailHandler({
    verify: (b: string, h: Record<string, string>) => webhook.verify(b, h),
    send: async () => {
      throw Error("secret and verification token");
    },
  });
  const response = await failure(req());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|token/);
});

test("Graph timeout aborts authorization within one shared budget", async () => {
  const started = Date.now();
  let count = 0;
  await assert.rejects(
    () =>
      sendGraph(messagesFor(payload()), env, async (_url, init) => {
        count++;
        return await new Promise<Response>((_resolve, reject) => {
          const keepAlive = setTimeout(
            () => reject(Error("Abort deadline was not enforced")),
            6000,
          );
          init!.signal!.addEventListener(
            "abort",
            () => {
              clearTimeout(keepAlive);
              reject(new DOMException("Timed out", "TimeoutError"));
            },
            { once: true },
          );
        });
      }),
    /Timed out/,
  );
  assert.equal(count, 1);
  assert.ok(Date.now() - started < 5500);
});

test("Partial secure-email-change submission and send timeout never report complete success", async () => {
  let calls = 0;
  let firstSignal: AbortSignal | null | undefined;
  const fake: typeof fetch = async (_url, init) => {
    calls++;
    if (calls === 1) {
      firstSignal = init!.signal;
      return Response.json({
        access_token: "test-token",
        token_type: "Bearer",
      });
    }
    assert.equal(init!.signal, firstSignal);
    return new Response(null, { status: calls === 2 ? 202 : 503 });
  };
  await assert.rejects(
    () => sendGraph(messagesFor(payload("email_change")), env, fake),
    /submission not accepted/,
  );
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(() =>
    sendGraph(messagesFor(payload()), env, async () => {
      if (++calls === 1)
        return Response.json({
          access_token: "test-token",
          token_type: "Bearer",
        });
      throw new DOMException(
        "Provider timeout with private details",
        "TimeoutError",
      );
    }),
  );
  assert.equal(calls, 2);
});
