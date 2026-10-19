import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out = `docs/qa/premium-member-release/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "tests/fixtures/premium-member-release.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "sports-visuals",
    "sports-experience",
    "community-app",
    "native",
    "mobile-app",
    "app-auth",
    "beta-experience",
    "fantasy",
    "fantasy-play",
    "pack-opening",
    "scoring",
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "standings",
    "pack-shop",
    "card-viewer",
    "prizes",
    "startup-loading",
  ]
    .map((f) => readFileSync(`src/app/${f}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://local");
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (url.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (url.pathname.startsWith("/brand/")) {
      const path = resolve("public", "." + url.pathname);
      if (!path.startsWith(resolve("public") + sep)) {
        res.statusCode = 403;
        return res.end();
      }
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith(".webp") ? "image/webp" : "image/png",
        );
        return res.end(readFileSync(path));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (url.pathname.startsWith("/api/")) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: "Isolated visual fixture: wallet unavailable",
        }),
      );
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated Docked release QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><main id="fixture-root"></main><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    for (const [width, height] of [
      [1536, 1024],
      [1440, 900],
      [1024, 900],
      [412, 915],
      [360, 740],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/fantasy/prizes?sport=nfl");
      await expect(
        page.getByRole("heading", { name: "Prizes to be announced" }),
      ).toBeVisible();
      await expect(page.locator(".prize-medal")).toHaveCount(0);
      await page.screenshot({
        path: `${out}/prizes-empty-${width}.png`,
        fullPage: true,
      });
      for (const mode of ["All-Star", "Traditional"])
        for (const period of ["Season", "Weekly"]) {
          await page.getByRole("button", { name: new RegExp(mode) }).click();
          await page.getByRole("button", { name: period, exact: true }).click();
          await expect(page.locator(".prizes-period")).toContainText(mode);
          await expect(page.getByLabel("Week", { exact: true })).toHaveCount(
            period === "Season" ? 0 : 1,
          );
        }
      await page.getByLabel("Season", { exact: true }).selectOption("2025");
      await expect(page.locator(".prizes-period")).toContainText("2025");
      const link = await page
        .getByRole("link", { name: "View Rankings ↗" })
        .first()
        .getAttribute("href");
      assert.match(link!, /season=2025/);
      assert.match(link!, /sport=nfl/);
      await page.goBack();
      await expect(page.locator(".prizes-period")).toContainText("2026");
      await page.goForward();
      await expect(page.locator(".prizes-period")).toContainText("2025");
      await page.goto(origin + "/fantasy/prizes?sport=nfl&fixture=published");
      await expect(page.locator(".prize-medal")).toHaveCount(3);
      await expect(page.getByRole("columnheader")).toHaveText([
        "Finish",
        "Reward",
      ]);
      await expect(
        page.locator(".prizes-page table tbody tr").first(),
      ).toContainText("5 × Standard 9 Pack NFL");
      await page.getByRole("button", { name: /All-Star/ }).click();
      await expect(
        page.locator(".prizes-page table tbody tr").first(),
      ).toContainText("5 × Premium 9 Pack NFL");
      await page.getByRole("button", { name: /Traditional/ }).click();
      await page.screenshot({
        path: `${out}/prizes-published-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const axe = (
        await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
      ).violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );
      writeFileSync(`${out}/axe-${width}.json`, JSON.stringify(axe, null, 2));
      assert.equal(axe.length, 0, "prize accessibility");
      await page.goto(origin + "/fantasy/social?fixture=announcement");
      await expect(
        page.getByRole("article", { name: "Official Docked announcement" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "View prizes →" }),
      ).toHaveAttribute("href", "/fantasy/prizes");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${out}/announcements-${width}.png`,
        fullPage: true,
      });
      await page.goto(origin + "/fantasy/play?fixture=loader");
      await expect(page.getByText("Getting Docked ready…")).toBeVisible();
      await page.screenshot({ path: `${out}/loader-${width}.png` });
      assert.equal(
        await page
          .locator(".loading-reflection")
          .evaluate((n) => getComputedStyle(n).display),
        "none",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      );
      await page.goto(origin + "/fantasy/play?fixture=startup");
      await expect(page.locator(".light-sweep")).toBeVisible();
      await page.evaluate(() => (window as any).fixtureReady());
      await expect(page.locator(".light-sweep")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Ready fixture" }),
      ).toBeVisible();
      await page.goto(origin + "/fantasy/play?fixture=failure");
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Sign in", exact: true }),
      ).toHaveCount(0);
      assert.equal(
        await page
          .locator(".loading-reflection")
          .evaluate((n) => getComputedStyle(n).display),
        "none",
      );
      assert.deepEqual(errors, []);
      checks.push({
        width,
        height,
        selectors: true,
        backForward: true,
        reducedMotion: true,
        startupReady: true,
        errorState: true,
        axeSerious: 0,
      });
      await context.close();
    }
    const recovery = await browser.newContext({
      viewport: { width: 360, height: 600 },
      reducedMotion: "reduce",
    });
    const recoveryPage = await recovery.newPage();
    await recoveryPage.clock.install();
    await recoveryPage.goto(origin + "/fantasy/play?fixture=startup");
    await recoveryPage.clock.fastForward(13000);
    await expect(
      recoveryPage.getByText("Taking longer than usual…"),
    ).toBeVisible();
    await recoveryPage.clock.fastForward(33000);
    await expect(
      recoveryPage.getByRole("button", { name: "Retry" }),
    ).toBeVisible();
    await recoveryPage.evaluate(() => (window as any).fixtureReady());
    await expect(recoveryPage.locator(".light-sweep")).toHaveCount(0);
    await recoveryPage.goto(origin + "/fantasy/play?fixture=failure&auth");
    await expect(
      recoveryPage.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await recoveryPage.getByRole("button", { name: "Retry" }).click();
    await expect(
      recoveryPage.getByRole("heading", { name: "Retry succeeded" }),
    ).toBeVisible();
    await recovery.close();
    const admin = await browser.newContext({
      viewport: { width: 412, height: 915 },
    });
    const adminPage = await admin.newPage();
    const commands: any[] = [];
    await adminPage.route("**/api/admin/member-release", async (route) => {
      commands.push(route.request().postDataJSON());
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Isolated save failure: no hosted mutation",
        }),
      });
    });
    await adminPage.goto(origin + "/admin/member-release?fixture=admin");
    await adminPage
      .getByLabel("Reward", { exact: true })
      .fill("Local review reward");
    await adminPage
      .getByLabel("Reason", { exact: true })
      .first()
      .fill("Local browser acceptance");
    await adminPage.getByLabel("Publish for members").check();
    await expect(
      adminPage.getByRole("button", { name: "Publish schedule" }),
    ).toBeDisabled();
    await adminPage
      .getByLabel(
        "I confirm these configured rewards and this competition period.",
      )
      .check();
    await adminPage.getByRole("button", { name: "Publish schedule" }).click();
    await expect(adminPage.getByRole("status")).toContainText(
      "Isolated save failure",
    );
    assert.equal(commands.length, 1);
    assert.equal(commands[0].publish, true);
    await adminPage.getByLabel("New team name").fill("Reviewed Club");
    await adminPage
      .getByLabel("Reason", { exact: true })
      .last()
      .fill("Requested correction");
    await expect(
      adminPage.getByRole("button", { name: "Save audited name change" }),
    ).toBeDisabled();
    await adminPage
      .getByLabel("Confirm changing Fixture Club to Reviewed Club.")
      .check();
    await adminPage
      .getByRole("button", { name: "Save audited name change" })
      .click();
    await expect(adminPage.getByRole("status")).toContainText(
      "Isolated save failure",
    );
    assert.equal(commands.length, 2);
    assert.equal(commands[1].previous, "Fixture Club");
    await admin.close();
    const recording = await browser.newContext({
      viewport: { width: 412, height: 915 },
      recordVideo: { dir: out, size: { width: 412, height: 915 } },
    });
    const page = await recording.newPage();
    await page.goto(origin + "/fantasy/play?fixture=loader");
    await expect(page.getByText("Getting Docked ready…")).toBeVisible();
    await page.waitForTimeout(3500);
    await recording.close();
    writeFileSync(
      `${out}/checks.json`,
      JSON.stringify(
        {
          checks,
          scope:
            "isolated actual components; synthetic prize rewards only; no hosted data mutations",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, out, checks: checks.length }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
