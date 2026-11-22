import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import { commercialPack } from "../../src/core/commercial-billing";
import { OwnerPackAwardRejected } from "../../src/core/owner-pack-awards";

const nativeRequire = createRequire(import.meta.url);
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
const command = {
  request: "44444444-4444-4444-8444-444444444444",
  member,
  reason: "PROMOTION",
  reference: "Isolated promotion fixture",
  confirmed: true,
  lines: [
    {
      sport: "nfl",
      family: "PREMIUM",
      size: 1,
      quantity: 1,
      configurationHash: commercialPack("nfl", "PREMIUM", 1).configurationHash,
    },
    {
      sport: "nfl",
      family: "STANDARD",
      size: 9,
      quantity: 1,
      configurationHash: commercialPack("nfl", "STANDARD", 9).configurationHash,
    },
  ],
};

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
        name: "award-boundaries",
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

class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 429,
  ) {
    super(message);
  }
}
function request(
  body: string,
  origin = "https://fixture.invalid",
  actor: string | null = owner,
) {
  const headers: Record<string, string> = {
    origin,
    "content-type": "application/json",
  };
  if (actor !== null) headers["x-docked-owner"] = actor;
  return new Request("https://fixture.invalid/api/admin/pack-awards", {
    method: "POST",
    headers,
    body,
  });
}

test("award HTTP boundary rejects other origins, absent owner binding and malformed/oversize bodies before mutation", async () => {
  let calls = 0;
  const route = await load("src/app/api/admin/pack-awards/route.ts", {
    "@/server/auth": {
      sameOrigin: (r: Request) =>
        r.headers.get("origin") === "https://fixture.invalid",
    },
    "@/server/owner-pack-awards": {
      OwnerPackAwardAccessError: AccessError,
      ownerPackAward: async () => {
        calls++;
        return {};
      },
    },
  });
  for (const r of [
    request("{}", "https://attacker.invalid"),
    request("{}", undefined, null),
    request("{}", undefined, "not-a-user"),
  ])
    assert.equal((await route.POST(r)).status, 403);
  for (const body of ["{", "x".repeat(8193)])
    assert.equal((await route.POST(request(body))).status, 400);
  assert.equal(calls, 0);
});

test("successful award passes the exact command and expected owner and cannot be publicly cached", async () => {
  const route = await load("src/app/api/admin/pack-awards/route.ts", {
    "@/server/auth": { sameOrigin: () => true },
    "@/server/owner-pack-awards": {
      OwnerPackAwardAccessError: AccessError,
      ownerPackAward: async (input: unknown, expected: string) => {
        assert.equal(JSON.stringify(input), JSON.stringify(command));
        assert.equal(expected, owner);
        return { id: "saved-award", request: command.request, actor: owner };
      },
    },
  });
  const r = await route.POST(request(JSON.stringify(command)));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await r.json()).id, "saved-award");
});

test("unknown database or connection failures preserve pending recovery and hide private error detail", async () => {
  let error: Error = Error("private connection credential or table error");
  const route = await load("src/app/api/admin/pack-awards/route.ts", {
    "@/server/auth": { sameOrigin: () => true },
    "@/server/owner-pack-awards": {
      OwnerPackAwardAccessError: AccessError,
      ownerPackAward: async () => {
        throw error;
      },
    },
  });
  const uncertain = await route.POST(request(JSON.stringify(command)));
  assert.equal(uncertain.status, 503);
  const body = await uncertain.json();
  assert.equal(body.outcome, undefined);
  assert(!JSON.stringify(body).includes("credential"));
  for (const message of [
    "Privileged MFA required",
    "Active Owner MFA required",
    "Current Owner session required",
  ]) {
    error = Error(message);
    const denied = await route.POST(request(JSON.stringify(command)));
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).outcome, undefined);
  }
  error = new AccessError("Wait briefly, then retry the saved award.", 429);
  const limited = await route.POST(request(JSON.stringify(command)));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).outcome, undefined);
});

test("only a definitive ledger decline allows editing a saved award", async () => {
  const route = await load("src/app/api/admin/pack-awards/route.ts", {
    "@/server/auth": { sameOrigin: () => true },
    "@/core/owner-pack-awards": { OwnerPackAwardRejected },
    "@/server/owner-pack-awards": {
      OwnerPackAwardAccessError: AccessError,
      ownerPackAward: async () => {
        throw new OwnerPackAwardRejected(
          "The full selection is unavailable. No packs were issued.",
        );
      },
    },
  });
  const result = await route.POST(request(JSON.stringify(command)));
  assert.equal(result.status, 409);
  assert.equal((await result.json()).outcome, "rejected");
});

test("award history validates bounded pagination and the expected owner", async () => {
  let calls = 0;
  const route = await load("src/app/api/admin/pack-awards/route.ts", {
    "@/server/auth": {},
    "@/server/owner-pack-awards": {
      OwnerPackAwardAccessError: AccessError,
      ownerPackAwardsView: async (offset: number, expected: string) => {
        calls++;
        assert.equal(offset, 50);
        assert.equal(expected, owner);
        return { awards: [], next: null };
      },
    },
  });
  const get = (query: string, bound = true) =>
    new Request(`https://fixture.invalid/api/admin/pack-awards${query}`, {
      headers: bound ? { "x-docked-owner": owner } : {},
    });
  for (const query of [
    "?offset=-1",
    "?offset=100001",
    "?offset=1.5",
    "?member=forged",
  ])
    assert.equal((await route.GET(get(query))).status, 400);
  assert.equal((await route.GET(get("?offset=50", false))).status, 403);
  assert.equal(calls, 0);
  const valid = await route.GET(get("?offset=50"));
  assert.equal(valid.status, 200);
  assert.equal(calls, 1);
  assert.equal(valid.headers.get("cache-control"), "private, no-store");
});

test("actual owner adapter binds verified MFA/session claims to the commercial transaction and rejects stale owner tabs", async () => {
  let roleAllowed = true,
    limited = false,
    preview = false,
    runtimeCalls = 0,
    writes = 0;
  const claims: unknown[][] = [];
  const tx: any = async (
    _parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    claims.push(values);
    return [];
  };
  const env = {
    DOCKED_COMMERCIAL_SERVICE: "true",
    DOCKED_BETA_STAGING: "false",
  };
  const adapter = await load(
    "src/server/owner-pack-awards.ts",
    {
      "server-only": {},
      "./auth": {
        requireRole: async (roles: string[]) => {
          assert.equal(JSON.stringify(roles), '["owner"]');
          if (!roleAllowed) throw Error("Role denied");
          return { user: { id: owner }, sessionId: session, aal: "aal2" };
        },
      },
      "./db": { rateLimit: async () => !limited },
      "@/core/auth-readiness": {
        currentConsentVersions: () => ({
          terms: "approved-terms",
          privacy: "approved-privacy",
        }),
      },
      "@/core/isolated-public-preview.mjs": {
        assertIsolatedPublicPreview: () => preview,
      },
      "./commercial-runtime": {
        commercialRuntime: async () => {
          runtimeCalls++;
          return {
            ledger: {
              awardPacks: async (
                actor: string,
                value: any,
                authorize: (tx: any) => Promise<void>,
                versions: any,
              ) => {
                assert.equal(actor, owner);
                assert.equal(value.member, member);
                assert.equal(versions.terms, "approved-terms");
                await authorize(tx);
                writes++;
                return { request: value.request };
              },
              ownerPackAwards: async (
                _actor: string,
                authorize: (tx: any) => Promise<void>,
              ) => {
                await authorize(tx);
                return { awards: [] };
              },
            },
          };
        },
      },
    },
    env,
  );
  await assert.rejects(
    () => adapter.ownerPackAward(command, member),
    /Owner changed/,
  );
  assert.equal(runtimeCalls, 0);
  await adapter.ownerPackAward(command, owner);
  assert.equal(writes, 1);
  assert.equal(claims[0][0], owner);
  assert.deepEqual(JSON.parse(claims[0][1] as string), {
    sub: owner,
    session_id: session,
    aal: "aal2",
  });
  roleAllowed = false;
  await assert.rejects(
    () => adapter.ownerPackAward(command, owner),
    /Role denied/,
  );
  roleAllowed = true;
  limited = true;
  await assert.rejects(
    () => adapter.ownerPackAward(command, owner),
    /Too many/,
  );
  limited = false;
  preview = true;
  await assert.rejects(
    () => adapter.ownerPackAward(command, owner),
    /read-only/,
  );
  assert.equal(writes, 1);
  await adapter.ownerPackAwardsView(0, owner);
  assert.equal(claims.length, 2);
});

test("owner award adapter cannot activate beta or a disabled commercial service", async () => {
  for (const env of [
    { DOCKED_BETA_STAGING: "true", DOCKED_COMMERCIAL_SERVICE: "true" },
    { DOCKED_BETA_STAGING: "false", DOCKED_COMMERCIAL_SERVICE: "false" },
  ]) {
    const adapter = await load(
      "src/server/owner-pack-awards.ts",
      {
        "server-only": {},
        "./auth": {
          requireRole: async () => ({
            user: { id: owner },
            sessionId: session,
            aal: "aal2",
          }),
        },
        "./db": {
          rateLimit: async () => {
            throw Error("Unexpected admission");
          },
        },
        "./commercial-runtime": {
          commercialRuntime: async () => {
            throw Error("Unexpected ledger");
          },
        },
      },
      env,
    );
    await assert.rejects(
      () => adapter.ownerPackAward(command, owner),
      /unavailable in this environment/,
    );
  }
});
