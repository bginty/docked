import { test } from "@playwright/test";
import { LABELS } from "./guard";
import {
  account,
  check,
  expect,
  fixture,
  phase,
  preferences,
  rememberIdentity,
  verifyCapturedMail,
} from "./helpers";
for (const label of LABELS)
  test(`genuine signup verification and onboarding: ${label}`, async ({
    page,
  }) => {
    await fixture();
    const a = await account(label);
    phase(`signup-${label}`);
    await page.goto("/join");
    for (const name of ["digest", "education", "edgeAlerts", "analytics"])
      await expect(page.locator(`[name="${name}"]`)).not.toBeChecked();
    await page.locator('[name="email"]').fill(a.email);
    await page.locator('[name="password"]').fill(a.password);
    await page.locator('[name="country"]').selectOption(a.country);
    await page.locator('[name="state"]').fill(a.state);
    await page.locator('[name="age"]').check();
    await page.locator('[name="terms"]').check();
    const after = Date.now(),
      pending = page.waitForResponse(
        (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
      );
    await page.getByRole("button", { name: "Create free account" }).click();
    const response = await pending;
    check(
      response.status() === 200 && (await response.json()).ok === true,
      "signup-accepted-by-app",
    );
    await verifyCapturedMail(page, label, "signup", after);
    await rememberIdentity(page, label);
    await preferences(page);
    await expect(page).toHaveURL(/\/home$/);
    const data = await rememberIdentity(page, label);
    check(!!data.profile.onboarding_completed_at, "onboarding-persisted");
    check(data.profile.timezone === "Australia/Sydney", "timezone-persisted");
  });
