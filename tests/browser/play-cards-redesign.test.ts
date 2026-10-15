import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const base = "http://127.0.0.1:3023";
const out = "docs/qa/premium-completion";
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
});
async function noOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function noMarks(page: import("@playwright/test").Page) {
  await expect(
    page.locator('.player-jersey[data-number-source="unavailable"] text'),
  ).toHaveCount(0);
  for (const n of await page.locator(".player-jersey text").allTextContents())
    expect(n).toMatch(/^\d{1,2}$/);
  await expect(page.locator(".player-jersey image")).toHaveCount(0);
}
test("desktop and phone composition preserves data, formation, verified-number jerseys and focus", async ({
  page,
}) => {
  await mkdir(out, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [820, 1000],
    [412, 850],
    [360, 740],
  ]) {
    await page.setViewportSize({ width, height });
    for (const tab of ["play", "cards"]) {
      await page.goto(base + "/fantasy/" + tab);
      await expect(page.locator(".workspace-balance")).toContainText("12,500");
      await noOverflow(page);
      await noMarks(page);
      if (tab === "play") {
        await expect(page.locator(".seven-slot")).toHaveCount(7);
        expect(
          await page
            .locator(".seven-slot")
            .evaluateAll((es) => es.map((e) => e.getAttribute("data-slot"))),
        ).toEqual(["QB1", "RB1", "RB2", "WR1", "WR2", "TE1", "FLEX1"]);
        await expect(page.locator(".round-timing")).toContainText(
          "Entry deadline",
        );
        await expect(page.locator(".round-timing")).toContainText(
          "Next selected kickoff",
        );
        const rects = await page.locator(".seven-slot").evaluateAll((es) =>
          es.map((e) => ({
            top: e.getBoundingClientRect().top,
            left: e.getBoundingClientRect().left,
          })),
        );
        expect(rects[1].top).toBe(rects[2].top);
        expect(rects[3].top).toBe(rects[4].top);
        expect(rects[5].top).toBe(rects[6].top);
      } else {
        await expect(
          page.getByRole("link", { name: "Open packs (0)" }),
        ).toBeVisible();
      }
      await page.screenshot({
        path: `${out}/${tab}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 412, height: 850 });
  await page.goto(base + "/fantasy/cards");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByLabel("Team", { exact: true })).toBeVisible();
  await page.getByLabel("Team", { exact: true }).selectOption("KC");
  await expect(page.locator(".collection-grid .fantasy-card")).toHaveCount(1);
  await page.getByLabel("Team", { exact: true }).selectOption("");
  await page.getByRole("button", { name: /View Alex.*card details/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include(".app-content").analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("collection rarity counts, paging, filtering, list and empty states are source-backed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/fantasy/cards?scenario=all-rarities");
  await expect(page.locator(".collection-heading")).toContainText("23 cards");
  await expect(page.locator(".card-grid > article")).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".collection-pagination")).toContainText(
    "11–20 of 23",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".card-grid > article")).toHaveCount(3);
  await page
    .locator(".rarity-counts button")
    .filter({ hasText: "Icon" })
    .click();
  await expect(page.locator(".card-grid > article")).toHaveCount(3);
  await expect(page.locator(".collection-pagination")).toContainText(
    "Page 1 of 1",
  );
  await page
    .locator(".rarity-counts button")
    .filter({ hasText: "Icon" })
    .click();
  await expect(page.locator(".card-grid > article")).toHaveCount(10);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".collection-list")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search your cards" })
    .fill("no such player");
  await expect(
    page.getByText("No cards match these filters.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".card-grid > article")).toHaveCount(0);
  await page.goto(base + "/fantasy/cards?scenario=empty");
  await expect(page.locator(".collection-heading")).toContainText("0 cards");
  await expect(page.locator(".rarity-counts strong")).toHaveText([
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
  ]);
  await page.goto(base + "/fantasy/cards?scenario=packs");
  await expect(
    page.getByRole("link", { name: "Open packs (3)" }),
  ).toHaveAttribute("href", "/fantasy/test-wallet#packs");
});
test("incomplete invalid entered and partially locked states remain honest in both modes", async ({
  page,
}) => {
  for (const scenario of ["incomplete", "invalid", "entered", "partial"]) {
    await page.goto(base + "/fantasy/play?scenario=" + scenario);
    if (scenario === "incomplete") {
      await expect(page.locator(".selection-count")).toContainText("4/7");
      await expect(
        page.getByRole("button", { name: "Enter Competition", exact: true }),
      ).toBeDisabled();
    }
    if (scenario === "invalid") {
      await expect(
        page.getByRole("button", { name: "Enter Competition", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".compact-entry-heading")).toContainText(
        "Action required",
      );
    }
    if (scenario === "entered") {
      await expect(
        page.getByRole("button", { name: "Update Team", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".round-timing")).toContainText(
        "Next player lock",
      );
      const submittedTiming = await page.locator(".round-timing").innerText();
      for (const slot of ["QB1", "RB1", "RB2", "WR1", "WR2", "TE1", "FLEX1"]) {
        await page
          .getByRole("button", { name: new RegExp(`^${slot}:`) })
          .click();
        await page
          .getByRole("dialog")
          .getByText("Card details & rules", { exact: true })
          .click();
        await page
          .getByRole("button", { name: "Remove from lineup", exact: true })
          .click();
      }
      // Local unsubmitted changes cannot replace the confirmed entry's lock clock.
      await expect(page.locator(".round-timing")).toHaveText(submittedTiming, {
        useInnerText: true,
      });
      await expect(
        page.getByRole("button", { name: "Update Team", exact: true }),
      ).toBeDisabled();
    }
    if (scenario === "partial") {
      await expect(page.locator(".compact-entry-heading")).toContainText(
        "Partially locked",
      );
      await page.getByRole("button", { name: /QB1:/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Transfer", exact: true }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.locator(".seven-budget")).toContainText("No Salary Cap");
    await expect(page.locator(".lineup-salary")).toHaveCount(0);
    await noOverflow(page);
  }
});
test("enlarged text and reduced motion keep card data and actions readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const tab of ["play", "cards"]) {
    await page.goto(base + "/fantasy/" + tab);
    await page.addStyleTag({ content: "html{font-size:24px}" });
    await noOverflow(page);
    await noMarks(page);
    await page.screenshot({
      path: `${out}/${tab}-enlarged.png`,
      fullPage: true,
    });
  }
  await page.goto(base + "/fantasy/reveal");
  await page.getByRole("button", { name: "Open nine-card preview" }).click();
  await noMarks(page);
  const bounds = await page.locator(".pack-case").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
});
