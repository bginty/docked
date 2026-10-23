import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";

test("sport state HTTP distinguishes authentication, admission and server failures without exposing internals", async () => {
  const result = await build({
    entryPoints: ["src/app/api/sports-beta/route.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "isolated-services",
        setup(b) {
          b.onResolve({ filter: /^@\/server\// }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });
  let accessError: Error | null = null,
    stateError: Error | null = null;
  let allowed = ["afl", "nrl"];
  const logs: unknown[] = [];
  const nativeRequire = createRequire(import.meta.url);
  const module = { exports: {} as { GET: (r: Request) => Promise<Response> } };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    Error,
    Request,
    Response,
    URL,
    TextDecoder,
    console: { error: (...args: unknown[]) => logs.push(args) },
    require: (id: string) =>
      id === "@/server/sports-private-beta"
        ? {
            sportsBetaCapabilities: async () => {
              if (accessError) throw accessError;
              return allowed;
            },
          }
        : id === "@/server/sport-sandbox"
          ? {
              sportSandbox: async (sport: string) => {
                if (stateError) throw stateError;
                return { state: { sport } };
              },
            }
          : id === "@/server/auth"
            ? { sameOrigin: () => true }
            : id === "@/server/member-release"
              ? { memberPrizes: async () => [] }
              : nativeRequire(id),
  });
  const get = () =>
    module.exports.GET(
      new Request("https://docked.com.au/api/sports-beta?sport=afl&view=state"),
    );
  for (const [message, expected] of [
    ["Authentication required", 401],
    ["Privileged MFA required", 403],
  ] as const) {
    accessError = new Error(message);
    assert.equal((await get()).status, expected);
  }
  accessError = null;
  allowed = [];
  assert.equal((await get()).status, 403);
  allowed = ["afl", "nrl"];
  stateError = Object.assign(
    new Error("Production release channel mismatch: private detail"),
    { code: "P0001" },
  );
  const failed = await get();
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("cache-control"), "private, no-store");
  assert(!JSON.stringify(await failed.json()).includes("private detail"));
  assert.deepEqual(JSON.parse(JSON.stringify(logs)), [
    ["sport_beta_read_failed", { stage: "state", code: "P0001" }],
  ]);
  stateError = null;
  const success = await get();
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { state: { sport: "afl" } });
});
