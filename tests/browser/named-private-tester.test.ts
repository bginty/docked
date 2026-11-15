import { test, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { namedTesterNoticeVersion } from "../../src/core/named-private-tester";
import { readFile, mkdir } from "node:fs/promises";
for (const width of [390, 1440])
  test(`personal US invitation is accurate and requires own consent at ${width}px`, async ({
    page,
  }) => {
    const bundle = await bundleCommunityFixture(
      "tests/fixtures/named-private-tester.tsx",
    );
    const submitted: Record<string, unknown>[] = [];
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", async (route) => {
      if (
        new URL(route.request().url()).pathname === "/api/auth/invitation-setup"
      ) {
        submitted.push(route.request().postDataJSON());
        return route.fulfill({
          status: 200,
          json: { message: "Isolated consent saved" },
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>Private testing invitation fixture</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
      });
    });
    await page.goto("http://localhost:3000/named-tester-fixture");
    for (const name of ["brand-theme", "globals", "app-auth", "fantasy"])
      await page.addStyleTag({
        content: await readFile(`src/app/${name}.css`, "utf8"),
      });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByLabel("Country code", { exact: true })).toHaveValue(
      "US",
    );
    await expect(
      page.getByLabel("Country code", { exact: true }),
    ).toHaveAttribute("readonly", "");
    await expect(
      page.getByLabel("State / region", { exact: true }),
    ).toHaveValue("CA");
    await expect(
      page.getByRole("heading", { name: "Your private testing invitation" }),
    ).toBeVisible();
    await page.getByLabel("Display name", { exact: true }).fill("BrentonTest");
    const submit = page.getByRole("button", { name: "Complete account setup" });
    await submit.click();
    expect(submitted).toHaveLength(0);
    await page.getByRole("checkbox", { name: /18 or older/ }).check();
    await page
      .getByRole("checkbox", { name: /^I accept the Terms\s*\.$/ })
      .check();
    await page
      .getByRole("checkbox", { name: /^I accept the Privacy Policy\s*\.$/ })
      .check();
    await page
      .getByRole("checkbox", { name: /free beta participation/ })
      .check();
    await submit.click();
    expect(submitted).toHaveLength(0);
    await page
      .getByRole("checkbox", { name: /personal private testing exception/ })
      .check();
    await submit.click();
    await expect(page.getByText("Isolated consent saved")).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      country: "US",
      state: "CA",
      age: true,
      terms: true,
      privacy: true,
      betaRules: true,
      namedTesterRules: true,
      namedTesterVersion: namedTesterNoticeVersion,
    });
    for (const key of ["email", "password", "userId", "role", "credits"])
      expect(submitted[0]).not.toHaveProperty(key);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await mkdir("docs/qa/brenton-private-tester-20261115", { recursive: true });
    await page.screenshot({
      path: `docs/qa/brenton-private-tester-20261115/consent-${width}.png`,
      fullPage: true,
    });
  });
