import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const js = await bundleCommunityFixture("tests/fixtures/ingestion-ui.tsx");
  const css = ["brand-theme", "globals", "redemption", "owner-reference"]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const data = readFileSync("tmp/ingestion-browser-fixture.json");
  const server = createServer((req, res) => {
    const u = new URL(req.url!, "http://localhost");
    if (u.pathname.startsWith("/brand/")) {
      const root = resolve("public"),
        file = resolve(root, "." + u.pathname);
      if (!file.startsWith(root + sep)) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
      );
      res.end(readFileSync(file));
      return;
    }
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(js);
      return;
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
      return;
    }
    if (u.pathname === "/fixture-data") {
      res.setHeader("Content-Type", "application/json");
      res.end(data);
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingestion acceptance</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch(),
    port = (server.address() as { port: number }).port,
    out = "docs/qa/multi-sport/integration";
  mkdirSync(out, { recursive: true });
  const checks = [];
  try {
    for (const width of [360, 412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(
        page.getByRole("heading", {
          name: "Statistics ingestion",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "EPL", exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${out}/ingestion-${width}.png`,
        fullPage: true,
      });
      await page
        .getByText("Historical coverage and reconciliation", { exact: true })
        .click();
      await expect(
        page.getByText("Recent source corrections (8)", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Diagnostics unavailable. Retry status to reconnect."),
      ).toHaveCount(0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${out}/diagnostics-${width}.png`,
        fullPage: true,
      });
      await page
        .getByText("Recent source corrections (8)", { exact: true })
        .click();
      await expect(
        page.getByText("Source revisions require Docked reconciliation.", {
          exact: false,
        }),
      ).toBeVisible();
      await page
        .getByText("Recent operational audit", { exact: false })
        .click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .getByText("Scheduled jobs and failures", { exact: true })
        .click();
      const retry = page
        .getByRole("button", { name: "Retry job", exact: true })
        .first();
      if (await retry.count()) {
        await retry.click();
        await expect(
          page.getByText("Isolated retry submitted", { exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("textbox", { name: "Retry reason" })
          .first()
          .fill("Isolated browser acceptance");
        await retry.click();
        await expect(
          page.getByText("Isolated retry submitted", { exact: true }),
        ).toBeVisible();
      }
      for (const state of ["disabled", "unavailable"]) {
        await page.goto(`http://127.0.0.1:${port}?state=${state}`);
        await expect(
          page.getByRole("heading", {
            name: "Statistics ingestion",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText(
            state === "disabled"
              ? "Service connection is not configured. No new sport is activated."
              : "Service status is unavailable.",
            { exact: false },
          ),
        ).toBeVisible();
      }
      assert.deepEqual(errors, []);
      checks.push({
        width,
        overflow: false,
        errors,
        states: ["connected", "disabled", "unavailable"],
        isolated: true,
      });
      await page.close();
    }
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          checks,
          hosted: false,
          source:
            "Actual isolated Python API response; shared production components",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(checks));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
