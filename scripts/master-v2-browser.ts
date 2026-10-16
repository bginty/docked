import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  expect as baseExpect,
  type Browser,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const expect = baseExpect.configure({ timeout: 30000 });

export async function verifyMasterV2(
  browser: Browser,
  sessions: APIRequestContext[],
  origin: string,
) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const root = `docs/qa/master-v2/auth-browser-${Date.now()}`;
  await mkdir(root, { recursive: true });
  const context = await browser.newContext({
    storageState: await sessions[1].storageState(),
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();
  const touch = await context.newCDPSession(page);
  const errors: string[] = [];
  const accessibility: unknown[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (response) => {
    if (
      response.url().endsWith("/api/community") &&
      response.request().method() === "POST" &&
      !response.ok()
    ) {
      await writeFile(
        root + "/failed-post.json",
        JSON.stringify(
          { status: response.status(), body: await response.json() },
          null,
          2,
        ),
      );
    }
  });
  async function scrollable(p: Page) {
    await expect(p.getByRole("dialog")).toHaveCount(0);
    assert.notEqual(
      await p.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    await p.evaluate(() => scrollTo(0, 0));
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 200, y: 720 }],
    });
    for (let y = 680; y >= 280; y -= 40) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 200, y }],
      });
      await p.waitForTimeout(25);
    }
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => p.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
  try {
    // Compile this local dev endpoint before timing browser interactions. This is
    // an authenticated read, not a fixture response or an access-control bypass.
    const hub = await sessions[1].get(origin + "/api/community?view=hub", {
      timeout: 120000,
    });
    assert.equal(hub.status(), 200);
    if (!process.argv.includes("--capture-only")) {
      await page.goto(origin + "/fantasy/social", {
        timeout: 120000,
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator('[data-composer-ready="true"]')).toBeVisible();
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /Attach your cards/ }).click();
        const sheet = page.getByRole("dialog");
        await expect(sheet.getByRole("checkbox").first()).toBeVisible();
        await sheet.getByRole("checkbox").first().check();
        await sheet.getByRole("checkbox").first().uncheck();
        await sheet.getByRole("checkbox").last().check();
        if (i === 0) await page.keyboard.press("Escape");
        else if (i === 1)
          await sheet.evaluate((e) =>
            e.dispatchEvent(new Event("cancel", { cancelable: true })),
          );
        else await sheet.getByRole("button", { name: /Done/ }).click();
        await scrollable(page);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
      }
      const body = "Local V2 scroll recovery " + randomUUID();
      await page.getByRole("textbox", { name: "Your post" }).fill(body);
      await page.getByRole("button", { name: /Attach your cards/ }).click();
      await page.getByRole("dialog").getByRole("checkbox").first().check();
      await page.getByRole("button", { name: /Done/ }).click();
      await page
        .getByRole("button", { name: "Preview post", exact: true })
        .click();
      await page.screenshot({ path: root + "/post-preview-412.png" });
      const keys: string[] = [];
      await page.route("**/api/community", async (r) => {
        if (r.request().method() !== "POST") return r.continue();
        keys.push(r.request().postDataJSON().idempotencyKey);
        if (keys.length === 1) return r.abort("internetdisconnected");
        return r.continue();
      });
      await page.getByRole("button", { name: "Post", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Post", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "Keep editing" }).click();
      await scrollable(page);
      await expect(
        page.getByRole("textbox", { name: "Your post" }),
      ).toHaveValue(body);
      await page
        .getByRole("button", { name: "Preview post", exact: true })
        .click();
      await page.getByRole("button", { name: "Post", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
      await expect(page.getByText(body, { exact: true })).toBeVisible();
      assert.equal(keys.length, 2);
      assert.equal(keys[0], keys[1]);
      await page.unroute("**/api/community");
      await scrollable(page);
    }
    for (const width of [1440, 1024, 412, 360]) {
      await page.setViewportSize({ width, height: width < 500 ? 915 : 960 });
      for (const [name, path] of [
        ["play", "/fantasy/play"],
        ["cards", "/fantasy/cards"],
        ["market", "/fantasy/market"],
        ["social", "/fantasy/social"],
        ["profile", "/profile"],
        ["wallet", "/fantasy/test-wallet"],
        ["communities", "/fantasy/social?tab=communities"],
        ["offers", "/profile?tab=offers"],
      ]) {
        await page.goto(origin + path, {
          timeout: 120000,
          waitUntil: "domcontentloaded",
        });
        await expect(page.locator(".fantasy-gate[aria-busy]")).toHaveCount(0, {
          timeout: 120000,
        });
        if (name === "market")
          await expect(page.locator('[data-market-ready="true"]')).toBeVisible({
            timeout: 30000,
          });
        if (name === "social")
          await expect(
            page.locator('[data-composer-ready="true"]'),
          ).toBeVisible({ timeout: 30000 });
        await expect(page.locator(".app-content")).toBeVisible({
          timeout: 120000,
        });
        await page.evaluate(() => document.fonts.ready);
        await expect(
          page.getByText(/^Loading (market|collection|offers)/),
        ).toHaveCount(0);
        await page.locator(".member-photo img").evaluateAll(async (nodes) => {
          await Promise.race([
            Promise.all(
              nodes
                .filter((node) => {
                  const box = node.getBoundingClientRect();
                  return box.top < innerHeight && box.bottom > 0;
                })
                .map((node) =>
                  (node as HTMLImageElement).decode().catch(() => undefined),
                ),
            ),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        });
        await expect(page.locator("body")).not.toContainText(
          "screen couldn’t be loaded",
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${name} overflow ${width}`,
        );
        await page.screenshot({ path: `${root}/${name}-${width}.png` });
        if (name === "market") {
          await page
            .getByRole("button", { name: "Filters", exact: true })
            .click();
          await expect(page.getByRole("dialog")).toHaveAccessibleName(
            "Market filters",
          );
          await page
            .getByRole("dialog")
            .getByLabel("Maximum credits")
            .fill("100");
          await page
            .getByRole("button", { name: "Apply filters", exact: true })
            .click();
          await expect(page).toHaveURL(/max=100/);
          await page
            .getByRole("button", { name: "Filters", exact: true })
            .click();
          await expect(page.getByLabel("Maximum credits")).toHaveValue("100");
          await page
            .getByRole("button", { name: "Clear filters", exact: true })
            .click();
          await expect(page).not.toHaveURL(/max=100/);
          assert.notEqual(
            await page.evaluate(() => document.body.style.overflow),
            "hidden",
          );
        }
        if (width === 1440) {
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
          const violations = audit.violations
            .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
            .map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            }));
          if (violations.length) accessibility.push({ name, violations });
        }
      }
    }
    assert.deepEqual(errors, []);
    await writeFile(
      root + "/accessibility.json",
      JSON.stringify(accessibility, null, 2),
    );
    assert.deepEqual(accessibility, [], "Desktop accessibility");
    await writeFile(
      "docs/qa/master-v2/latest-browser.json",
      JSON.stringify({ root, passed: true, physicalDevice: false }, null, 2),
    );
    return [
      ...(process.argv.includes("--capture-only")
        ? []
        : [
            "V2 authenticated local browser: owned-card attach/remove, three close cycles, simulated Android cancel, network failure then idempotent publication, feed scrolling",
          ]),
      "V2 eight surfaces at 1440/1024/412/360; filters apply/persist/clear; no horizontal overflow; Axe serious/critical checks",
    ];
  } catch (error) {
    await page.screenshot({ path: root + "/browser-failure.png" });
    await writeFile(
      root + "/browser-failure.json",
      JSON.stringify(
        {
          url: page.url(),
          message: error instanceof Error ? error.stack : String(error),
          dialogs: await page.getByRole("dialog").allTextContents(),
          errors,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await context.close();
  }
}
