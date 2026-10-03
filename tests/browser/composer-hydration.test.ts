import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { bundleCommunityFixture } from "../fixtures/bundle-community";

let html = "",
  bundle = "";
test.beforeAll(async () => {
  // Render the actual server component tree before supplying any client script.
  html = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `
    const React = require('react'); global.React = React;
    const {renderToString} = require('react-dom/server');
    const {AppRouterContext} = require('next/dist/shared/lib/app-router-context.shared-runtime');
    const {SocialComposer} = require('./src/components/social-composer.tsx');
    process.stdout.write(renderToString(React.createElement(AppRouterContext.Provider, {value:{}}, React.createElement(SocialComposer,{previewFixtures:true}))));
  `,
    ],
    { encoding: "utf8" },
  );
  bundle = await bundleCommunityFixture(
    "tests/fixtures/composer-hydration.tsx",
  );
});

test("composer mode controls stay disabled until the real server markup hydrates", async ({
  page,
}) => {
  const errors: string[] = [],
    writes: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") writes.push(request.method());
    if (request.url().includes("/api/"))
      return route.fulfill({
        json: {
          status: "NOT_CONFIGURED",
          message: "DEMO only; no real providers",
          options: [],
          records: [],
        },
      });
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DEMO composer hydration only</title></head><body><p>DEMO: no account or real submissions.</p><main id="composer-root">${html}</main></body></html>`,
    });
  });
  await page.goto("http://localhost:3000/composer-hydration-fixture");
  for (const name of ["Post Edge", "Create post", "DEMO Edge flow"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(page.locator("[data-composer-ready]")).toHaveAttribute(
    "data-composer-ready",
    "false",
  );
  await page
    .getByRole("button", { name: "Create post", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('[name="kind"]')).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("[data-composer-ready]")).toHaveAttribute(
    "data-composer-ready",
    "true",
  );
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Post type", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "DEMO Edge flow", exact: true })
    .click();
  await expect(page.locator(".preview-fixture-composer")).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { composerHydrationErrors: string[] })
          .composerHydrationErrors,
    ),
  ).toEqual([]);
});
