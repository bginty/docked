import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import { NextRequest } from "next/server";

const nativeRequire = createRequire(import.meta.url);
async function load(
  entry: string,
  stubs: Record<string, unknown>,
  env: Record<string, string> = {},
) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "isolated-boundaries",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(stubs, args.path)
              ? { path: args.path, external: true }
              : undefined,
          );
        },
      },
    ],
  });
  const module = {
    exports: {} as Record<string, (...args: any[]) => Promise<any>>,
  };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    Error,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    Buffer,
    TextDecoder,
    AbortController,
    AbortSignal,
    setTimeout,
    clearTimeout,
    console,
    process: { env },
    require: (name: string) =>
      Object.hasOwn(stubs, name) ? stubs[name] : nativeRequire(name),
  });
  return module.exports;
}
const redirect = (destination: string): never => {
  throw Object.assign(Error("redirect"), { destination });
};
const redirected = async (run: () => Promise<unknown>, destination: string) =>
  assert.rejects(
    run,
    (error: unknown) =>
      (error as { destination?: string }).destination === destination,
  );

for (const beta of [true, false])
  test(`actual ${beta ? "beta" : "public"} identity checks retain both Owners, require MFA and deny retired/revoked/forged access`, async () => {
    let id = "11111111-1111-4111-8111-111111111111";
    const sessionId = "33333333-3333-4333-8333-333333333333";
    let aal = "aal2",
      role = "owner",
      admitted = true,
      allowed = true,
      active = true;
    let providerError: unknown = null;
    const token = () =>
      `fixture.${Buffer.from(JSON.stringify({ sub: id, session_id: sessionId, aal })).toString("base64url")}.isolated`;
    const sql = async (parts: TemplateStringsArray) => {
      const query = parts.join("?");
      if (query.includes("private.admitted")) return [{ allowed: admitted }];
      if (query.includes("private.beta_gameplay_identity"))
        return [{ allowed: admitted }];
      if (query.includes("select p.*"))
        return [{ id, launch_transition: { allowed, betaEnded: true } }];
      if (query.includes("where id=") && query.includes("and user_id="))
        return active ? [{ id: sessionId }] : [];
      if (query.includes("role='owner'")) return role === "owner" ? [{}] : [];
      if (query.includes("gameplay_mfa_required"))
        return [{ required: role === "owner" }];
      if (query.includes("select role")) return role ? [{ role }] : [];
      throw Error("Unexpected isolated identity query");
    };
    Object.assign(sql, { unsafe: (text: string) => text });
    const auth = await load(
      "src/server/auth.ts",
      {
        react: { cache: (fn: unknown) => fn },
        "next/headers": {
          cookies: async () => ({ getAll: () => [], set: () => {} }),
        },
        "@supabase/ssr": {
          createServerClient: () => ({
            auth: {
              getSession: async () => ({
                data: { session: { access_token: token() } },
                error: null,
              }),
              getUser: async (provided: string) => {
                assert.equal(provided, token());
                return {
                  data: {
                    user: providerError
                      ? null
                      : {
                          id,
                          email_confirmed_at: "2026-01-01",
                          is_anonymous: false,
                          user_metadata: { role: "owner" },
                        },
                  },
                  error: providerError,
                };
              },
            },
          }),
        },
        "./db": { db: () => sql },
        "./config": { sameApplicationOrigin: () => true },
        "@/core/deployment-environment": {
          assertDeploymentEnvironment: () => {},
        },
        "@/core/pack-hosted-acceptance.mjs": {
          assertPackHostedAcceptance: () => false,
        },
      },
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture",
        DOCKED_BETA_STAGING: String(beta),
        BETA_ACCESS_ENABLED: "true",
        DOCKED_OWNER_GAMEPLAY: "true",
      },
    );
    for (const uid of [id, "22222222-2222-4222-8222-222222222222"]) {
      id = uid;
      assert.equal((await auth.identity()).postBetaOwner, true);
      assert.equal((await auth.requireRole(["owner"])).user.id, uid);
      if (beta)
        await assert.rejects(
          () => auth.requireIdentity(),
          /Beta participation has ended/,
        );
      aal = "aal1";
      await assert.rejects(
        () => auth.requireRole(["owner"]),
        /Privileged MFA required/,
      );
      aal = "aal2";
    }
    active = false;
    assert.equal(await auth.identity(), null);
    active = true;
    admitted = false;
    if (beta) assert.equal(await auth.identity(), null);
    else assert.equal((await auth.identity()).postBetaOwner, true);
    admitted = true;
    allowed = false;
    assert.equal(await auth.identity(), null);
    allowed = true;
    role = "";
    assert.equal((await auth.identity()).postBetaOwner, false);
    await assert.rejects(() => auth.requireRole(["owner"]), /Role denied/);
    providerError = { status: 400, code: "session_not_found" };
    assert.equal(await auth.identity(), null);
    providerError = { status: 503, name: "AuthRetryableFetchError" };
    await assert.rejects(() => auth.identity(), /temporarily unavailable/);
  });

test("actual entry and fantasy layout redirect retained Owners before onboarding/wallet rendering", async () => {
  let who: any = {
    postBetaOwner: true,
    aal: "aal2",
    user: { id: "fictional-founder" },
  };
  let onboardingReads = 0;
  const stubs = {
    "@/server/app-view": { appViewer: async () => ({ who, configured: true }) },
    "@/server/app-onboarding": {
      appOnboardingState: async () => {
        onboardingReads++;
        return { completed: true, legalRequired: false };
      },
    },
    "@/server/auth": {
      identity: async () => who,
      requireIdentity: async () => {
        throw Error("Beta participation ended");
      },
    },
    "@/server/db": {
      db: () => {
        throw Error("No extra database allowed");
      },
    },
    "@/core/customer-onboarding.mjs": {
      customerOnboardingEnabled: () => false,
    },
    "@/core/hosted-beta.mjs": { betaOwnerAuthenticationOnly: () => false },
    "@/core/fantasy-production": { fantasyPlatformEnabled: () => true },
    "@/core/public-customer": { publicCustomersEnabled: () => false },
    "@/components/app-shell": {
      PersistentAppShell: () => {
        throw Error("Must not mount beta wallet");
      },
    },
    "next/navigation": { redirect },
  };
  const env = { DOCKED_BETA_STAGING: "true" };
  const entry = await load("src/app/app/page.tsx", stubs, env);
  const layout = await load("src/app/fantasy/layout.tsx", stubs, env);
  for (const id of ["fictional-founder", "fictional-barry"]) {
    who.user.id = id;
    await redirected(() => entry.default(), "/admin/incidents");
    await redirected(
      () => layout.default({ children: "gameplay" }),
      "/admin/incidents",
    );
  }
  assert.equal(onboardingReads, 0);
  who = { ...who, aal: "aal1" };
  await redirected(
    () => layout.default({ children: "gameplay" }),
    "/mfa?next=%2Fadmin%2Fincidents",
  );
  who = null;
  await redirected(() => entry.default(), "/app/login");
  who = {
    postBetaOwner: false,
    aal: "aal2",
    user: { id: "ordinary-active-fixture" },
  };
  await redirected(() => entry.default(), "/fantasy/play");
  assert.equal(onboardingReads, 1);
});

test("actual native session route skips retired beta onboarding and refuses a missing identity", async () => {
  let who: any = {
    postBetaOwner: true,
    aal: "aal2",
    user: { id: "owner-fixture" },
  };
  const route = await load("src/app/api/app-session/route.ts", {
    "@/server/app-view": { appViewer: async () => ({ who, configured: true }) },
    "@/server/app-onboarding": {
      appOnboardingState: async () => {
        throw Error("Retired onboarding must not run");
      },
    },
  });
  assert.deepEqual(await (await route.GET()).json(), {
    authenticated: true,
    onboardingRequired: false,
    ownerAccess: true,
  });
  who = null;
  assert.deepEqual(await (await route.GET()).json(), { authenticated: false });
});

test("admin layout requires a current identity and MFA, and offers retry on service outages", async () => {
  let who: any = { postBetaOwner: true, aal: "aal2" };
  let unavailable = false;
  const layout = await load("src/app/admin/layout.tsx", {
    "@/server/auth": {
      identity: async () => {
        if (unavailable) throw Error("private service details");
        return who;
      },
    },
    "next/navigation": { redirect },
    "@/components/app-auth-shell": { AppAuthShell: "auth-shell-fixture" },
    "@/components/owner-navigation-context": {
      OwnerNavigationProvider: "owner-navigation-fixture",
    },
  });
  assert.equal(
    (await layout.default({ children: "incidents" })).props.retiredBeta,
    true,
  );
  who = { ...who, aal: "aal1" };
  await redirected(
    () => layout.default({ children: "incidents" }),
    "/mfa?next=%2Fadmin%2Fincidents",
  );
  who = null;
  await redirected(
    () => layout.default({ children: "incidents" }),
    "/app/login?next=%2Fadmin%2Fincidents",
  );
  unavailable = true;
  const retry = await layout.default({ children: "incidents" });
  assert.equal(retry.type, "auth-shell-fixture");
  assert(!JSON.stringify(retry).includes("private service details"));
  assert(JSON.stringify(retry).includes("Retry Owner access"));
});

for (const beta of [true, false])
  test(`actual ${beta ? "beta" : "public"} login and completed MFA routes override stale beta return destinations for retained Owners`, async () => {
    let aal = "aal1";
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      email_confirmed_at: "2026-01-01",
    };
    const route = await load(
      "src/app/api/auth/route.ts",
      {
        "@/server/auth": {
          sameOrigin: () => true,
          identity: async () => ({ postBetaOwner: true, aal, user }),
          authClient: async () => ({
            auth: {
              signInWithPassword: async () => ({ data: { user }, error: null }),
            },
          }),
        },
        "@/server/config": {
          config: () => ({ auth: true, database: true, production: true }),
        },
        "@/server/db": {
          db: () => () => {
            throw Error("No wallet or onboarding DB calls expected");
          },
          rateLimit: async () => true,
        },
        "@/server/analytics": {},
        "@/server/preview-auth": {},
        "@/server/preview-invitations": {},
        "@/server/signup-profile": {},
        "@/core/auth-readiness": { productionAuthRequestDenial: () => null },
        "@/core/private-preview.mjs": { assertPrivatePreview: () => false },
        "@/server/mfa-flow": {
          mfaFlow: async () => ({
            ok: true,
            mode: "verified",
            redirect: "/fantasy/play",
          }),
        },
      },
      { DOCKED_BETA_STAGING: String(beta), BETA_ACCESS_ENABLED: "true" },
    );
    const post = (action: string) =>
      route.POST(
        new Request("https://docked.invalid/api/auth", {
          method: "POST",
          headers: { Origin: "https://docked.invalid" },
          body: JSON.stringify({
            action,
            app: true,
            email: "synthetic@example.invalid",
            password: "Synthetic-password-only",
            next: "/fantasy/play",
          }),
        }),
      );
    assert.equal(
      (await (await post("login")).json()).redirect,
      "/mfa?next=%2Fadmin%2Fincidents",
    );
    aal = "aal2";
    assert.equal(
      (await (await post("login")).json()).redirect,
      "/admin/incidents",
    );
    assert.equal(
      (await (await post("mfa_verify")).json()).redirect,
      "/admin/incidents",
    );
  });

test("actual proxy preserves multi-callback cookie changes, clears rejected chunks and never logs out other sessions", async () => {
  let failure: unknown = { status: 400, code: "refresh_token_not_found" };
  let writes = false;
  const proxy = await load(
    "src/proxy.ts",
    {
      "@supabase/ssr": {
        createServerClient: (_url: string, _key: string, options: any) => ({
          auth: {
            getUser: async () => {
              if (writes) {
                options.cookies.setAll([
                  {
                    name: "sb-fixture-auth-token.0",
                    value: "refreshed",
                    options: { path: "/" },
                  },
                ]);
                options.cookies.setAll([
                  {
                    name: "sb-fixture-auth-token.1",
                    value: "",
                    options: { path: "/", maxAge: 0 },
                  },
                ]);
              }
              return { error: failure };
            },
          },
        }),
      },
      "@/core/deployment-environment": {
        assertDeploymentEnvironment: () => {},
      },
      "@/core/pack-hosted-acceptance.mjs": {
        assertPackHostedAcceptance: () => false,
      },
      "@/server/isolated-v30-transport": {
        isolatedV30Transport: async () => null,
      },
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-key",
      SITE_URL: "https://docked.invalid",
    },
  );
  const request = (path = "/admin/incidents", method = "GET") =>
    new NextRequest("https://docked.invalid" + path, {
      method,
      headers: {
        cookie:
          "sb-fixture-auth-token.0=old; sb-fixture-auth-token.1=old2; sb-fixture-auth-token-code-verifier=retain; preference=dark",
      },
    });
  const response = await proxy.proxy(request());
  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location")).pathname,
    "/app/login",
  );
  assert.equal(
    new URL(response.headers.get("location")).searchParams.get("next"),
    "/admin/incidents",
  );
  assert.equal(response.cookies.getAll().length, 2);
  assert(
    response.cookies
      .getAll()
      .every(
        (c: any) =>
          c.value === "" &&
          c.maxAge === 0 &&
          c.httpOnly &&
          c.secure &&
          c.sameSite === "lax",
      ),
  );
  assert.equal((await proxy.proxy(request("/api/auth", "POST"))).status, 200);
  for (const error of [
    { status: 503, code: "session_not_found" },
    { status: 429 },
    { status: 403, code: "insufficient_aal" },
  ]) {
    failure = error;
    const preserved = await proxy.proxy(request());
    assert.equal(preserved.status, 200);
    assert.equal(preserved.cookies.getAll().length, 0);
  }
  failure = null;
  writes = true;
  const refreshed = await proxy.proxy(request());
  assert.equal(refreshed.cookies.getAll().length, 2);
  assert.equal(
    refreshed.cookies.get("sb-fixture-auth-token.0").value,
    "refreshed",
  );
});

test("installed Supabase SSR client removes a genuinely rejected refresh from request and response cookies", async () => {
  const calls: string[] = [];
  const sdk = nativeRequire("@supabase/ssr");
  const warnings: unknown[] = [];
  const oldWarn = console.warn;
  const proxy = await load(
    "src/proxy.ts",
    {
      "@supabase/ssr": {
        createServerClient: (url: string, key: string, options: any) =>
          sdk.createServerClient(url, key, {
            ...options,
            global: {
              fetch: async (input: string) => {
                const path = new URL(input).pathname;
                calls.push(path);
                assert.equal(path, "/auth/v1/token");
                return Response.json(
                  {
                    code: "refresh_token_not_found",
                    msg: "Invalid Refresh Token: Refresh Token Not Found",
                  },
                  {
                    status: 400,
                    headers: { "x-supabase-api-version": "2024-01-01" },
                  },
                );
              },
            },
          }),
      },
      "@/core/deployment-environment": {
        assertDeploymentEnvironment: () => {},
      },
      "@/core/pack-hosted-acceptance.mjs": {
        assertPackHostedAcceptance: () => false,
      },
      "@/server/isolated-v30-transport": {
        isolatedV30Transport: async () => null,
      },
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-key",
      SITE_URL: "https://docked.invalid",
    },
  );
  const session = {
    access_token: "fixture.eyJleHAiOjF9.fixture",
    refresh_token: "expired-fictional-refresh",
    expires_at: 1,
    token_type: "bearer",
    user: { id: "11111111-1111-4111-8111-111111111111" },
  };
  const value =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const request = new NextRequest(
    "https://docked.invalid/app/login?next=%2Fadmin%2Fincidents",
    {
      headers: {
        cookie: `sb-fixture-auth-token=${value}; sb-fixture-auth-token-code-verifier=obsolete; sb-other-auth-token=unrelated; preference=dark`,
      },
    },
  );
  try {
    console.warn = (...args) => warnings.push(args);
    const response = await proxy.proxy(request);
    assert.equal(response.status, 307);
    assert.equal(response.cookies.get("sb-fixture-auth-token").maxAge, 0);
    assert.equal(request.cookies.get("sb-fixture-auth-token"), undefined);
    assert.equal(
      request.cookies.get("sb-fixture-auth-token-code-verifier")?.value,
      "",
      "Installed SDK also expires its obsolete PKCE verifier; do not override that cleanup",
    );
    assert.equal(
      request.cookies.get("sb-other-auth-token")?.value,
      "unrelated",
    );
    assert.equal(request.cookies.get("preference")?.value, "dark");
    assert.equal(calls.length, 1);
    const clean = await proxy.proxy(
      new NextRequest(response.headers.get("location")),
    );
    assert.equal(clean.status, 200, "Clean login must not loop");
    assert.equal(calls.length, 1, "No repeated refresh or logout request");
  } finally {
    console.warn = oldWarn;
  }
});

test("Owner preference writes require same-origin public AAL2 Owner authority and bind each login independently", async () => {
  let allowed = true,
    retained = true,
    origin = true,
    uid = "founder",
    sid = "login-one";
  const route = await load(
    "src/app/api/owner-view/route.ts",
    {
      "@/server/auth": {
        sameOrigin: () => origin,
        requireRole: async (roles: string[]) => {
          assert.equal(roles.join(","), "owner");
          if (!allowed) throw Error("denied");
          return { postBetaOwner: retained, user: { id: uid }, sessionId: sid };
        },
      },
    },
    { DOCKED_PUBLIC_CUSTOMERS: "true" },
  );
  const post = (mode: string) =>
    route.POST(
      new Request("https://docked.com.au/api/owner-view?mode=" + mode, {
        method: "POST",
      }),
    );
  const enter = await post("customer");
  assert.equal(enter.status, 303);
  assert.equal(enter.headers.get("location"), "https://docked.com.au/app");
  const first = enter.cookies.get("docked-owner-customer-view");
  assert.ok(first.httpOnly && first.secure && first.sameSite === "lax");
  sid = "login-two";
  assert.notEqual(
    (await post("customer")).cookies.get(first.name).value,
    first.value,
  );
  uid = "barry";
  assert.notEqual(
    (await post("customer")).cookies.get(first.name).value,
    first.value,
  );
  const leave = await post("owner");
  assert.equal(
    leave.headers.get("location"),
    "https://docked.com.au/admin/operations",
  );
  assert.equal(leave.cookies.get(first.name).maxAge, 0);
  assert.equal((await post("other")).status, 400);
  retained = false;
  assert.equal((await post("customer")).status, 403);
  retained = true;
  allowed = false;
  assert.equal((await post("customer")).status, 403);
  allowed = true;
  origin = false;
  assert.equal((await post("customer")).status, 403);
});
