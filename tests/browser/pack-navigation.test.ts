import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  previewPackReceipt,
  type PreviewSport,
} from "../../src/components/pack-opening-preview";
import { mountPackFixture, packFixtureMarkup } from "../fixtures/pack-browser";
import type { PackReceipt } from "../../src/core/pack-opening";

async function mount(page: Page, count: number, sport: PreviewSport = "afl") {
  const receipt = previewPackReceipt(sport);
  receipt.id += `-navigation-${count}`;
  receipt.cards = receipt.cards.slice(0, count);
  let saved: PackReceipt | null = null;
  let opens = 0;
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/receipt") return route.fulfill({ json: saved });
    if (path === "/open-pack") {
      opens++;
      saved = receipt;
      return route.fulfill({ json: receipt });
    }
    if (path === "/api/fantasy/card-history")
      return route.fulfill({
        json: {
          season: "2026",
          seasons: ["2026"],
          averageBase: null,
          bestBase: null,
          played: 0,
          rows: [],
        },
      });
    if (path.startsWith("/api/"))
      return route.fulfill({
        json: {
          eligibility: { allowed: false, reason: "Isolated preview" },
          scores: [],
        },
      });
    return route.fulfill(await packFixtureMarkup(path));
  });
  await mountPackFixture(page, true);
  await page.getByRole("button", { name: "Open pack seal" }).click();
  return { receipt, opens: () => opens };
}

test("player inspection returns to the same revealed card instead of closing the pack", async ({
  page,
}) => {
  const { receipt, opens } = await mount(page, 3);
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.locator(".cinema-v2-card-hit").click();
  await expect(page.locator(".collectible-viewer")).toBeVisible();
  if (process.env.DOCKED_NAV_BASELINE) {
    await mkdir("docs/qa/pack-navigation-20261107", { recursive: true });
    await page.screenshot({
      path: "docs/qa/pack-navigation-20261107/before-player-details.png",
    });
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await page.screenshot({
      path: "docs/qa/pack-navigation-20261107/before-pack-lost.png",
    });
  } else {
    await page.getByRole("button", { name: "Back to Pack" }).click();
  }
  await expect(page.locator(".pack-opening")).toBeVisible();
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await expect(page.locator(".cinema-v2")).toContainText(receipt.cards[0].name);
  expect(opens()).toBe(1);
});

for (const sport of ["nfl", "afl", "nrl"] as const) {
  for (const count of [1, 3, 9]) {
    test(`${sport} ${count} cards: inspect, native cancel, browser Back, next and summary preserve one receipt`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const { receipt, opens } = await mount(page, count, sport);
      for (let i = 0; i < count; i++) {
        await expect(page.locator(".pack-count")).toContainText(
          `Card ${i + 1} of ${count}`,
        );
        await page
          .getByRole("button", { name: "Reveal card", exact: true })
          .click();
        await page
          .getByRole("button", { name: "View Player", exact: true })
          .click();
        const detail = page.locator(".pack-player-details");
        await expect(detail).toBeVisible();
        await expect(detail.locator(".fantasy-card")).toContainText(
          receipt.cards[i].name,
        );
        await expect(detail).toContainText(receipt.cards[i].name);
        if (i % 4 === 0)
          await detail.getByRole("button", { name: "Back to Pack" }).click();
        else if (i % 4 === 1) {
          // Exact native-bridge backButton contract. This is not a physical-device claim.
          await detail.evaluate((el) =>
            el.dispatchEvent(new Event("cancel", { cancelable: true })),
          );
        } else if (i % 4 === 2) await page.goBack();
        else
          await detail
            .getByRole("button", { name: "Close panel", exact: true })
            .click();
        await expect(detail).toHaveCount(0);
        await expect(page.locator(".cinema-v2")).toHaveAttribute(
          "data-pack-reveal-phase",
          "revealed",
        );
        await expect(page.locator(".cinema-v2")).toContainText(
          receipt.cards[i].name,
        );
        await expect(
          page.getByRole("button", { name: "View Player", exact: true }),
        ).toBeInViewport();
        await expect(
          page.getByRole("button", {
            name: i === count - 1 ? "View Pack Summary" : "Next Card →",
            exact: true,
          }),
        ).toBeInViewport();
        await page
          .getByRole("button", {
            name: i === count - 1 ? "View Pack Summary" : "Next Card →",
            exact: true,
          })
          .click();
      }
      await expect(page.locator(".pack-summary > li")).toHaveCount(count);
      await page
        .getByRole("button", {
          name: `View ${receipt.cards[0].name}`,
          exact: true,
        })
        .click();
      await page.keyboard.press("Escape");
      await expect(page.locator(".pack-summary > li")).toHaveCount(count);
      expect(opens()).toBe(1);
      expect(errors).toEqual([]);
    });
  }
}

test("exit, reload and Resume Pack preserve a revealed current card and do not call issuance again", async ({
  page,
}) => {
  const { receipt, opens } = await mount(page, 9);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Reveal card", exact: true })
      .click();
    if (i < 2)
      await page
        .getByRole("button", { name: "Next Card →", exact: true })
        .click();
  }
  await page.getByRole("button", { name: "Exit Pack", exact: true }).click();
  await expect(page.locator(".pack-opening")).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Unfinished pack reveal" }),
  ).toContainText("Card 3 of 9");
  await page.getByRole("button", { name: "Resume Pack", exact: true }).click();
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await expect(page.locator(".cinema-v2")).toContainText(receipt.cards[2].name);
  await mountPackFixture(page, true); // Real document reload and authenticated receipt read.
  await expect(page.locator(".pack-count")).toContainText("Card 3 of 9");
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  const saved = await page.evaluate(() =>
    Object.entries(localStorage).filter(([k]) =>
      k.startsWith("docked:reveal:v2:"),
    ),
  );
  expect(saved).toHaveLength(1);
  expect(Object.keys(JSON.parse(saved[0][1])).sort()).toEqual([
    "index",
    "revealed",
    "updatedAt",
  ]);
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary > li")).toHaveCount(9);
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume Pack", exact: true }),
  ).toHaveCount(0);
  expect(opens()).toBe(1);
});

test("rapid inspect/return/advance, sharing, backgrounding and interrupted animation do not lose the pack", async ({
  page,
}) => {
  const { opens } = await mount(page, 9);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await page
    .getByRole("button", { name: "View Player", exact: true })
    .evaluate((el) => {
      for (let i = 0; i < 8; i++) (el as HTMLButtonElement).click();
    });
  await expect(page.locator(".pack-player-details")).toHaveCount(1);
  await page.getByRole("button", { name: "Back to Pack" }).evaluate((el) => {
    for (let i = 0; i < 8; i++) (el as HTMLButtonElement).click();
  });
  await page
    .getByRole("button", { name: "Next Card →", exact: true })
    .evaluate((el) => {
      for (let i = 0; i < 8; i++) (el as HTMLButtonElement).click();
    });
  await expect(page.locator(".pack-count")).toContainText("Card 2 of 9");
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.getByRole("button", { name: "Skip animation" }).click();
  await page
    .getByRole("button", { name: "Share My Pull", exact: true })
    .click();
  await expect(page.locator(".pack-pull-preview")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pack-count")).toContainText("Card 2 of 9");
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary > li")).toHaveCount(9);
  expect(opens()).toBe(1);
});

for (const width of [320, 360, 412, 1366]) {
  test(`controls remain visible and accessible at ${width}px`, async ({
    page,
  }) => {
    await mount(page, 3);
    await page.setViewportSize({ width, height: width === 320 ? 640 : 915 });
    await page
      .getByRole("button", { name: "Reveal card", exact: true })
      .click();
    for (const name of [
      "View Player",
      "Next Card →",
      "Reveal All",
      "Exit Pack",
    ])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir("docs/qa/pack-navigation-20261107", { recursive: true });
    await page.screenshot({
      path: `docs/qa/pack-navigation-20261107/after-revealed-${width}.png`,
    });
    await page
      .getByRole("button", { name: "View Player", exact: true })
      .click();
    await expect(
      page.locator(".pack-player-details .fantasy-card"),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/qa/pack-navigation-20261107/after-details-${width}.png`,
    });
    await expect(
      page.getByRole("button", { name: "Back to Pack" }),
    ).toBeInViewport();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest(".pack-player-details") !== null,
      ),
    ).toBe(true);
  });
}

test("full player statistics closes one modal at a time and returns to the same pack", async ({
  page,
}) => {
  const { opens } = await mount(page, 3, "nfl");
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.getByRole("button", { name: "View Player", exact: true }).click();
  await page
    .getByRole("button", { name: /Front of .*Show player statistics/ })
    .click();
  await page.getByRole("button", { name: "View Full Game Log" }).click();
  await expect(page.locator(".statistics-sheet")).toBeVisible();
  await page
    .locator(".statistics-sheet")
    .evaluate((el) =>
      el.dispatchEvent(new Event("cancel", { cancelable: true })),
    );
  await expect(page.locator(".statistics-sheet")).toHaveCount(0);
  await expect(page.locator(".pack-player-details")).toBeVisible();
  await page.getByRole("button", { name: "Back to Pack" }).click();
  await expect(page.locator(".pack-count")).toContainText("Card 1 of 3");
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  expect(opens()).toBe(1);
});

test("storage denied does not block in-memory return or the next card", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  const { opens } = await mount(page, 3);
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.getByRole("button", { name: "View Player", exact: true }).click();
  await page.getByRole("button", { name: "Back to Pack" }).click();
  await page.getByRole("button", { name: "Next Card →", exact: true }).click();
  await expect(page.locator(".pack-count")).toContainText("Card 2 of 3");
  expect(opens()).toBe(1);
});

test.describe("recorded mobile browser demonstration", () => {
  test("AFL nine-card inspect, return, continue and summary", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const { opens } = await mount(page, 9);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (let i = 0; i < 9; i++) {
      await page
        .getByRole("button", { name: "Reveal card", exact: true })
        .click();
      await expect(page.locator(".cinema-v2")).toHaveAttribute(
        "data-pack-reveal-phase",
        "revealed",
        { timeout: 7000 },
      );
      if (i === 0 || i === 1 || i === 4) {
        await page
          .getByRole("button", { name: "View Player", exact: true })
          .click();
        await expect(
          page.locator(".pack-player-details .fantasy-card"),
        ).toBeVisible();
        await page.waitForTimeout(700); // Deliberate readable dwell in the demonstration recording.
        await page.getByRole("button", { name: "Back to Pack" }).click();
      }
      await page.waitForTimeout(400);
      await page
        .getByRole("button", {
          name: i === 8 ? "View Pack Summary" : "Next Card →",
          exact: true,
        })
        .click();
    }
    await expect(page.locator(".pack-summary > li")).toHaveCount(9);
    expect(opens()).toBe(1);
    await page.screenshot({
      path: "docs/qa/pack-navigation-20261107/after-nine-card-summary.png",
    });
    await page.waitForTimeout(1000);
    const video = page.video();
    await page.close();
    await video?.saveAs(
      "docs/qa/pack-navigation-20261107/afl-nine-card-navigation-mobile-browser.webm",
    );
  });
});
