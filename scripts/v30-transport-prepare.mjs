import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const dir = "private-data/restored-public-preview";
const target = "C:/Users/61412/.codex/worktrees/v30-transport/Docked.com.au";
const state = JSON.parse(
  await fs.readFile(`${dir}/billing.private.json`, "utf8"),
);
const deployment = JSON.parse(
  await fs.readFile(`${dir}/deployment.json`, "utf8"),
);
assert.equal(state.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(deployment.commit, "57ec798bb094228ec5aa056dc4d6a3a0c5c2e66f");
assert.equal(
  state.closed,
  false,
  "Closed acceptance must not be silently reactivated",
);
const text = await fs.readFile(`${dir}/oidc.private.env`, "utf8");
const oidc = text.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(oidc);
const expiry =
  JSON.parse(Buffer.from(oidc.split(".")[1], "base64url")).exp * 1000;
const until = Math.min(Date.parse(state.until), expiry - 60000);
assert(until > Date.now() + 3600000);
const out = target + "/private-data/v30-transport";
await fs.mkdir(out, { recursive: true });
const env = {
  DOCKED_V30_TRANSPORT: "true",
  DOCKED_V30_TRANSPORT_UNTIL: new Date(until).toISOString(),
  DOCKED_V30_TRANSPORT_KEY: randomBytes(32).toString("hex"),
  DOCKED_V30_TRANSPORT_TARGET: deployment.url,
  DOCKED_V30_TRANSPORT_OIDC: oidc,
};
if (process.argv[2] === "refresh") {
  const previous = JSON.parse(
    await fs.readFile(out + "/env.private.json", "utf8"),
  );
  assert(
    [
      "https://docked-preview-r7pprjg0w-briant-s-projects.vercel.app",
      "https://docked-preview-fzxgv1xhq-briant-s-projects.vercel.app",
    ].includes(previous.DOCKED_V30_TRANSPORT_TARGET),
  );
  env.DOCKED_V30_TRANSPORT_KEY = previous.DOCKED_V30_TRANSPORT_KEY;
  await fs.writeFile(out + "/env.private.json", JSON.stringify(env), {
    mode: 0o600,
  });
} else
  await fs.writeFile(out + "/env.private.json", JSON.stringify(env), {
    mode: 0o600,
    flag: "wx",
  });
await fs.mkdir(target + "/docs/qa/v30-transport-release", { recursive: true });
await fs.copyFile(
  "docs/qa/real-rosters/release/commerce-apply.json",
  target + "/docs/qa/v30-transport-release/commerce-apply.json",
);
console.log(
  JSON.stringify({
    target: deployment.url,
    until: env.DOCKED_V30_TRANSPORT_UNTIL,
    secrets: "private files only",
  }),
);
