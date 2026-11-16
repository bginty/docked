import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";

async function main() {
  const out = "docs/qa/batch1-pack-phone-20261116/phone-browser";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture("tests/fixtures/phone-recovery.tsx");
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)";/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  let mode = "headers",
    calls = 0;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (path === "/style.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/api/auth/phone") {
      calls++;
      for await (const _ of req) {
        /* Only synthetic inputs; never log them. */
      }
      res.setHeader("Content-Type", "application/json");
      if (mode === "headers") return;
      if (mode === "body") {
        res.writeHead(200);
        res.write('{"ok":');
        return;
      }
      if (mode === "throttle") {
        res.statusCode = 429;
        return res.end(
          JSON.stringify({
            error: "Please wait one minute before requesting another code.",
            retryAfterSeconds: 3,
          }),
        );
      }
      if (mode === "invalid") {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error:
              "The code could not be verified. Check it or request a new code.",
          }),
        );
      }
      if (mode === "outage") {
        res.statusCode = 503;
        return res.end('{"error":"Unavailable"}');
      }
      return res.end(
        JSON.stringify({ ok: true, verified: false, retryAfterSeconds: 60 }),
      );
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    for (const stalled of ["headers", "body"]) {
      mode = stalled;
      await page.goto(origin);
      await page
        .getByLabel("Australian mobile number (04 or +614)")
        .fill("0400000001");
      await page.evaluate(() => {
        const sample = { start: 0, recoveredMs: 0 };
        (window as any).__phoneDeadline = sample;
        document.addEventListener(
          "submit",
          () => {
            sample.start = performance.now();
          },
          true,
        );
        new MutationObserver(() => {
          const button = [...document.querySelectorAll("button")].find(
            (b) => b.textContent?.trim() === "Change number",
          );
          if (sample.start && !sample.recoveredMs && button && !button.disabled)
            sample.recoveredMs = performance.now() - sample.start;
        }).observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      });
      const before = calls,
        start = performance.now();
      await page
        .getByRole("button", { name: "Send code", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Change number", exact: true }),
      ).toBeEnabled({ timeout: 22000 });
      const elapsedMs = Math.round(performance.now() - start);
      const visibleRecoveryMs = await page.evaluate(
        () => (window as any).__phoneDeadline.recoveredMs as number,
      );
      assert(
        visibleRecoveryMs >= 19400 && visibleRecoveryMs < 20000,
        `20s visible UI recovery budget: ${visibleRecoveryMs}`,
      );
      await expect(page.getByRole("alert")).toContainText(
        "couldn't confirm whether",
      );
      await expect(
        page.getByRole("button", { name: "Request another code", exact: true }),
      ).toBeDisabled();
      assert.equal(calls, before + 1);
      await page
        .getByRole("button", { name: "Change number", exact: true })
        .click();
      await expect(
        page.getByLabel("Australian mobile number (04 or +614)"),
      ).toHaveValue("0400000001");
      await expect(
        page.getByLabel("Australian mobile number (04 or +614)"),
      ).toBeEnabled();
      assert.equal(calls, before + 1);
      checks.push({
        stalled,
        elapsedMs,
        visibleRecoveryMs: Math.round(visibleRecoveryMs),
        requests: 1,
        typedNumberPreserved: true,
        automaticResends: 0,
      });
    }
    mode = "throttle";
    await page.goto(origin);
    await page
      .getByLabel("Australian mobile number (04 or +614)")
      .fill("0400000001");
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("one minute");
    await expect(
      page.getByRole("button", { name: "Send code", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Send code", exact: true }),
    ).toBeEnabled({ timeout: 5000 });
    checks.push({ serverCountdown: "honoured", automaticResends: 0 });
    mode = "sent";
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await page.getByLabel("Verification code").fill("123456");
    mode = "invalid";
    await page
      .getByRole("button", { name: "Verify phone", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "could not be verified",
    );
    await expect(page.getByLabel("Verification code")).toHaveValue("123456");
    mode = "outage";
    const before = calls;
    await page
      .getByRole("button", { name: "Verify phone", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry verification", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("Verification code")).toHaveValue("123456");
    assert.equal(calls, before + 1);
    checks.push({
      wrongCodeAndProviderOutage: "recoverable",
      typedCodePreserved: true,
      automaticRetries: 0,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: `${out}/recovery-390.png`, fullPage: true });
    writeFileSync(
      `${out}/acceptance.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scope:
            "Isolated browser simulation; no Auth, Twilio, hosted or physical-device acceptance",
          checks,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: checks.length, checks }));
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
