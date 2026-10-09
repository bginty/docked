import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";

let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/data-health-demo.tsx");
  await mkdir(path.join(evidenceRoot, "data-health"), { recursive: true });
});

for (const width of [360, 412, 1366])
  test(`admin data health contains not-configured tokens and complete long diagnostics at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/api/**", (route) => route.abort());
    await page.goto("/offline.html", { waitUntil: "domcontentloaded" });
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>DEMO data health layout</title></head><body><main id="demo-root"></main></body></html>',
    );
    for (const file of [
      "brand-theme.css",
      "globals.css",
      "sports-visuals.css",
      "sports-experience.css",
      "community-app.css",
      "native.css",
      "mobile-app.css",
      "beta-experience.css",
      "phase5-edges.css",
    ])
      await page.addStyleTag({ path: path.resolve("src/app", file) });
    await page.addScriptTag({ content: bundle });
    for (const populated of [false, true, "approved", "unavailable"] as const) {
      await page.evaluate(
        (value) =>
          (
            window as unknown as {
              renderDataHealthFixture: (
                value: boolean | "approved" | "unavailable",
              ) => void;
            }
          ).renderDataHealthFixture(value),
        populated,
      );
      await expect(
        page.getByRole("heading", { name: "Know what the feed can support." }),
      ).toBeVisible();
      await expect(
        page.getByText(/RESULTS_PROVIDER_STATUS=NOT_CONFIGURED/),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Open scanner review" }),
      ).toHaveAttribute("href", "/admin/edge-scanner");
      if (populated === true) {
        const hash = "abcdef0123456789".repeat(4);
        await expect(
          page.getByText(`DEMO-reviewed-configuration-${hash}`, {
            exact: false,
          }),
        ).toBeVisible();
        const measurement = page.locator("pre.safe-json").last();
        await expect(measurement).toContainText(
          `"configurationHash": "${hash}"`,
        );
        // A diagnostic record must occupy less than half this viewport, while
        // complete hashes remain readable in the keyboard-scrollable table.
        expect(
          (await page.locator("tbody tr").boundingBox())!.height,
        ).toBeLessThan(page.viewportSize()!.height / 2);
        const table = page.getByRole("region", {
          name: "Recent provider poll attempts",
        });
        await table.focus();
        await expect(table).toBeFocused();
        if (width <= 760) {
          expect(
            await table.evaluate((el) => el.scrollWidth > el.clientWidth),
          ).toBe(true);
          await page.keyboard.press("ArrowRight");
          await expect
            .poll(() => table.evaluate((el) => el.scrollLeft))
            .toBeGreaterThan(0);
        }
      } else
        await expect(
          page.getByRole("heading", {
            name: "No recorded provider health measurements",
          }),
        ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "The Odds API · controlled Preview trial",
        }),
      ).toBeVisible();
      if (populated === false)
        await expect(
          page.getByText("PENDING_RIGHTS", { exact: true }),
        ).toBeVisible();
      if (populated === "approved") {
        await expect(
          page.getByText("APPROVED_FOR_PREVIEW_TRIAL", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(
            "No request is recorded in the trial ledger. Account quota has not been inferred.",
          ),
        ).toBeVisible();
        await expect(
          page.getByText("NOT_TESTED", { exact: true }),
        ).toBeVisible();
      }
      if (populated === "unavailable")
        await expect(
          page.getByText(
            "Request history unavailable. No request or credit total is inferred.",
          ),
        ).toBeVisible();
      if (populated === true) {
        await page
          .getByText("DEMO selection · Reference unavailable", { exact: true })
          .click();
        await expect(
          page.getByText("DEMO-reference-v1", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("DEMO_QUOTA_EXHAUSTED", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("DEMO Harbour vs DEMO City", { exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByText(/MODEL_PROBABILITY_UNAVAILABLE/),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: path.join(
          evidenceRoot,
          "data-health",
          `DEMO-${typeof populated === "string" ? populated : populated ? "long-diagnostics" : "not-configured"}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
