import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import type { Operations } from "../src/core/owner-operations";
async function main() {
  const out = `docs/qa/prelaunch-owner/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/owner-command-centre.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.*?\.css)"/g,
    ),
  ]
    .map((m) => readFileSync("src/app/" + m[1], "utf8"))
    .join("\n");
  const data: Operations = {
    scope: "beta",
    generatedAt: "2026-10-16T12:00:00Z",
    metrics: { admitted: 3, newRegistrations: 2 },
    competitions: [
      {
        id: "synthetic-round",
        name: "Traditional · 2026 · Week 6",
        sport: "nfl",
        round: 6,
        locks_at: "2026-10-17T00:00:00Z",
        scored_at: null,
        rules_version: "fixture",
        entries: 3,
        scored_entries: 0,
        rankings: [],
      },
    ],
    inventory: [],
    reports: [
      {
        id: "synthetic-report",
        created_at: "2026-10-16T10:00:00Z",
        status: "open",
      },
    ],
    emailFailures: 0,
    limitations: [
      "Isolated synthetic fixture; not production business metrics.",
    ],
    wallet: {
      issued: 75000,
      extinguished: 5400,
      outstanding: 69600,
      difference: 0,
      reserved: 2000,
      pending: 0,
      spendable: 67600,
      categories: { purchased: 0, promotional: 69600, sale: 0, competition: 0 },
      packSpend: 5400,
      fees: 0,
      marketplaceVolume: 0,
      unbalancedTransactions: 0,
      listings: 2,
      pendingOffers: 1,
      actualCashReceipts: null,
    },
    centre: {
      activeMembers: 3,
      packsOpened: 6,
      entriesUpdated: 3,
      posts: 4,
      pendingInvitations: 1,
      suspendedMembers: 0,
      daily: Array.from({ length: 16 }, (_, i) => ({
        day: `2026-10-${String(i + 1).padStart(2, "0")}`,
        entries: i % 4 === 0 ? 1 : 0,
        packs: i % 3 === 0 ? 1 : 0,
        posts: i % 5 === 0 ? 1 : 0,
      })),
      packFailures: [
        {
          id: "synthetic-failure",
          category: "SUPPLY",
          recorded_at: "2026-10-16T11:00:00Z",
        },
      ],
      feedJobs: [
        {
          id: "synthetic-job",
          provider: "Synthetic NFL adapter",
          state: "blocked",
          attempts: 2,
          error_code: "MAPPING_REQUIRED",
          last_success: null,
          available_at: "2026-10-16T09:00:00Z",
          lease_until: null,
        },
      ],
      workerRuns: [],
      lastRosterSync: "2026-10-16T07:00:00Z",
      weeklyEnabled: false,
      inventorySummary: [
        "CORE",
        "RARE",
        "ELITE",
        "ULTRA_RARE",
        "LEGENDARY",
        "ICON",
      ].map((tier, i) => ({ tier, issued: 12 - i, cap: 100 })),
      limitations: ["Fixture totals illustrate the layout only."],
    },
  };
  const publicRoot = resolve("public");
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    if (path === "/fixture-state") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    } else if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(script);
    } else if (path === "/style.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else if (path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "Isolated owner fixture" }));
    } else {
      const file = resolve(publicRoot, "." + path);
      if (
        file.startsWith(publicRoot + sep) &&
        existsSync(file) &&
        !path.endsWith("/")
      ) {
        res.setHeader(
          "Content-Type",
          path.endsWith(".svg")
            ? "image/svg+xml"
            : path.endsWith(".png")
              ? "image/png"
              : path.endsWith(".woff2")
                ? "font/woff2"
                : "application/octet-stream",
        );
        res.end(readFileSync(file));
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked owner review</title><link rel="stylesheet" href="/style.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
        );
      }
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const checks = [];
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(base + "/admin/operations");
      await expect(
        page.getByRole("heading", { name: "Needs attention" }),
      ).toBeVisible();
      await expect(page.getByText("69,600", { exact: true })).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow at ${width}`,
      );
      await page.screenshot({
        path: `${out}/owner-${width}.png`,
        fullPage: true,
      });
      await page
        .locator("summary")
        .filter({ hasText: "Daily activity table" })
        .click();
      await expect(
        page.getByRole("region", { name: "Daily activity" }),
      ).toBeVisible();
      const axe = await new AxeBuilder({ page }).analyze();
      const critical = axe.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );
      writeFileSync(
        `${out}/axe-${width}.json`,
        JSON.stringify(axe.violations, null, 2),
      );
      assert.deepEqual(
        critical.map((x) => x.id),
        [],
      );
      await page.getByRole("link", { name: "Economy", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Test economy", exact: true }),
      ).toBeInViewport();
      checks.push({ width, overflow: false, criticalOrSeriousAxe: 0 });
      await context.close();
    }
    writeFileSync(
      `${out}/acceptance.json`,
      JSON.stringify(
        {
          passed: true,
          scope:
            "Actual owner component, synthetic local aggregate fixture; not owner MFA or hosted acceptance",
          checks,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, out, checks }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
