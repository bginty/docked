import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { futuristicCard } from "../tests/fixtures/futuristic-data";
async function main() {
  const out = `docs/qa/prelaunch/experience-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/prelaunch-experience.tsx",
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
    "test-wallet",
    "marketplace",
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "standings",
    "pack-shop",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let outcome = "ok",
    posts = 0,
    moderation = 0,
    denied = true;
  const keys: string[] = [],
    awarded = new Set<string>();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    const json = (v: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(v));
    };
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (url.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (
      url.pathname.startsWith("/brand/") ||
      url.pathname.startsWith("/images/")
    ) {
      const file = resolve("public", "." + url.pathname);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (url.pathname === "/api/records")
      return url.searchParams.get("view") === "denied" && denied
        ? json({ error: "Access denied" }, 403)
        : json({ activity: "isolated operational record" });
    if (url.pathname === "/api/community") {
      if (req.method === "GET")
        return json({
          cards: [{ card: futuristicCard }],
          own: true,
          settings: null,
        });
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.action === "moderate") {
        moderation++;
        await new Promise((r) => setTimeout(r, 200));
        return json({ ok: true });
      }
      keys.push(body.idempotencyKey);
      if (outcome === "error")
        return json({ error: "Local simulated failure; retry safely." }, 503);
      if (!awarded.has(body.idempotencyKey)) {
        awarded.add(body.idempotencyKey);
        posts++;
      }
      if (outcome === "lost") return req.socket.destroy();
      return json({ post: { id: "local-post" } });
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked isolated QA</title><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const results: unknown[] = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: true,
        isMobile: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/social");
      const scrollable = async () => {
        await expect(page.getByRole("dialog")).toHaveCount(0);
        assert.notEqual(
          await page.evaluate(() => document.body.style.overflow),
          "hidden",
        );
        await page.evaluate(() => scrollTo(0, 0));
        const touch = await context.newCDPSession(page);
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: Math.floor(width / 2), y: 750 }],
        });
        for (let y = 710; y >= 250; y -= 40) {
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: Math.floor(width / 2), y }],
          });
          await page.waitForTimeout(20);
        }
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await touch.detach();
        await expect
          .poll(() => page.evaluate(() => scrollY))
          .toBeGreaterThan(0);
        await page.evaluate(() => scrollTo(0, 0));
      };
      for (const close of ["escape", "cancel", "back", "native", "navigate"]) {
        await page
          .getByRole("button", { name: "Create post", exact: true })
          .click();
        await page.getByLabel("Your post").fill("Local synthetic post draft");
        await page.getByRole("button", { name: /Attach your cards/ }).click();
        await page.getByRole("checkbox").check();
        if (close === "navigate") {
          await page.goto(origin + "/social");
        } else {
          if (close === "back")
            await page.evaluate(() =>
              window.dispatchEvent(new PopStateEvent("popstate")),
            );
          else if (close === "native")
            await page
              .getByRole("dialog")
              .last()
              .evaluate((el) =>
                el.dispatchEvent(new Event("cancel", { cancelable: true })),
              );
          else await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(1);
          assert.equal(
            await page.evaluate(() => document.body.style.overflow),
            "hidden",
            "Parent retains its own lock",
          );
          if (close === "cancel")
            await page
              .getByRole("button", { name: "Cancel", exact: true })
              .click();
          else await page.keyboard.press("Escape");
        }
        await scrollable();
      }
      for (const fail of ["error", "lost"]) {
        await page
          .getByRole("button", { name: "Create post", exact: true })
          .click();
        await page
          .getByLabel("Your post")
          .fill("Synthetic recoverable publication");
        await page.getByRole("button", { name: /Attach your cards/ }).click();
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: /Done ·/ }).click();
        await page
          .getByRole("button", { name: "Preview post", exact: true })
          .click();
        await page.screenshot({ path: `${out}/post-preview-${width}.png` });
        outcome = fail;
        const before = posts,
          start = keys.length;
        await page.getByRole("button", { name: "Post", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Post", exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByRole("dialog").last().getByRole("status"),
        ).not.toBeEmpty();
        outcome = "ok";
        await page.getByRole("button", { name: "Post", exact: true }).click();
        await scrollable();
        assert.equal(posts, before + 1);
        assert.equal(keys[start], keys.at(-1));
      }
      await page.screenshot({
        path: `${out}/social-${width}.png`,
        fullPage: true,
      });
      await page.goto(origin + "/admin");
      await expect(page.getByLabel("Operational records")).toContainText(
        "isolated operational record",
      );
      denied = true;
      await page.getByRole("button", { name: "Restricted view" }).click();
      await expect(
        page.getByText("Access denied", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Operational records")).toHaveCount(0);
      denied = false;
      await page.getByRole("button", { name: "Retry records" }).click();
      await expect(page.getByLabel("Operational records")).toBeVisible();
      await page.getByLabel("Report status").selectOption("dismissed");
      await expect(
        page.getByText("No reports match these filters."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Clear filters" }).click();
      await page.getByLabel("Search reports").fill("local-reporter");
      await expect(page.getByText("1 of 1 loaded reports")).toBeVisible();
      await page
        .getByText("Review report · harassment", { exact: true })
        .click();
      await expect(
        page.getByText("Synthetic reported commentary for review.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Isolated existing review history", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: /^Action/ }).locator("option"),
      ).toHaveText(["remove", "dismiss", "warn", "escalate"]);
      await page
        .getByLabel("Audited reason")
        .fill("Isolated local report reviewed");
      const before = moderation;
      await page.locator("form").evaluate((form) => {
        (form as HTMLFormElement).requestSubmit();
        (form as HTMLFormElement).requestSubmit();
      });
      await expect(
        page.getByText("Audited moderation action recorded.", { exact: true }),
      ).toBeVisible();
      assert.equal(moderation, before + 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/moderation-${width}.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page }).analyze();
      writeFileSync(
        `${out}/accessibility-${width}.json`,
        JSON.stringify(axe.violations, null, 2),
      );
      assert.deepEqual(
        axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => v.id),
        [],
      );
      await page.goto(origin + "/admin?readonly");
      await expect(
        page.getByRole("button", { name: "Record moderation action" }),
      ).toHaveCount(0);
      assert.deepEqual(errors, []);
      results.push({
        width,
        repeatedClosePaths: 5,
        retryPaths: 2,
        moderation: true,
        seriousAccessibility: 0,
      });
      await context.close();
    }
    writeFileSync(
      out + "/results.json",
      JSON.stringify(
        {
          scope:
            "Real production React components, local HTTP synthetic fixtures and synthetic touch. No hosted authentication, real publication, physical Samsung or financial operations.",
          results,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      "docs/qa/prelaunch/experience-latest.json",
      JSON.stringify(
        {
          passed: true,
          path: out,
          scope:
            "Isolated production components; physical and hosted authentication acceptance pending",
        },
        null,
        2,
      ),
    );
    console.log(out);
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
