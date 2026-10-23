import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";

test("weekly pack HTTP distinguishes signed-out, MFA and temporary errors without leaking details", async () => {
  const result = await build({
    entryPoints: ["src/app/api/weekly-core/route.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "isolated-auth-service",
        setup(b) {
          b.onResolve(
            { filter: /^@\/server\/(auth|weekly-core)$/ },
            (args) => ({ path: args.path, external: true }),
          );
        },
      },
    ],
  });
  let failure: Error | null = null;
  let calls = 0;
  const nativeRequire = createRequire(import.meta.url);
  const module = {
    exports: {} as {
      GET: (r: Request) => Promise<Response>;
      POST: (r: Request) => Promise<Response>;
    },
  };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    Error,
    Request,
    Response,
    TextDecoder,
    URL,
    require: (id: string) =>
      id === "@/server/auth"
        ? { sameOrigin: () => true }
        : id === "@/server/weekly-core"
          ? {
              weeklyCore: async () => {
                calls++;
                if (failure) throw failure;
                return { state: { enabled: true, packs: [] }, receipt: null };
              },
            }
          : nativeRequire(id),
  });
  for (const [message, getStatus, postStatus] of [
    ["Authentication required", 401, 401],
    ["Privileged MFA required", 403, 403],
    ["private database connection detail", 503, 400],
  ] as const) {
    failure = new Error(message);
    const get = await module.exports.GET(
      new Request("https://docked.com.au/api/weekly-core?sport=afl"),
    );
    const post = await module.exports.POST(
      new Request("https://docked.com.au/api/weekly-core?sport=afl", {
        method: "POST",
        body: JSON.stringify({ sport: "afl" }),
      }),
    );
    assert.equal(get.status, getStatus);
    assert.equal(post.status, postStatus);
    assert.equal(get.headers.get("cache-control"), "private, no-store");
    assert(!JSON.stringify(await get.json()).includes("private database"));
    assert(!JSON.stringify(await post.json()).includes("private database"));
  }
  failure = null;
  assert.equal(
    (
      await module.exports.GET(
        new Request("https://docked.com.au/api/weekly-core?sport=nrl"),
      )
    ).status,
    200,
  );
  assert.equal(calls, 7);
});
