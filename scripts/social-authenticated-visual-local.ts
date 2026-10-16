// Continue visual acceptance against an already running disposable local stack.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium, request, type APIRequestContext } from "@playwright/test";
import { captureSocialUpgrade } from "./social-upgrade-browser";

async function main() {
  const origin = "http://127.0.0.1:3033";
  const local = JSON.parse(
    await readFile("tmp/marketplace-auth/status.private.json", "utf8"),
  );
  assert.equal(local.API_URL, "http://127.0.0.1:55321");
  assert.equal(new URL(local.DB_URL).hostname, "127.0.0.1");
  const qa = JSON.parse(
    await readFile("tmp/marketplace-auth/fixtures.private.json", "utf8"),
  );
  assert.ok(qa.users[1].email.endsWith("@example.invalid"));
  const root = resolve(
    process.argv[2] ?? `docs/qa/auth-recovery-20261017/visual-${Date.now()}`,
  );
  assert.ok(root.startsWith(resolve("docs/qa") + sep));
  await mkdir(root, { recursive: true });
  const session = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
    timeout: 120000,
  });
  const browser = await chromium.launch({ channel: "msedge" });
  let checks: string[] = [],
    error: string | undefined;
  try {
    const login = await session.post("/api/auth", {
      data: {
        action: "login",
        email: qa.users[1].email,
        password: qa.password,
        app: true,
      },
    });
    assert.equal(login.status(), 200);
    const sessions: APIRequestContext[] = [];
    sessions[1] = session;
    checks = await captureSocialUpgrade(browser, sessions, origin, root, true);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await session.dispose();
    const receipt = {
      at: new Date().toISOString(),
      passed: !error,
      checks,
      error,
      hosted: false,
      physicalDevice: false,
    };
    await writeFile(`${root}/receipt.json`, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Local visual acceptance failed",
  );
  process.exitCode = 1;
});
