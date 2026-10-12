import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { previewReceipt } from "../../src/components/pack-opening-preview";
test("cinematic timing, background interruption and visual recording", async ({
  browser,
}) => {
  await mkdir("docs/qa/economy-v2/visual-recording", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    recordVideo: {
      dir: "docs/qa/economy-v2/visual-recording",
      size: { width: 412, height: 915 },
    },
  });
  const page = await context.newPage();
  let opens = 0;
  await page.route("**/*", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/receipt") return route.fulfill({ json: null });
    if (p === "/open-pack") {
      opens++;
      return route.fulfill({ json: previewReceipt });
    }
    if (p.startsWith("/brand/"))
      return route.fulfill({
        body: await readFile("public" + p),
        contentType: p.endsWith(".png") ? "image/png" : "image/webp",
      });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><title>Docked simulated reveal</title><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("https://fixture.invalid");
  for (const n of [
    "brand-theme",
    "globals",
    "fantasy",
    "fantasy-play",
    "pack-opening",
  ])
    await page.addStyleTag({
      content: await readFile(`src/app/${n}.css`, "utf8"),
    });
  await page.addScriptTag({
    content: await bundleCommunityFixture("tests/fixtures/pack-opening.tsx"),
  });
  await page.getByRole("button", { name: "Open viewer" }).click();
  await page.getByRole("button", { name: "Open pack seal" }).click();
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "docs/qa/economy-v2/cinematic-tunnel.png" });
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "docs/qa/economy-v2/cinematic-burst.png" });
  await expect(page.getByRole("button", { name: "Reveal next" })).toBeVisible({
    timeout: 5000,
  });
  await page.screenshot({ path: "docs/qa/economy-v2/cinematic-readable.png" });
  await page.getByRole("button", { name: "Reveal next" }).click();
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal all", exact: true }).click();
  await page
    .getByRole("button", { name: "Replay saved result · no new cards" })
    .click();
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByRole("button", { name: "Reveal next" })).toBeVisible();
  expect(opens).toBe(1);
  await context.close();
  await page
    .video()!
    .saveAs("docs/qa/economy-v2/Docked-v21-simulated-visual-preview.webm");
});
