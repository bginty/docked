import { test } from "@playwright/test";
import {
  account,
  captureCheckpoint,
  api,
  check,
  expect,
  fixture,
  login,
  logout,
  paceSharedAuth,
  rememberIdentity,
  verifyCapturedMail,
} from "./helpers";
test("real login private export pause recovery and password replacement", async ({
  page,
  browser,
}) => {
  test.setTimeout(480000);
  await fixture();
  const a = await account("memberA");
  await login(page, "memberA");
  const guest = await browser.newContext();
  check(
    (await guest.request.get("http://localhost:3000/api/member")).status() ===
      401,
    "anonymous-export-denied",
  );
  await guest.close();
  await page.locator('#preferences [name="paused"]').check();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/member") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save preferences" }).click();
  check((await saved).status() === 200, "pause-saved");
  check(
    (await rememberIdentity(page, "memberA")).preferences[0].paused === true,
    "pause-persisted",
  );
  await logout(page);
  await page.goto("/recover");
  await page.locator('[name="email"]').fill(a.email);
  const after = await captureCheckpoint(page),
    sent = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
    );
  await page
    .getByRole("button", { name: "Send recovery instructions" })
    .click();
  check((await sent).status() === 200, "recovery-request");
  await verifyCapturedMail(page, "memberA", "recovery", after);
  await paceSharedAuth(page);
  await page.locator('[name="password"]').fill(a.recoveryPassword);
  const reset = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Update password" }).click();
  check((await reset).status() === 200, "password-update");
  await expect(page).toHaveURL(/\/dashboard$/);
  await rememberIdentity(page, "memberA", "recovered");
  await logout(page);
  await login(page, "memberA");
  check((await api(page, "/api/member")).status === 200, "recovered-session");
});

test("real one-click unsubscribe without delivery", async ({ page }) => {
  const a = await account("memberA");
  test.skip(
    !a.unsubscribeToken,
    "BLOCKED: legitimate-no-delivery-unsubscribe-token-missing",
  );
  await page.goto(
    `/unsubscribe?token=${encodeURIComponent(a.unsubscribeToken!)}`,
  );
  await page
    .getByRole("button", { name: "Pause all optional messages" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "All optional communications paused",
  );
});
