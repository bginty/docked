import { test, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test("native owner consent renewal remains on MFA through resume and verifies existing factor", async ({
  page,
}) => {
  const bundle = await bundleCommunityFixture(
    "tests/fixtures/native-mfa-renewal.tsx",
  );
  let sessionRequests = 0;
  const actions: string[] = [];
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/app-session") {
      sessionRequests++;
      return route.fulfill({ json: { authenticated: false } });
    }
    if (path === "/api/auth") {
      const body = route.request().postDataJSON();
      actions.push(body.action);
      expect(body.factorId).toBeUndefined();
      if (body.action === "mfa_status")
        return route.fulfill({ json: { ok: true, mode: "challenge" } });
      expect(body.action).toBe("mfa_verify");
      expect(body.code).toBe("123456");
      return route.fulfill({ json: { ok: true, redirect: "/app" } });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<html lang="en"><title>Native MFA regression</title><body><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("https://fixture.invalid/mfa");
  await page.evaluate(() =>
    Object.assign(window, {
      demoPath: "/mfa",
      Capacitor: { isNativePlatform: () => true },
    }),
  );
  await page.addScriptTag({ content: bundle });
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("docked-app-resume")),
  );
  await page.waitForTimeout(300);
  expect(sessionRequests).toBe(0);
  expect(
    await page.evaluate(() => (window as any).demoNavigation),
  ).toBeUndefined();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).demoNavigation))
    .toBe("/app");
  expect(actions).toEqual(["mfa_status", "mfa_verify"]);
});
