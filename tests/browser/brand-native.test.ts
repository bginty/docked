import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const shells: [string, string][] = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {renderOfflineShell,renderPublicOfflineShell} from './scripts/build-mobile-shell.mjs';process.stdout.write(JSON.stringify([['native-offline',renderOfflineShell({mode:'hosted',entryUrl:'https://preview.example.test/home'})],['pwa-offline',renderPublicOfflineShell()]]));`,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  ),
);

// Static offline document verification only: no app request, account or provider.
for (const width of [390, 1366]) {
  test(`approved offline branding remains readable and self-contained at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    for (const [name, html] of shells) {
      await page.setContent(html);
      await expect(page.getByRole("img", { name: "Docked" })).toBeVisible();
      expect(
        await page
          .getByRole("img", { name: "Docked" })
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 1600,
          ),
      ).toBe(true);
      await expect(
        page.getByText("BUILT FOR AN EDGE", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      mkdirSync("docs/qa/edge-signal-brand/native", { recursive: true });
      await page.screenshot({
        path: `docs/qa/edge-signal-brand/native/${name}-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]);
  });
}
