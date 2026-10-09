import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

// Actual component and application styles; no credentials, sessions or backend.
const cssFiles = [
  ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
    /import "\.\/(.+\.css)"/g,
  ),
].map((match) => match[1]);
const css = cssFiles
  .map((file) => readFileSync(`src/app/${file}`, "utf8"))
  .join("\n");
const output = `${process.env.DOCKED_QA_ROOT ?? "docs/qa/fantasy-cleanup"}/owner-setup`;
for (const verified of [false, true]) {
  for (const width of [320, 390, 1366]) {
    test(`owner setup ${verified ? "verified" : "MFA required"} at ${width}px`, async ({
      page,
    }) => {
      const html = execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "-e",
          `
        const React = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        const { OwnerSetupStatus } = require('./src/components/owner-setup-status.tsx');
        process.stdout.write(renderToStaticMarkup(React.createElement(OwnerSetupStatus, { verifiedMfaSession: ${verified} })));
      `,
        ],
        { encoding: "utf8" },
      );
      await page.route("**/*", (route) => route.abort());
      await page.setViewportSize({ width, height: 915 });
      await page.setContent(
        `<html><head><style>${css}</style></head><body><main><section class="app-auth-surface"><div class="app-auth-content">${html}</div></section></main></body></html>`,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        verified ? "Owner sign-in complete" : "Secure your Docked account",
      );
      if (verified) {
        await expect(page.getByRole("status")).toContainText(
          "you will stay here after MFA",
        );
        await expect(
          page.getByRole("link", { name: "Set up or verify MFA" }),
        ).toHaveCount(0);
      } else {
        await expect(
          page.getByRole("link", { name: "Set up or verify MFA" }),
        ).toHaveAttribute("href", "/mfa");
      }
      const geometry = await page
        .locator(".app-owner-setup > *")
        .evaluateAll((items) =>
          items.map((item) => {
            const rect = item.getBoundingClientRect();
            return {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            };
          }),
        );
      for (let index = 1; index < geometry.length; index++) {
        expect(
          geometry[index].top - geometry[index - 1].bottom,
        ).toBeGreaterThanOrEqual(19);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("link", { name: "View the approved beta policies" }),
      ).toHaveAttribute("href", "/beta-policies");
      mkdirSync(output, { recursive: true });
      await page.screenshot({
        path: `${output}/owner-setup-${verified ? "verified" : "mfa"}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
