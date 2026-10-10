import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/mfa-form.tsx");
});
for (const width of [320, 390, 1366])
  test(`MFA QR, code paste and no factor-ID field at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const actions: string[] = [];
    await page.route("**/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/mfa-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<html><head><title>MFA fixture</title></head><body><main id="fixture-root"></main></body></html>',
        });
      if (path === "/api/auth") {
        const p = route.request().postDataJSON();
        actions.push(p.action);
        expect(p.factorId).toBeUndefined();
        if (p.action === "mfa_status")
          return route.fulfill({ json: { ok: true, mode: "enroll" } });
        if (p.action === "mfa_enroll")
          return route.fulfill({
            json: {
              ok: true,
              mode: "enroll-code",
              qrCode:
                "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/></svg>',
                ),
              setupKey: "LOCAL-FIXTURE-ONLY",
            },
          });
        expect(p.code).toBe("123456");
        return route.fulfill({ json: { ok: true, redirect: "/app" } });
      }
      return route.abort();
    });
    await page.goto("/mfa-fixture");
    await page.addStyleTag({
      content: readFileSync("src/app/app-auth.css", "utf8"),
    });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await expect(page.getByRole("img")).toBeVisible();
    await page.getByText("Can’t scan? Use the manual setup key").click();
    await expect(page.getByText("LOCAL-FIXTURE-ONLY")).toBeVisible();
    await expect(page.locator('input[name="factorId"]')).toHaveCount(0);
    const input = page.getByLabel("Authenticator code");
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await input.evaluate((element) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text", "123 456");
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(input).toHaveValue("123456");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    mkdirSync("docs/qa/two-person-beta", { recursive: true });
    await page.screenshot({
      path: `docs/qa/two-person-beta/mfa-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).demoNavigation))
      .toBe("/app");
    expect(actions).toEqual(["mfa_status", "mfa_enroll", "mfa_verify"]);
  });
