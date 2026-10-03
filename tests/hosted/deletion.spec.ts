import { test } from "@playwright/test";
import {
  api,
  check,
  expect,
  fixture,
  login,
  rememberIdentity,
} from "./helpers";
test("export then deletion revokes an already genuine second session", async ({
  page,
  browser,
}) => {
  const f = await fixture();
  check(f.capabilities.deleteAccounts, "explicit-test-account-erasure-scope");
  await login(page, "memberA");
  await rememberIdentity(page, "memberA", "recovered");
  const second = await browser.newContext(),
    other = await second.newPage();
  await login(other, "memberA");
  check(
    (await api(other, "/api/member")).status === 200,
    "second-genuine-session-active",
  );
  await page.goto("/dashboard");
  await page.locator('[name="confirm"]').fill("DELETE");
  const result = page.waitForResponse(
    (r) => r.url().endsWith("/api/member") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Delete my account" }).click();
  const response = await result;
  check(
    [200, 202].includes(response.status()) &&
      (await response.json()).ok === true,
    "account-revocation-confirmed",
  );
  await expect(page).toHaveURL("http://localhost:3000/");
  check(
    (await api(other, "/api/member")).status === 401,
    "existing-session-export-revoked",
  );
  check(
    (
      await api(other, "/api/community", {
        action: "profile",
        handle: f.accounts.memberA.handle,
        displayName: "Revoked probe",
        bio: "Must not be saved",
        visibility: "members",
      })
    ).status === 403,
    "existing-session-write-revoked",
  );
  await second.close();
});
