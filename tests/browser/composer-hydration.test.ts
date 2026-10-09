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
    const {HydrationView} = require('./tests/fixtures/hydration-view.tsx');
    process.stdout.write(renderToString(React.createElement(AppRouterContext.Provider, {value:{}}, React.createElement(HydrationView))));
  `,
    ],
    { encoding: "utf8" },
  );
  bundle = await bundleCommunityFixture(
    "tests/fixtures/composer-hydration.tsx",
  );
});

test("social and profile action buttons are inert before hydration and preserve their scoped handlers afterwards", async ({
  page,
}) => {
  const writes: { action: string; postId?: string; profileId?: string }[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().url().includes("/api/"))
      return route.fulfill({
        json: {
          status: "NOT_CONFIGURED",
          message: "DEMO only",
          options: [],
          records: [],
        },
      });
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DEMO social hydration</title></head><body><main id="composer-root">${html}</main></body></html>`,
    });
  });
  await page.goto("http://localhost:3000/social-hydration-fixture");
  const social = page.locator("#social-fixture"),
    profile = page.locator("#profile-fixture");
  for (const name of [/reactions$/, /comments$/, /^Save$/, /^Share$/])
    await expect(social.getByRole("button", { name })).toBeDisabled();
  await expect(
    profile.getByRole("button", { name: "Follow", exact: true }),
  ).toBeDisabled();
  await profile.locator("summary").click();
  for (const name of ["Mute", "Block"])
    await expect(
      profile.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await social
    .getByRole("button", { name: /reactions$/ })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await profile
    .getByRole("button", { name: "Follow", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  expect(writes).toEqual([]);
  await page.addScriptTag({ content: bundle });
  await expect(social.locator("[data-social-ready]")).toHaveAttribute(
    "data-social-ready",
    "true",
  );
  await expect(profile.locator("[data-profile-actions-ready]")).toHaveAttribute(
    "data-profile-actions-ready",
    "true",
  );
  await social.getByRole("button", { name: /reactions$/ }).click();
  await expect.poll(() => writes.length).toBe(1);
  await social.getByRole("button", { name: "Save", exact: true }).click();
  await profile.getByRole("button", { name: "Follow", exact: true }).click();
  await profile.getByRole("button", { name: "Mute", exact: true }).click();
  await profile.getByRole("button", { name: "Block", exact: true }).click();
  await expect.poll(() => writes.length).toBe(5);
  expect(writes.map((write) => write.action)).toEqual([
    "react",
    "save",
    "follow",
    "mute",
    "block",
  ]);
  expect(
    writes
      .slice(0, 2)
      .every(
        (write) => write.postId === "d0000000-0000-4000-8000-000000000002",
      ),
  ).toBe(true);
  expect(
    writes
      .slice(2)
      .every(
        (write) => write.profileId === "d0000000-0000-4000-8000-000000000001",
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { composerHydrationErrors: string[] })
          .composerHydrationErrors,
    ),
  ).toEqual([]);
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
  await expect(
    page.getByRole("button", { name: "Publish social post" }),
  ).toBeDisabled();
  await expect(page.locator("[name=kind]")).toBeDisabled();
  await expect(page.locator("[data-composer-ready]")).toHaveAttribute(
    "data-composer-ready",
    "false",
  );
  expect(writes).toEqual([]);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("[data-composer-ready]")).toHaveAttribute(
    "data-composer-ready",
    "true",
  );
  await expect(
    page.getByRole("combobox", { name: "Post type", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Post Edge", exact: true }),
  ).toHaveCount(0);
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
