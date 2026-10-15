import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect, type Browser, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

/** Real local sessions and HTTP; no response interception or fabricated UI data. */
export async function captureSocialUpgrade(
  browser: Browser,
  sessions: APIRequestContext[],
  origin: string,
  root = "docs/qa/social-upgrade",
) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  await mkdir(root, { recursive: true });
  if (root === "docs/qa/social-visual-preview") {
    const feed = await (
      await sessions[1].get("/api/community?view=feed&tab=latest")
    ).json();
    const body =
      "Local QA · A closer look at my collection. Which card would you build around?";
    if (!feed.posts.some((p: { body: string }) => p.body === body)) {
      const hub = await (
        await sessions[1].get("/api/community?view=hub")
      ).json();
      const posted = await sessions[1].post("/api/community", {
        data: {
          action: "post",
          kind: "discussion",
          body: "Local QA · A closer look at my collection. Which card would you build around?",
          sport: "nfl",
          mediaIds: [],
          cardIds: hub.cards
            .slice(0, 2)
            .map((v: { card: { id: string } }) => v.card.id),
          idempotencyKey: randomUUID(),
        },
      });
      assert.equal(posted.status(), 200, await posted.text());
    }
  }
  const context = await browser.newContext({
    storageState: await sessions[1].storageState(),
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const checks: string[] = [];
  try {
    for (const viewport of [
      { width: 1440, height: 960 },
      { width: 412, height: 815 },
      { width: 815, height: 412 },
    ]) {
      await page.setViewportSize(viewport);
      for (const [name, path, ready] of [
        ["social", "/fantasy/social", "More than cards."],
        ["collection", "/profile/localreader1", "Collection privacy & offers"],
        ["communities", "/fantasy/social?tab=communities", "Community rules"],
        ["packs", "/fantasy/test-wallet?view=packs", "NFL nine-card packs"],
        ["offers", "/profile?tab=offers", "Private offers"],
      ]) {
        await page.goto(origin + path, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        await expect(
          page.getByText(ready, { exact: false }).first(),
        ).toBeVisible({ timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(
          () =>
            [
              ...document.querySelectorAll<HTMLImageElement>(
                ".member-photo img",
              ),
            ]
              .filter((img) => {
                const r = img.getBoundingClientRect();
                return r.top < innerHeight && r.bottom > 0;
              })
              .every((img) => img.complete && img.naturalWidth > 0),
          {},
          { timeout: 15000 },
        );
        if (name === "social")
          await expect(
            page.locator('[data-composer-ready="true"]'),
          ).toBeVisible({ timeout: 30000 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${name} overflow at ${viewport.width}`,
        );
        await page.screenshot({
          path: `${root}/${name}-${viewport.width}.png`,
          fullPage: false,
        });
        if (name === "collection") {
          await page.locator(".social-card-grid").scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${root}/collection-cards-${viewport.width}.png`,
          });
        }
        if (
          name === "social" &&
          (await page.locator(".social-shared-cards").count())
        ) {
          await page
            .locator(".social-shared-cards")
            .first()
            .scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${root}/social-cards-${viewport.width}.png`,
          });
        }
        if (name === "collection" && viewport.width === 412) {
          await page
            .getByRole("button", { name: "View card →", exact: true })
            .first()
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          assert.ok(
            await page.evaluate(
              () => document.activeElement?.tagName === "BUTTON",
            ),
            "Dialog returns keyboard focus",
          );
          await page
            .getByRole("searchbox", { name: "Search players" })
            .fill("no-such-fixture-player");
          await expect(
            page.getByText("No cards match these filters."),
          ).toBeVisible();
        }
        if (viewport.width === 1440) {
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
          assert.deepEqual(
            audit.violations
              .filter((v) => v.impact === "critical" || v.impact === "serious")
              .map((v) => ({
                id: v.id,
                targets: v.nodes.map((n) => n.target),
              })),
            [],
            `${name} accessibility`,
          );
        }
      }
    }
    assert.deepEqual(errors, []);
    checks.push(
      "Actual authenticated Edge browser: Social, collection, communities, offers and packs at 1440×960, 412×815 and 815×412; no horizontal overflow",
      "Collection filtering, dialog Escape and focus restoration; reduced motion; no browser exceptions",
      "Axe WCAG A/AA: no serious or critical violations on five desktop surfaces",
    );
    return checks;
  } finally {
    await context.close();
  }
}
