import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { previewPackReceipt } from "../../src/components/pack-opening-preview";
import { mountPackFixture, packFixtureMarkup } from "../fixtures/pack-browser";

const output = process.env.FOIL_QA_OUTPUT ?? "docs/qa/foil-pack-release-20261107";
for (const width of [320, 390, 1366]) {
  for (const [sport, premium] of [
    ["afl", false],
    ["nrl", true],
  ] as const) {
    test(`${sport} real sealed pack, one opening and nine-card summary at ${width}`, async ({
      page,
    }) => {
      await mkdir(output, { recursive: true });
      await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const receipt = previewPackReceipt(sport);
      let opened = 0;
      await page.route("**/*", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/receipt") return route.fulfill({ json: null });
        if (path === "/open-pack") {
          opened++;
          return route.fulfill({ json: receipt });
        }
        return route.fulfill(await packFixtureMarkup(path));
      });
      await mountPackFixture(page, true, {
        sport,
        premium,
        count: 9,
        name: `${sport.toUpperCase()} ${premium ? "Premium" : "Standard"} 9 Pack`,
      });
      const art = page.locator(".branded-seal .foil-pack-art");
      await expect(art).toHaveAttribute(
        "data-foil-variant",
        `${premium ? "PREMIUM" : "STANDARD"}:${sport}:9`,
      );
      expect(await art.innerText()).toBe("");
      expect(
        await art
          .locator("img")
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      ).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${output}/${sport}-real-opening-${width}.png`,
      });
      // A rapid second tap must not call the existing issuance callback again.
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .dblclick();
      await expect(
        page.getByRole("button", { name: "Reveal card", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Reveal All", exact: true })
        .click();
      await expect(page.locator(".pack-summary > li")).toHaveCount(9);
      expect(opened).toBe(1);
      expect(errors).toEqual([]);
    });
  }
}
