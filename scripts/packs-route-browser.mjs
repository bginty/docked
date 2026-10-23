// Real Next.js routing and hydration, not a fixture server that accepts all URLs.
// No member credentials: local verifies routing/recovery; --live also verifies
// signed-out auth recovery. Neither claims a signed-in pack purchase.
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const evidence = "docs/qa/packs-route";
const live = process.argv.includes("--live");
const build = (await readdir("tmp"))
  .filter((f) => f.startsWith("packs-route-build-"))
  .sort()
  .at(-1);
assert(build, "Run the clean build first");
const probe = createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
      k,
    ),
  ),
);
Object.assign(env, {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
});
const server = live
  ? null
  : spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: resolve("tmp", build),
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
let log = "";
server?.stdout.on("data", (b) => (log += b));
server?.stderr.on("data", (b) => (log += b));
const browser = await chromium.launch({ headless: true });
const base = live ? "https://docked.com.au" : `http://127.0.0.1:${port}`,
  checks = [];
try {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(base + "/app/login")).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  for (const width of [412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 915 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const sport of ["basketball", "afl", "nrl"]) {
      for (const [suffix, tab] of [
        ["", "buy"],
        ["&tab=mine", "mine"],
        ["&packs=history", "history"],
      ]) {
        await page.goto(`${base}/fantasy/packs?sport=${sport}${suffix}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page).toHaveURL(
          new RegExp(
            `/fantasy/test-wallet\\?view=packs&sport=${sport}${tab === "buy" ? "$" : `&packs=${tab}$`}`,
          ),
        );
        if (live) {
          await expect(
            page.getByRole("link", { name: "Sign in", exact: true }),
          ).toBeVisible({ timeout: 15000 });
          await expect(
            page.getByText("Docked couldn’t load. Please try again.", {
              exact: true,
            }),
          ).toHaveCount(0);
          const next = new URL(
            await page
              .getByRole("link", { name: "Sign in", exact: true })
              .getAttribute("href"),
            base,
          ).searchParams.get("next");
          assert.equal(
            next,
            new URL(page.url()).pathname + new URL(page.url()).search,
          );
        } else {
          // The clean build deliberately has no beta configuration or database.
          await expect(
            page.getByRole("button", { name: "Retry", exact: true }),
          ).toBeVisible({ timeout: 15000 });
        }
        await expect(
          page.getByRole("region", { name: "Loading Docked", exact: true }),
        ).toHaveCount(0);
        checks.push({
          width,
          sport,
          tab,
          redirect: true,
          authRecoveryVisible: live,
          configurationRecoveryVisible: !live,
        });
      }
    }
    await page.goto(`${base}/fantasy/unknown-pack-page`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Nothing published here." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Docked" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Loading Docked", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${evidence}/${live ? "live-" : ""}not-found-${width}.png`,
    });
    assert.deepEqual(errors, []);
    checks.push({ width, notFoundRecovery: true });
    await page.close();
  }
  await mkdir(evidence, { recursive: true });
  await writeFile(
    `${evidence}/${live ? "live-" : ""}routing-browser.json`,
    JSON.stringify(
      {
        passed: true,
        environment: live ? "production-signed-out" : "local-clean-build",
        build,
        authenticatedMemberTest: false,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${checks.length} real Next.js route/terminal-state checks`,
  );
} finally {
  await browser.close();
  server?.kill();
  if (!live) await writeFile(`${evidence}/routing-server.log`, log);
}
