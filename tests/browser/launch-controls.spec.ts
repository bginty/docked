import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test("public phone form preserves number on failure, requests no real SMS and fits mobile", async ({
  page,
}) => {
  const script = await bundleCommunityFixture(
    "tests/fixtures/launch-controls.tsx",
  );
  const css = (
    await Promise.all(
      [
        "brand-theme",
        "globals",
        "community-app",
        "mobile-app",
        "app-auth",
        "owner-command",
        "scoring",
        "owner-reference",
      ].map((f) => readFile(`src/app/${f}.css`, "utf8")),
    )
  ).join("\n");
  const requests: { action: string; phone: string; token?: string }[] = [];
  await page.route("http://127.0.0.1:4197/**", async (route) => {
    if (route.request().url().includes("/api/auth/phone")) {
      const body = route.request().postDataJSON();
      requests.push(body);
      await route.fulfill({
        status: requests.length === 1 ? 400 : 200,
        json:
          requests.length === 1
            ? { error: "Unable to send a code. Please try again." }
            : { ok: true, verified: false },
      });
    } else
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="fixture-root"></div><script>${script}</script></body></html>`,
      });
  });
  await page.goto("http://127.0.0.1:4197/phone");
  await page
    .getByLabel("Phone number, including country code")
    .fill("+61400000000");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to send");
  await expect(
    page.getByLabel("Phone number, including country code"),
  ).toHaveValue("+61400000000");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByLabel("Verification code")).toBeVisible();
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  expect(requests[2]).toEqual({
    action: "verify",
    phone: "+61400000000",
    token: "000000",
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/qa/v31-p1-p4-20261110/phone-${width}.png`,
      fullPage: true,
    });
  }
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test("owner incidents distinguish a recorded drill from actual email delivery", async ({
  page,
}) => {
  const script = await bundleCommunityFixture(
    "tests/fixtures/launch-controls.tsx",
  );
  const css = (
    await Promise.all(
      [
        "brand-theme",
        "globals",
        "owner-command",
        "scoring",
        "owner-reference",
      ].map((f) => readFile(`src/app/${f}.css`, "utf8")),
    )
  ).join("\n");
  await page.route("http://127.0.0.1:4197/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport"content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="fixture-root"></div><script>${script}</script></body></html>`,
    }),
  );
  await page.goto("http://127.0.0.1:4197/incidents");
  await expect(
    page.getByText("Email delivery disabled.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm inbox receipt" }),
  ).toBeDisabled();
  await page
    .getByLabel("Review evidence", { exact: false })
    .fill("Synthetic local evidence; no email sent");
  await expect(
    page.getByRole("button", { name: "Confirm inbox receipt" }),
  ).toBeEnabled();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/qa/v31-p1-p4-20261110/incidents-${width}.png`,
      fullPage: true,
    });
  }
});
