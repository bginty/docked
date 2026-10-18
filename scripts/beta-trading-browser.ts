// Component-only, loopback synthetic data. Does not claim application Auth/DB acceptance.
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { resolve, sep, extname } from "node:path";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { ownerWalletSummary } from "../src/core/owner-wallet-summary";
import { initialMemberTestCredits } from "../src/core/member-test-wallet";
async function main() {
  const evidence = "docs/qa/beta-trading/browser";
  mkdirSync(evidence, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/beta-trading.tsx",
  );
  const css =
    [
      ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
        /import "\.\/(.+\.css)"/g,
      ),
    ]
      .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
      .join("\n") + readFileSync("src/app/owner-marketplace.css", "utf8");
  const report = {
    control: {
      policy: "private-beta-trading-v1",
      approval_reference: "LOCAL QA ONLY",
      approved_at: "2026-10-18T00:00:00Z",
      paused: false,
      sale: true,
      swap: true,
      combined: true,
      revision: 1,
    },
    members: [{ id: "local", label: "Local QA member", enabled: true }],
    audit: [],
    deploymentEnabled: true,
    wallet: ownerWalletSummary(initialMemberTestCredits()),
    listings: [],
    history: [],
    pendingOffers: [],
    transfers: [],
  };
  let changes = 0;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/brand/") || req.url?.startsWith("/fonts/")) {
      const file = resolve("public", "." + decodeURIComponent(req.url));
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          (
            {
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".svg": "image/svg+xml",
              ".webp": "image/webp",
              ".woff2": "font/woff2",
            } as Record<string, string>
          )[extname(file)] ?? "application/octet-stream",
        );
        res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        res.end();
      }
      return;
    }
    if (req.url === "/local-report") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(report));
      return;
    }
    if (req.url === "/api/admin/marketplace" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const command = JSON.parse(body);
      assert.equal(command.action, "pause");
      assert.equal(command.paused, true);
      changes++;
      report.control.paused = true;
      report.control.revision++;
      res.setHeader("Content-Type", "application/json");
      if (changes === 2) {
        res.statusCode = 202;
        res.end(
          JSON.stringify({
            applied: true,
            error:
              "Change recorded. The ledger report is unavailable; refresh before resuming trading.",
          }),
        );
        return;
      }
      res.end(JSON.stringify(report));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>LOCAL marketplace controls</title><style>${css}</style></head><body><div id="fixture-root"></div><script>${script}</script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [360, 412, 1440]) {
      await page.setViewportSize({ width, height: 915 });
      await page.goto(`http://127.0.0.1:${address.port}`);
      await expect(
        page.getByRole("heading", { name: "Private beta marketplace" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Emergency pause" }),
      ).toBeDisabled();
      if (width < 1000)
        await page
          .getByRole("button", { name: "Open administration navigation" })
          .click();
      await expect(
        page.getByRole("link", { name: "Marketplace", exact: true }),
      ).toHaveAttribute("href", "/admin/marketplace");
      if (width < 1000) await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow at ${width}`,
      );
      await page.screenshot({
        path: `${evidence}/owner-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("textbox", { name: "Reason or case reference" })
      .fill("LOCAL QA pause");
    await page.getByRole("button", { name: "Emergency pause" }).click();
    await expect(
      page.getByText(
        "Trading paused · Funding and cash redemption remain disabled.",
      ),
    ).toBeVisible();
    assert.equal(changes, 1);
    await page
      .getByRole("textbox", { name: "Reason or case reference" })
      .fill("LOCAL report outage");
    await page.getByRole("button", { name: "Emergency pause" }).click();
    await expect(
      page.getByText(
        "Change recorded. The ledger report is unavailable; refresh before resuming trading.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Trading paused · Funding and cash redemption remain disabled.",
      ),
    ).toBeVisible();
    assert.equal(changes, 2);
    assert.deepEqual(errors, []);
    writeFileSync(
      `${evidence}/result.json`,
      JSON.stringify(
        {
          passed: true,
          widths: [360, 412, 1440],
          scope:
            "Local real React component with mock HTTP report only; not Auth/DB/hosted acceptance or physical Samsung",
          checks: [
            "Owner navigation",
            "Pause requires reason",
            "One pause submission",
            "Status refresh",
            "No page overflow",
            "No console errors",
          ],
        },
        null,
        2,
      ),
    );
    console.log("PASS: owner controls component at 360/412/1440px");
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
