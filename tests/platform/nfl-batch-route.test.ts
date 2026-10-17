import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../src/app/api/testing/nfl/import/route";
test("batch route is closed on production, missing activation and unbound Preview", async () => {
  const before = {
    env: process.env.VERCEL_ENV,
    flag: process.env.NFL_BATCH_IMPORT_ENABLED,
  };
  try {
    for (const [environment, flag] of [
      ["production", "true"],
      ["preview", "false"],
      ["preview", "true"],
    ]) {
      process.env.VERCEL_ENV = environment;
      process.env.NFL_BATCH_IMPORT_ENABLED = flag;
      const response = await POST(
        new Request("https://docked.com.au/api/testing/nfl/import", {
          method: "POST",
        }),
      );
      assert.notEqual(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  } finally {
    if (before.env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = before.env;
    if (before.flag === undefined) delete process.env.NFL_BATCH_IMPORT_ENABLED;
    else process.env.NFL_BATCH_IMPORT_ENABLED = before.flag;
  }
});
