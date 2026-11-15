import { test, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test.use({ channel: "chrome" });
const member = "f4a50000-0000-4000-8000-000000000001";
test("lost grant response survives reload; retry uses identical request and confirmed grant survives refresh failure", async ({
  page,
}) => {
  const bundle = await bundleCommunityFixture(
    "tests/fixtures/founder-credit-panel.tsx",
  );
  const submissions: any[] = [];
  let applied = 0;
  let failRefresh = false;
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === "/api/admin/founder-credits") {
      if (req.method() === "GET")
        return route.fulfill({
          status: failRefresh ? 503 : 200,
          json: {
            members: [{ id: member, label: "Invited fixture" }],
            remaining: 100000 - applied,
          },
        });
      const value = req.postDataJSON();
      submissions.push(value);
      if (submissions.length === 1) {
        applied += value.amount;
        return route.abort("failed");
      }
      expect(value).toEqual(submissions[0]);
      failRefresh = true;
      return route.fulfill({ json: { issued: true, request: value.request } });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Isolated founder credits</title></head><body><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("http://localhost:3000/founder-credit-fixture");
  await page.addScriptTag({ content: bundle });
  await page
    .getByRole("combobox", { name: "Member", exact: true })
    .selectOption(member);
  await page.getByLabel("Credits", { exact: true }).fill("5000");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Founder-approved free beta test credits");
  const submit = page.getByRole("button", {
    name: "Issue free credits",
    exact: true,
  });
  await submit.click();
  expect(submissions).toHaveLength(0);
  await page.getByRole("checkbox").check();
  await submit.click();
  await expect(page.getByRole("status")).toContainText(
    "has not been confirmed",
  );
  await expect(submit).toBeDisabled();
  await page.reload();
  await page.addScriptTag({ content: bundle });
  await expect(
    page.getByRole("button", { name: "Retry saved issuance request" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry saved issuance request" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "5,000 free Docked Credits issued",
  );
  await expect(page.getByRole("status")).toContainText("Reload to refresh");
  expect(submissions).toHaveLength(2);
  expect(applied).toBe(5000);
  await expect(
    page.getByRole("button", { name: "Retry saved issuance request" }),
  ).toHaveCount(0);
});
