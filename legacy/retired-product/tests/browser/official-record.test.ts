import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { evidenceRoot } from "./evidence";

for (const width of [360, 1366])
  test(`DEMO official forward record preserves complete outcomes and unknown states at ${width}px`, async ({
    page,
  }) => {
    const fixtures: Record<string, string> = JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "tests/fixtures/render-official-record.ts"],
        { encoding: "utf8" },
      ),
    );
    await mkdir(path.join(evidenceRoot, "official-record"), {
      recursive: true,
    });
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/api/**", (route) => route.abort());
    for (const state of ["empty", "restricted", "populated"]) {
      await page.setContent(
        `<!doctype html><html lang="en"><head><title>DEMO record presentation</title></head><body><main class="page"><h1>DEMO ONLY · Docked Record</h1><p>Fictional presentation fixture, never app data.</p>${fixtures[state]}</main></body></html>`,
      );
      for (const file of [
        "brand-theme.css",
        "globals.css",
        "sports-visuals.css",
        "sports-experience.css",
      ])
        await page.addStyleTag({ path: path.resolve("src/app", file) });
      if (state === "empty") {
        await expect(
          page.getByText("The record has not started yet.", { exact: true }),
        ).toHaveCount(2);
        await expect(page.locator("time")).toHaveCount(0);
      } else if (state === "restricted") {
        await expect(
          page.getByText("The record has not started yet.", { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator(".metric strong")).toHaveText(
          Array(12).fill("Unavailable"),
        );
      } else {
        await expect(page.locator('a[href^="/tips/test-only-"]')).toHaveCount(
          5,
        );
        await expect(
          page.getByRole("cell", { name: "LOST", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("cell", { name: "DISPUTED", exact: true }),
        ).toBeVisible();
        const ledger = page.getByRole("region", {
          name: "Complete official publication ledger",
        });
        await ledger.focus();
        await expect(ledger).toBeFocused();
        if (width === 360) {
          await page.keyboard.press("ArrowRight");
          await expect
            .poll(() => ledger.evaluate((el) => el.scrollLeft))
            .toBeGreaterThan(0);
        }
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      for (const value of await page.locator(".metric strong").all()) {
        expect(
          await value.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          }),
        ).toBe(1);
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: path.join(
          evidenceRoot,
          "official-record",
          `DEMO-${state}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
