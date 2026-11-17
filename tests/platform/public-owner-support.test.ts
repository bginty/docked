import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";

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

import { ownerSupportCommand } from "../../src/core/public-owner-support";

test("support command rejects forged identity, unexpected fields and invalid targets", () => {
  const valid = {
    request: "11111111-1111-4111-8111-111111111111",
    target: null,
    action: "emergency_pause",
    reason: "Isolated reviewed emergency",
    expectedDisabledAt: null,
  };
  assert.equal(ownerSupportCommand.parse(valid).action, "emergency_pause");
  for (const bad of [
    { ...valid, actor: "attacker" },
    { ...valid, action: "enable_sales" },
    { ...valid, action: "restore_customer" },
    { ...valid, reason: "short" },
  ])
    assert.throws(() => ownerSupportCommand.parse(bad));
});

test("actual support HTTP endpoint rejects cross-origin, oversize, malformed and unauthenticated actions without disclosure", async () => {
  let calls = 0,
    authorised = false;
  const route = await load("src/app/api/admin/customer-support/route.ts", {
    "@/server/auth": {
      sameOrigin: (r: Request) =>
        r.headers.get("origin") === "https://fixture.invalid",
    },
    "@/server/public-owner-support": {
      publicOwnerSupport: async () => {
        calls++;
        if (!authorised) throw Error("private database detail");
        return { recorded: true };
      },
    },
  });
  const request = (body: string, origin = "https://fixture.invalid") =>
    new Request("https://fixture.invalid/api/admin/customer-support", {
      method: "POST",
      headers: { origin },
      body,
    });
  assert.equal(
    (await route.POST(request("{}", "https://attacker.invalid"))).status,
    403,
  );
  assert.equal(calls, 0);
  assert.equal((await route.POST(request("x".repeat(4097)))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request("{"))).status, 403);
  assert.equal(calls, 0);
  const denied = await route.POST(request("{}"));
  assert.equal(denied.status, 403);
  assert(!(await denied.text()).includes("private database"));
  authorised = true;
  const ok = await route.POST(request("{}"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
});

test("public operations reads public projection without any sandbox wallet read", async () => {
  let role = "owner";
  const queries: string[] = [];
  const tx: any = async (parts: TemplateStringsArray) => {
    const q = parts.join("?");
    queries.push(q);
    if (q.includes("owner_command_centre"))
      return [
        {
          value: { scope: "live", metrics: {}, inventory: [], limitations: [] },
        },
      ];
    return [];
  };
  const route = await load(
    "src/server/owner-operations.ts",
    {
      "server-only": {},
      "./auth": {
        requireRole: async () => {
          if (role !== "owner") throw Error("Role denied");
          return {
            user: { id: "owner-fixture" },
            aal: "aal2",
            sessionId: "own-session",
          };
        },
      },
      "./db": { db: () => ({ begin: (fn: any) => fn(tx) }) },
      "./owner-reference-data": {
        readOwnerReferenceData: () => {
          throw Error("Beta reporting forbidden");
        },
      },
    },
    { DOCKED_BETA_STAGING: "false" },
  );
  const report = await route.ownerOperations({ scope: "live", sport: "nrl" });
  assert.equal(report.data.scope, "live");
  assert(!queries.some((q) => q.includes("credits_sandbox")));
  assert.equal((await route.ownerOperations({ scope: "beta" })).data, null);
  role = "member";
  await assert.rejects(() => route.ownerOperations({}), /Role denied/);
});
