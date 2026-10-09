import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("hosted build refuses platform production, missing scope and local execution before compilation", () => {
  const preview = {
    ...process.env,
    VERCEL: "1",
    VERCEL_ENV: "preview",
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    DOCKED_HOSTED_PREVIEW: "true",
  };
  const run = (env: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, ["scripts/guard-hosted-build.mjs"], {
      env,
      encoding: "utf8",
    }).status;
  assert.equal(run(preview), 0);
  for (const [key, value] of [
    ["VERCEL", ""],
    ["VERCEL_ENV", "production"],
    ["VERCEL_ENV", ""],
    ["APP_ENV", "production"],
    ["SUPABASE_ENV", "production"],
    ["DOCKED_HOSTED_PREVIEW", "false"],
  ])
    assert.notEqual(run({ ...preview, [key]: value }), 0);
});
