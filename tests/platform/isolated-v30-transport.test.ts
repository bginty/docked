import test from "node:test";
import assert from "node:assert/strict";
import {
  isolatedV30Transport,
  v30TransportConfig,
  relayIsolatedGoogleNotification,
} from "../../src/server/isolated-v30-transport";
const now = Date.now();
const origin = "https://docked.com.au";
const env = {
  DOCKED_V30_TRANSPORT: "true",
  VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  VERCEL_ENV: "production",
  SITE_URL: origin,
  DOCKED_V30_TRANSPORT_UNTIL: new Date(now + 3600000).toISOString(),
  DOCKED_V30_TRANSPORT_KEY: "a".repeat(64),
  DOCKED_V30_TRANSPORT_TARGET:
    "https://docked-preview-fixture-briant-s-projects.vercel.app",
  DOCKED_V30_TRANSPORT_OIDC:
    "fixture." +
    Buffer.from(JSON.stringify({ exp: Math.ceil(now / 1000) + 7200 })).toString(
      "base64url",
    ) +
    ".fixture",
};
const session =
  "__Host-docked-v30-acceptance=" + v30TransportConfig(env, now)!.session;
test('isolated notification relay preserves Google bearer and waits for durable upstream acknowledgement',async()=>{
 const request=()=>new Request(origin+'/api/store/google/notifications',{method:'POST',headers:{authorization:'Bearer signed-google-fixture','content-type':'application/json'},body:'{"message":{}}'});
 let calls=0;
 const fake:typeof fetch=async(url,init)=>{calls++;assert.equal(url,env.DOCKED_V30_TRANSPORT_TARGET+'/api/store/google/commercial/notifications');assert.equal(new Headers(init!.headers).get('authorization'),'Bearer signed-google-fixture');assert.equal(new Headers(init!.headers).get('cookie'),null);return new Response(null,{status:204});};
 await relayIsolatedGoogleNotification(request(),env,fake);assert.equal(calls,1);
 await relayIsolatedGoogleNotification(request(),{...env,DOCKED_V30_TRANSPORT:'false'},fake);assert.equal(calls,1);
 await assert.rejects(relayIsolatedGoogleNotification(request(),env,async()=>new Response(null,{status:503})));
 const browser=request();browser.headers.set('origin',origin);await assert.rejects(relayIsolatedGoogleNotification(browser,env,fake));assert.equal(calls,1);
});
test("ordinary v30 requests never enter transport; wrong project/target/expiry denied", async () => {
  assert.equal(
    await isolatedV30Transport(new Request(origin + "/app"), env),
    null,
  );
  for (const patch of [
    { VERCEL_ENV: "preview" },
    { DOCKED_V30_TRANSPORT_TARGET: origin },
    { DOCKED_V30_TRANSPORT_UNTIL: new Date(now - 1).toISOString() },
  ])
    assert.throws(() => v30TransportConfig({ ...env, ...patch }, now));
});
test("admission requires exact secret, same-origin POST and bounded input", async () => {
  for (const [code, from] of [
    ["wrong", origin],
    [env.DOCKED_V30_TRANSPORT_KEY, "https://evil.invalid"],
    ["é".repeat(64), origin],
    ["x".repeat(1024), origin],
  ]) {
    const r = await isolatedV30Transport(
      new Request(origin + "/profile/qa_billing", {
        method: "POST",
        headers: { origin: from },
        body: new URLSearchParams({ code }),
      }),
      env,
    );
    assert.equal(r!.status, 503);
    assert.equal(r!.headers.get("set-cookie"), null);
  }
  const r = await isolatedV30Transport(
    new Request(origin + "/profile/qa_billing", {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams({ code: env.DOCKED_V30_TRANSPORT_KEY }),
    }),
    env,
  );
  assert.equal(r!.status, 303);
  assert.equal(r!.headers.get('location'),'https://docked.com.au/app/login');
  assert.equal(r!.headers.get('referrer-policy'),'same-origin');
  assert.match(r!.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict/);
});
test("only Preview Auth reaches protected upstream; no Production cookie/bearer/admission forwarding", async () => {
  const fake: typeof fetch = async (url, options) => {
    assert.equal(
      url,
      env.DOCKED_V30_TRANSPORT_TARGET + "/api/store/google/commercial",
    );
    const h = new Headers(options!.headers);
    assert.equal(h.get("cookie"), "sb-bckkllmndoxzpzdqrevb-auth-token=preview");
    assert.equal(h.get("authorization"), null);
    assert.equal(h.get("x-forwarded-host"), null);
    assert.equal(
      h.get("origin"),
      "https://docked-preview-s24-briant-ginty.vercel.app",
    );
    assert.equal(options!.redirect, "manual");
    return Response.json({ isolated: true });
  };
  const r = await isolatedV30Transport(
    new Request(origin + "/api/store/google/commercial", {
      method: "POST",
      headers: {
        origin,
        cookie:
          session +
          "; sb-pojoymtniryarxxunyvz-auth-token=production; sb-bckkllmndoxzpzdqrevb-auth-token=preview",
        authorization: "Bearer fixture",
        "x-forwarded-host": "evil.invalid",
      },
      body: "{}",
    }),
    env,
    fake,
    now,
  );
  assert.equal(r!.status, 200);
  assert.equal(r!.headers.get("cache-control"), "private, no-store");
  assert(
    !JSON.stringify([...r!.headers]).includes(env.DOCKED_V30_TRANSPORT_OIDC),
  );
});
test("expired or disabled sessions, admin routes and forged origins fail without live fallback", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls++;
    return new Response();
  };
  const req = new Request(origin + "/api/store/google/commercial", {
    headers: { cookie: session },
  });
  assert.equal(
    (await isolatedV30Transport(req, env, fake, now + 7200000))!.status,
    503,
  );
  assert.equal((await isolatedV30Transport(req, {}, fake, now))!.status, 503);
  assert.equal(
    (await isolatedV30Transport(
      new Request(origin + "/api/admin/test", { headers: { cookie: session } }),
      env,
      fake,
      now,
    ))!.status,
    403,
  );
  assert.equal(
    (await isolatedV30Transport(
      new Request(origin + "/api/store/google/commercial", {
        method: "POST",
        headers: { cookie: session, origin: "https://evil.invalid" },
      }),
      env,
      fake,
      now,
    ))!.status,
    503,
  );
  assert.equal(calls, 0);
});
test("native expired-session documents retain recovery controls without forwarding API or RSC requests", async () => {
  let calls = 0;
  const upstream: typeof fetch = async () => { calls++; return new Response(); };
  for (const [path, headers, status] of [
    ["/app", { accept: "text/html" }, 200],
    ["/api/store/google/commercial", { accept: "text/html" }, 503],
    ["/app", { accept: "text/html", rsc: "1" }, 503],
  ] as const) {
    const r = await isolatedV30Transport(new Request(origin + path, {
      headers: { ...headers, cookie: session },
    }), env, upstream, now + 7200000);
    assert.equal(r!.status, status);
    assert.match(await r!.text(), /Reconnect authorised TEST session/);
    assert.equal(r!.headers.get("set-cookie"), null);
  }
  assert.equal(calls, 0);
});

test("redirects and Set-Cookie cannot escape Preview scope; expired marker can be exited explicitly", async () => {
  const req = new Request(origin + "/app", { headers: { cookie: session } });
  for (const h of [
    { location: "https://evil.invalid" },
    { "set-cookie": "sb-pojoymtniryarxxunyvz-auth-token=bad" },
  ] as Record<string, string>[]) {
    const fake: typeof fetch = async () =>
      new Response(null, { status: 302, headers: h });
    assert.equal(
      (await isolatedV30Transport(req, env, fake, now))!.status,
      503,
    );
  }
  const response = await isolatedV30Transport(
    new Request(origin + "/profile/qa_billing_exit", {
      method: "POST",
      headers: {
        origin,
        cookie:
          session +
          "; sb-bckkllmndoxzpzdqrevb-auth-token=preview; sb-pojoymtniryarxxunyvz-auth-token=production",
      },
    }),
    {},
    undefined,
    now,
  );
  assert.equal(response!.status, 303);
  assert.equal(response!.headers.getSetCookie().length, 2);
  assert(!response!.headers.getSetCookie().join().includes("pojoy"));
});
