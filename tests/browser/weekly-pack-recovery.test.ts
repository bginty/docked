import { test, expect } from "@playwright/test";
import { previewReceipt } from "../../src/components/pack-opening-preview";
import { packOpeningMessages } from "../../src/core/pack-opening-error";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import {
  packFixtureOrigin,
  packFixtureStyles,
  packFixtureMarkup,
  revealPhase,
} from "../fixtures/pack-browser";

test("weekly source outage is explained; the saved pack opens once after recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let recovered = false;
  const attempts: { pack: string; request: string; sport: string }[] = [];
  const receipt = {
    ...previewReceipt,
    id: "00000000-0000-4000-8000-000000000001",
    cards: previewReceipt.cards.slice(0, 4),
  };
  const state = () => ({
    enabled: true,
    member: "isolated-weekly",
    sport: "nfl",
    serverTime: Date.now(),
    packs: [
      {
        id: receipt.id,
        issuedAt: receipt.opened_at,
        dueAt: receipt.opened_at,
        openedAt: recovered ? receipt.opened_at : null,
        receipt: recovered ? receipt : null,
      },
    ],
  });
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/weekly-core") {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { state: state() } });
      attempts.push(route.request().postDataJSON());
      return recovered
        ? route.fulfill({ json: { state: state(), receipt } })
        : route.fulfill({
            status: 503,
            json: {
              code: "WEEKLY_POOL_UNAVAILABLE",
              error: "private SQL must not reach the UI",
            },
          });
    }
    return route.fulfill(await packFixtureMarkup(path));
  });
  const [script, styles] = await Promise.all([
    bundleCommunityFixture("tests/fixtures/weekly-pack-recovery.tsx"),
    Promise.all(
      packFixtureStyles.map((name) => readFile(`src/app/${name}.css`, "utf8")),
    ),
  ]);
  await page.goto(packFixtureOrigin + "/pack");
  await page.addStyleTag({ content: styles.join("\n") });
  await page.addScriptTag({ content: script });
  await expect(
    page.getByText("1 unopened pack", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".weekly-core-panel")
    .getByRole("button", { name: "Open Pack", exact: true })
    .click();
  await page.getByRole("button", { name: "Open pack seal" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    packOpeningMessages.WEEKLY_POOL_UNAVAILABLE,
  );
  await expect(page.getByText("private SQL must not reach the UI")).toHaveCount(
    0,
  );
  expect(attempts).toHaveLength(1);
  recovered = true;
  await page.getByRole("button", { name: "Open pack seal" }).click();
  await expect(page.locator(revealPhase)).toHaveAttribute(
    "data-pack-reveal-phase",
    "mystery",
  );
  await expect(page.getByText("Card 1 of 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(4);
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0].pack).toBe(receipt.id);
});
