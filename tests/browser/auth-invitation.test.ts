import { test, expect } from "@playwright/test";
import { invitationRequest } from "../../src/core/auth-invitation";
import { bundleCommunityFixture } from "../fixtures/bundle-community";

for (const width of [390, 1440])
  test(`invitation confirmation requires a click and handles replay at ${width}px`, async ({
    page,
  }) => {
    const origin = "http://localhost:3000";
    let confirmations = 0;
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/auth/invite**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        expect(request.headers().origin).toBe(origin);
        expect(request.headers().referer).not.toContain("token_hash");
      }
      const response = await invitationRequest(
        new Request(request.url(), {
          method: request.method(),
          headers: request.headers(),
          ...(request.method() === "POST" ? { body: request.postData() } : {}),
        }),
        {
          enabled: true,
          siteUrl: origin,
          verify: async () => {
            confirmations++;
            return confirmations === 1 ? "confirmed" : "invalid";
          },
        },
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
    const url =
      origin + "/auth/invite?type=invite&token_hash=" + "a".repeat(64);
    await page.goto(url);
    await page.reload();
    expect(confirmations).toBe(0);
    await expect(
      page.getByRole("button", { name: "Confirm my invitation" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.getByRole("button", { name: "Confirm my invitation" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Choose a new password",
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(origin + "/app/reset-password");
    expect(confirmations).toBe(1);
    await page.goto(url);
    await page.getByRole("button", { name: "Confirm my invitation" }).click();
    await expect(
      page.getByText(
        "This invitation is invalid, expired or already used. Contact support for help.",
      ),
    ).toBeVisible();
    expect(confirmations).toBe(2);
  });

test("invited setup requires explicit consents and submits no email, password or invitation-code override", async ({
  page,
}) => {
  const bundle = await bundleCommunityFixture(
    "tests/fixtures/invitation-setup.tsx",
  );
  const submitted: Record<string, unknown>[] = [];
  await page.route("**/*", async (route) => {
    if (
      new URL(route.request().url()).pathname === "/api/auth/invitation-setup"
    ) {
      submitted.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        json: { message: "Authored fixture saved" },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Invitation setup fixture</title></head><body><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("http://localhost:3000/invitation-setup-fixture");
  await page.addScriptTag({ content: bundle });
  await page.getByLabel("Username", { exact: true }).fill("InvitedFriend");
  await page.getByLabel("Country code", { exact: true }).fill("AU");
  await page.getByLabel("State / region", { exact: true }).fill("VIC");
  const submit = page.getByRole("button", { name: "Complete account setup" });
  await submit.click();
  expect(submitted).toHaveLength(0);
  await page.getByRole("checkbox", { name: /18 or older/ }).check();
  await page.getByRole("checkbox", { name: "I accept the Terms." }).check();
  await page
    .getByRole("checkbox", { name: "I accept the Privacy Policy." })
    .check();
  await submit.click();
  await expect(page.getByText("Authored fixture saved")).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({
    age: true,
    terms: true,
    privacy: true,
    marketing: false,
  });
  for (const field of [
    "email",
    "password",
    "invitationCode",
    "user_id",
    "role",
  ])
    expect(submitted[0]).not.toHaveProperty(field);
});
