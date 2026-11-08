import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { previewPackReceipt } from "../../src/components/pack-opening-preview";
import { mountPackFixture, packFixtureMarkup } from "../fixtures/pack-browser";

const evidence = "docs/qa/scoring-pack-refinement-20261108/pack-review-sharing";
const before = process.env.DOCKED_REVIEW_BEFORE === "1";
const receipt = previewPackReceipt("afl");
receipt.cards[3].name = "Alexandria Montgomery-Wetherington";
receipt.cards[3].team = "North Melbourne Kangaroos";

test("large text keeps full player names and usable actions within narrow review cards", async ({
  page,
}) => {
  test.skip(before);
  await page.setViewportSize({ width: 320, height: 844 });
  await summary(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.locator(".pack-review-card")).toHaveCount(9);
  const layout = await page.locator(".pack-review-card").evaluateAll((rows) =>
    rows.map((row) => {
      const bounds = row.getBoundingClientRect();
      return Array.from(row.querySelectorAll("button")).every((button) => {
        const box = button.getBoundingClientRect();
        return (
          box.width >= 44 &&
          box.height >= 44 &&
          box.right <= bounds.right &&
          box.left >= bounds.left
        );
      });
    }),
  );
  expect(layout.every(Boolean)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/after-320-text-200.png` });
});

async function summary(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/receipt") return route.fulfill({ json: receipt });
    if (path === "/open-pack") throw Error("Replay must not issue cards");
    if (path.startsWith("/api/"))
      return route.fulfill({
        json: {
          eligibility: { allowed: false, reason: "Isolated preview" },
          rows: [],
          seasons: [],
          scores: [],
        },
      });
    return route.fulfill(await packFixtureMarkup(path));
  });
  await mountPackFixture(page, true);
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary > li")).toHaveCount(9);
}

test("each card shares its own image directly; cancellation and detail sharing preserve the pack", async ({
  page,
}) => {
  test.skip(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    type Capture = { name: string; type: string; size: number; keys: string[] };
    const state = window as typeof window & {
      sharedFiles: Capture[];
      cancelShare: boolean;
      drawText: string[];
    };
    state.sharedFiles = [];
    state.drawText = [];
    state.cancelShare = false;
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        state.sharedFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          keys: Object.keys(data),
        });
        if (state.cancelShare)
          throw new DOMException("User cancelled", "AbortError");
      },
    });
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      state.drawText.push(text);
      return maxWidth === undefined
        ? fill.call(this, text, x, y)
        : fill.call(this, text, x, y, maxWidth);
    };
  });
  await summary(page);
  for (const index of [3, 4]) {
    const card = receipt.cards[index];
    await page
      .getByRole("button", { name: "Share " + card.name, exact: true })
      .click();
    const preview = page.getByRole("dialog", { name: "Share your pull" });
    await expect(
      preview.getByRole("img", { name: new RegExp(card.name) }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { sharedFiles: unknown[] }).sharedFiles
              .length,
        ),
      )
      .toBe(index - 2);
    const last = await page.evaluate(() =>
      (
        window as typeof window & {
          sharedFiles: {
            name: string;
            type: string;
            size: number;
            keys: string[];
          }[];
        }
      ).sharedFiles.at(-1)!,
    );
    expect(last.name).toBe(
      `docked-afl-${card.tier.toLowerCase().replaceAll("_", "-")}-pull.png`,
    );
    expect(last.type).toBe("image/png");
    expect(last.size).toBeGreaterThan(10000);
    expect(last.size).toBeLessThan(3_000_000);
    expect(last.keys).toEqual(["files"]);
    const drawn = await page.evaluate(
      () => (window as typeof window & { drawText: string[] }).drawText,
    );
    expect(drawn).toContain(card.name.toUpperCase());
    for (const privateValue of [
      card.id,
      card.edition_id,
      card.player_id,
      receipt.id,
      "isolated-test",
    ])
      expect(drawn).not.toContain(privateValue);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: `${evidence}/share-${card.tier.toLowerCase()}.png`,
    });
    const download = page.waitForEvent("download");
    await preview.getByRole("button", { name: "Save Image" }).click();
    await (await download).saveAs(`${evidence}/${last.name}`);
    await preview.getByRole("button", { name: "Close panel" }).click();
    await expect(page.locator(".pack-review-card")).toHaveCount(9);
  }
  const card = receipt.cards[4];
  await page
    .getByRole("button", { name: "View " + card.name, exact: true })
    .click();
  const detail = page.locator(".pack-player-details");
  await expect(detail).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { cancelShare: boolean }).cancelShare = true;
  });
  await detail
    .getByRole("button", { name: "Share " + card.name, exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Share your pull" });
  await expect(preview.getByRole("status")).toHaveText("Share cancelled.");
  await expect(preview.getByRole("alert")).toHaveCount(0);
  await preview.getByRole("button", { name: "Close panel" }).click();
  await detail.getByRole("button", { name: "Back to Pack" }).click();
  await expect(page.locator(".pack-review-card")).toHaveCount(9);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { sharedFiles: unknown[] }).sharedFiles
          .length,
    ),
  ).toBe(3);
});

test("expired web gesture keeps the selected image ready for a fresh Share tap", async ({
  page,
}) => {
  test.skip(before);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userActivation", {
      value: { isActive: false },
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: async () => {
        document.documentElement.dataset.shareCount = String(
          Number(document.documentElement.dataset.shareCount ?? 0) + 1,
        );
      },
      configurable: true,
    });
  });
  await summary(page);
  await page
    .getByRole("button", {
      name: "Share " + receipt.cards[4].name,
      exact: true,
    })
    .click();
  const preview = page.getByRole("dialog", { name: "Share your pull" });
  await expect(preview.getByRole("status")).toContainText("Tap Share Image");
  await expect(page.locator("html")).not.toHaveAttribute("data-share-count");
  await preview.getByRole("button", { name: "Share Image" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-share-count", "1");
});

test("unsupported sharing offers the exact-card download without a selection step", async ({
  page,
}) => {
  test.skip(before);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
  });
  await summary(page);
  await page
    .getByRole("button", {
      name: "Share " + receipt.cards[3].name,
      exact: true,
    })
    .click();
  const preview = page.getByRole("dialog", { name: "Share your pull" });
  await expect(
    preview.getByRole("button", { name: "Save Image" }),
  ).toBeEnabled();
  await expect(
    preview.getByRole("button", { name: "Share Image" }),
  ).toHaveCount(0);
  await expect(preview.locator("select")).toHaveCount(0);
  await expect(preview.getByRole("img")).toHaveAttribute(
    "alt",
    /Alexandria Montgomery-Wetherington, Ultra Rare AFL pull/,
  );
});

for (const width of [320, 390, 768, 1366]) {
  test(`nine-card review layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await summary(page);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: `${evidence}/${before ? "before" : "after"}-${width}.png`,
    });
    await page.locator(".pack-summary > li").last().scrollIntoViewIfNeeded();
    await expect(page.locator(".pack-summary > li").last()).toBeInViewport();
    await page.screenshot({
      path: `${evidence}/${before ? "before" : "after"}-bottom-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (before) return;
    await expect(page.getByText("Choose a card to share")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Share your new card" }),
    ).toHaveCount(0);
    await expect(page.locator(".pack-review-card")).toHaveCount(9);
    const rows = await page.locator(".pack-review-card").evaluateAll((items) =>
      items.map((item) => {
        const share = item
          .querySelector<HTMLButtonElement>(".pack-pull-trigger")!
          .getBoundingClientRect();
        const view = item
          .querySelector<HTMLButtonElement>(".pack-review-view")!
          .getBoundingClientRect();
        return {
          height: item.getBoundingClientRect().height,
          sw: share.width,
          vw: view.width,
          sh: share.height,
          vh: view.height,
        };
      }),
    );
    for (const row of rows) {
      expect(Math.abs(row.sw - row.vw)).toBeLessThan(1);
      expect(row.sh).toBeGreaterThanOrEqual(44);
      expect(row.sh).toBe(row.vh);
    }
    expect(
      Math.max(...rows.map((r) => r.height)) -
        Math.min(...rows.map((r) => r.height)),
    ).toBeLessThan(1);
  });
}
