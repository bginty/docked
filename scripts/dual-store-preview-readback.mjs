/** Targeted public-native capability acceptance. Existing isolated account only;
 * no signup, team, wallet, pack, payment, deletion or Production mutations. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const dir = "private-data/restored-public-preview",
  out = "docs/qa/dual-store-20261105";
const fixture = JSON.parse(
  await fs.readFile(`${dir}/fixture.private.json`, "utf8"),
);
assert.equal(fixture.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(
  fixture.origin,
  "https://docked-preview-s24-briant-ginty.vercel.app",
);
const account = fixture.accounts.find((a) => a.kind === "member");
assert.match(
  account?.email ?? "",
  /^docked-preview-public-member-[a-f0-9]+@example\.invalid$/,
);
const variables = await fs.readFile(`${dir}/oidc.private.env`, "utf8");
const oidc = variables.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(oidc);
const report = {
  at: new Date().toISOString(),
  origin: fixture.origin,
  realAuthenticatedBrowser: false,
  syntheticAccount: true,
  providerCheckoutPerformed: false,
  productionWrites: 0,
  checks: [],
  timings: [],
  passed: false,
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
await context.route("**/*", (route) => {
  const headers = { ...route.request().headers() };
  delete headers["x-vercel-trusted-oidc-idp-token"];
  if (new URL(route.request().url()).origin === fixture.origin)
    headers["x-vercel-trusted-oidc-idp-token"] = oidc;
  return route.continue({ headers });
});
const page = await context.newPage();
const api = (path) =>
  page.evaluate(async (value) => {
    const r = await fetch(value, { cache: "no-store" });
    return { status: r.status, body: await r.json() };
  }, path);
try {
  await page.goto(fixture.origin + "/app/login");
  await page.locator("form[data-api-ready=true]").waitFor({ timeout: 45000 });
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  const loginResponse = page.waitForResponse(
    (r) =>
      r.url() === fixture.origin + "/api/auth" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  assert.equal(
    (await loginResponse).status(),
    200,
    "Normal isolated sign-in failed",
  );
  await page.waitForURL(
    (u) => u.origin === fixture.origin && u.pathname !== "/app/login",
    { timeout: 45000 },
  );
  const capabilities = await api("/api/mobile/capabilities");
  assert.equal(capabilities.status, 200);
  assert.deepEqual(capabilities.body.sports, ["nfl", "afl", "nrl"]);
  assert.equal(capabilities.body.billing.enabled, false);
  assert.deepEqual(capabilities.body.billing.products, []);
  const gameplay = await api("/api/public-gameplay");
  assert.equal(gameplay.status, 200);
  assert.deepEqual(gameplay.body.allowed, capabilities.body.sports);
  report.realAuthenticatedBrowser = true;
  report.checks.push(
    "Normal isolated-member login; native and web public sports agree; no private-beta admission; billing unavailable",
  );
  const wallet = await api("/api/workspace-wallet");
  assert.equal(wallet.status, 200);
  const fingerprint = (v) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const before = fingerprint(wallet.body.state.wallet);
  for (const sport of ["nfl", "afl", "nrl"]) {
    const started = Date.now();
    await page.goto(
      `${fixture.origin}/fantasy/play?sport=${sport}&mode=SALARY_CAP`,
    );
    await page
      .getByRole("heading", { name: "Your lineup", exact: true })
      .waitFor({ timeout: 45000 });
    assert(
      !/Docked couldn.t load/.test(await page.locator("body").innerText()),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const state = await api(`/api/public-gameplay?sport=${sport}`);
    assert.equal(state.status, 200);
    assert(state.body.state.cards.length > 0);
    report.timings.push({
      sport,
      readAndRenderMs: Date.now() - started,
      connection: "Desktop automated browser; no mobile throttle",
    });
    report.checks.push(
      `${sport}: existing public Play renders with eligible cards, no page overflow at 390px`,
    );
    await page.screenshot({ path: `${out}/preview-${sport}-390.png` });
    if (sport === "nrl") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: `${out}/preview-nrl-1440.png` });
    }
  }
  assert.equal(
    (await api("/api/public-gameplay?sport=basketball")).status,
    403,
  );
  assert.equal(
    fingerprint((await api("/api/workspace-wallet")).body.state.wallet),
    before,
  );
  report.checks.push(
    "NBA denied server-side; isolated wallet unchanged across read-only navigation",
  );
  report.passed = true;
} catch (error) {
  report.failure =
    error instanceof assert.AssertionError
      ? error.message.slice(0, 180)
      : "Hosted browser step failed; inspect private diagnostic";
  await fs.writeFile(
    `${dir}/dual-store-browser-error.private.txt`,
    String(error),
    { mode: 0o600 },
  );
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    `${out}/preview-browser.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report));
