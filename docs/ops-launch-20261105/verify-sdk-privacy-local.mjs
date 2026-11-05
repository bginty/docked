import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";

const out = "docs/ops-launch-20261105";
const origin = "http://127.0.0.1:3496";
const source = await fs.readFile("config/launch-policy-content.json", "utf8");
const proposed = await fs.readFile(
  `${out}/launch-policy-content.sdk-clarification.proposed.json`,
  "utf8",
);
const sha = (s) =>
  crypto.createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
assert.equal(sha(source), sha(proposed));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
const errors = [];
const requests = [];
try {
  // These policy routes are server-rendered read-only documents. Check their
  // actual HTTP/HTML/CSS output without the webpack development eval runtime,
  // which the unchanged production CSP intentionally forbids.
  const page = await browser.newPage({ javaScriptEnabled: false });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method()))
      requests.push({ method: r.method(), url: new URL(r.url()).pathname });
  });
  for (const { id, width } of [
    { id: "privacy", width: 320 },
    { id: "privacy", width: 390 },
    { id: "privacy", width: 1440 },
    { id: "commercial-policy", width: 390 },
    { id: "refund-policy", width: 390 },
    { id: "retention", width: 390 },
  ]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    const response = await page.goto(`${origin}/${id}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    assert.equal(response.status(), 200);
    const article = page.locator("article[aria-labelledby='policy-title']");
    const text = await article.innerText();
    const expectedVersion =
      id === "privacy"
        ? "2026-11-06-privacy-sdk-v3"
        : "2026-11-02-release-preparation-v2";
    assert.ok(text.includes(`Version ${expectedVersion}`));
    if (id === "privacy") {
      assert.ok(text.includes("Published 6 November 2026"));
      assert.ok(
        text.includes(
          "This automatic SDK processing can occur without a completed purchase.",
        ),
      );
      assert.ok(text.includes("not disabled by that analytics preference"));
    } else assert.ok(!text.includes("2026-11-06-privacy-sdk-v3"));
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(geometry.scrollWidth <= geometry.width);
    const screenshot = `${out}/local-${id}-${width}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    checks.push({
      route: `/${id}`,
      status: response.status(),
      width,
      expectedVersion,
      ...geometry,
      screenshot,
      mutationRequests: requests.length,
    });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const report = {
    checkedAt: new Date().toISOString(),
    environment: "local source only; not deployed",
    authenticated: false,
    scope:
      "actual local read-only server-rendered policy routes; client hydration and unrelated app flows not claimed",
    mutationRequests: requests,
    pageErrors: errors,
    sourcePacketSha256: sha(source),
    checks,
  };
  await fs.writeFile(
    `${out}/sdk-privacy-local-rendered.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
