import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { fixturePackage } from "../tests/fixtures/readiness-package";
import { digest } from "../src/core/scoring-engine";
import { resolve, sep } from "node:path";
import type { SportReadinessReport } from "../src/core/sport-readiness-report";
async function main() {
  const p = fixturePackage();
  // Evidence current for this isolated browser run, not an owner approval.
  p.evidence.forEach((e) => {
    e.verifiedAt = new Date(Date.now() - 60000).toISOString();
    e.expiresAt = new Date(Date.now() + 3600000).toISOString();
  });
  const report: SportReadinessReport = {
    generatedAt: new Date().toISOString(),
    catalogue: [],
    rosters: [],
    issues: [],
    jobs: [],
    issueLimit: 100,
    activatedByThisSystem: false,
    packages: [{ hash: digest(p), body: p, decision: null }],
  };
  const js = await bundleCommunityFixture(
    "tests/fixtures/sport-readiness-ui.tsx",
  );
  const css = ["brand-theme", "globals", "redemption", "owner-reference"]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let posts = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname.startsWith("/brand/")) {
      const root = resolve("public"),
        file = resolve(root, "." + url.pathname);
      if (!file.startsWith(root + sep)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
      );
      res.end(readFileSync(file));
      return;
    }
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(js);
      return;
    }
    if (url.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
      return;
    }
    if (url.pathname === "/api/admin/sports-readiness") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const d = JSON.parse(raw);
        assert.equal(d.packageHash, digest(p));
        assert(d.reason.length >= 10);
        posts++;
        report.packages[0].decision = {
          packageHash: d.packageHash,
          action: d.action,
          at: new Date().toISOString(),
        };
      }
      res.end(JSON.stringify(report));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch(),
    port = (server.address() as { port: number }).port,
    out = "docs/qa/multi-sport/activation";
  mkdirSync(out, { recursive: true });
  const checks = [];
  try {
    for (const width of [360, 412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(
        page.getByText("Release packages", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Approve release package",
          exact: true,
        }),
      ).toBeDisabled();
      await page
        .getByLabel("Decision reason")
        .fill("Isolated UI acceptance only");
      await page
        .getByRole("button", { name: "Approve release package", exact: true })
        .click();
      await expect(
        page.getByText("Approved package; deployment still required", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Decision reason")
        .fill("Suspend isolated UI acceptance");
      await page
        .getByRole("button", { name: "Suspend approval", exact: true })
        .click();
      await expect(
        page.getByText("Not ready for release", { exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await page
        .getByRole("heading", { name: "Multi-sport operations", exact: true })
        .click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/owner-${width}.png`,
        fullPage: true,
      });
      checks.push({ width, overflow: false, errors, approveAndSuspend: true });
      await page.close();
    }
    assert.equal(posts, 6);
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify({ isolated: true, checks, posts }, null, 2),
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
