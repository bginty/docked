import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { previewReceipt } from "../../src/components/pack-opening-preview";
import type { PackReceipt } from "../../src/core/pack-opening";
import {
  mountPackFixture,
  packFixtureMarkup,
  revealPhase,
} from "../fixtures/pack-browser";

const evidence = process.env.DOCKED_VISUAL_EVIDENCE ?? "docs/qa/mobile-cleanup";

for (const width of [360, 412, 1366]) {
  test(
    "lost receipt response, saved progress, replay and accessibility at " +
      width,
    async ({ page }) => {
      let committedReceipt: PackReceipt | null = null;
      let opens = 0;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 915 });
      await page.route("**/*", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/receipt")
          return route.fulfill({ json: committedReceipt });
        if (path === "/open-pack") {
          opens++;
          committedReceipt = previewReceipt;
          return route.abort();
        }
        return route.fulfill(await packFixtureMarkup(path));
      });
      await mountPackFixture(page);
      const output = evidence + "/reveal-regression";
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: output + "/sealed-" + width + ".png" });
      await page.getByRole("button", { name: "Open pack seal" }).dblclick();
      await expect(page.getByRole("alert")).toContainText("Retry");
      expect(opens).toBe(1);

      // The response was lost after the server committed. Reload reads that receipt.
      await mountPackFixture(page);
      const phase = page.locator(revealPhase);
      await expect(phase).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await expect(
        page.getByText("Card 1 of 10", { exact: true }),
      ).toBeVisible();
      await expect(phase).not.toHaveAttribute("data-tier");
      await expect(page.locator(".pack-case")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Reveal card" })
        .click({ force: true });
      await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
      await page.getByRole("button", { name: "Next Card →" }).click();
      await expect(
        page.getByText("Card 2 of 10", { exact: true }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Close panel" }).click();
      await page.getByRole("button", { name: "Open viewer" }).click();
      await expect(
        page.getByText("Card 2 of 10", { exact: true }),
      ).toBeVisible();
      await expect(phase).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await page
        .getByRole("button", { name: "Reveal card" })
        .click({ force: true });
      await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
      const inspect = page.getByRole("group", {
        name: new RegExp("Inspect " + previewReceipt.cards[1].name),
      });
      await inspect.focus();
      await inspect.press("ArrowRight");
      expect(
        await inspect.evaluate((el) => getComputedStyle(el).transform),
      ).not.toBe("none");
      await inspect.press("Escape");
      expect(
        (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({ path: output + "/revealed-" + width + ".png" });

      await page
        .getByRole("button", { name: "Reveal All", exact: true })
        .click();
      const summary = page.locator(".pack-summary li");
      await expect(summary).toHaveCount(10);
      await page.screenshot({ path: output + "/summary-" + width + ".png" });
      await mountPackFixture(page);
      await expect(summary).toHaveCount(10);
      await page
        .getByRole("button", { name: "Replay saved result · no new cards" })
        .click();
      await expect(phase).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await expect(
        page.getByText("Card 1 of 10", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sound off" }),
      ).toBeVisible();
      expect(opens).toBe(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    },
  );
}

test("reduced motion, keyboard opening and duplicate input", async ({
  page,
}) => {
  let committedReceipt: PackReceipt | null = null;
  let opens = 0;
  const receipt = {
    ...previewReceipt,
    id: "single",
    cards: previewReceipt.cards.slice(0, 1),
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/receipt") return route.fulfill({ json: committedReceipt });
    if (path === "/open-pack") {
      opens++;
      await new Promise((resolve) => setTimeout(resolve, 150));
      committedReceipt = receipt;
      return route.fulfill({ json: receipt });
    }
    return route.fulfill(await packFixtureMarkup(path));
  });
  await mountPackFixture(page);
  await page.getByRole("button", { name: "Open pack seal" }).focus();
  const confirmed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/open-pack",
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Close panel" }).click();
  await confirmed;
  await mountPackFixture(page);
  const phase = page.locator(revealPhase);
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "mystery");
  await page.getByRole("button", { name: "Reveal card" }).press("Enter");
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".pack-case")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "View Pack Summary" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(1);
  expect(opens).toBe(1);
});

test("an existing NBA receipt keeps its original read-only reveal", async ({
  page,
}) => {
  const receipt = {
    ...previewReceipt,
    id: "legacy-nba",
    cards: [{ ...previewReceipt.cards[0], sport: "basketball" }],
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/receipt") return route.fulfill({ json: receipt });
    if (path === "/open-pack")
      throw new Error("Saved receipt was submitted again");
    return route.fulfill(await packFixtureMarkup(path));
  });
  await mountPackFixture(page);
  await expect(page.getByText("1 of 1 · CORE")).toBeVisible();
  await expect(page.locator(revealPhase)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share My Pull" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Skip remaining reveals" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Pack Summary" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(1);
});
