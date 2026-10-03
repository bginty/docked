import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { evidenceRoot } from "./evidence";

const output = path.join(evidenceRoot, "app-auth");
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

for (const width of [320, 412, 1366])
  test(`app account screens, autofill and accessible chrome at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    for (const route of [
      "login",
      "signup",
      "forgot-password",
      "check-email",
      "reset-password",
      "link-expired",
      "password-updated",
    ]) {
      await page.goto(`/app/${route}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".app-auth-content h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("body > .site-header")).toBeHidden();
      await expect(page.locator("body > footer")).toBeHidden();
      await expect(page.getByText("PREVIEW", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const violations = (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations;
      expect(violations).toEqual([]);
      await page.screenshot({
        path: path.join(output, `${route}-${width}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    await page.goto("/app/signup");
    await expect(
      page.getByRole("checkbox", { name: /Optional: send me/ }),
    ).not.toBeChecked();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    await page.goto("/app/login");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "autocomplete",
      "username",
    );
    await page.goto("/login");
    await expect(page.locator("body > .site-header")).toBeVisible();
  });

test("app signup checks confirmation locally and transmits separate opt-in consent", async ({
  page,
}) => {
  await page.goto("/app/signup");
  await expect(page.locator("form[data-api-ready=true]")).toBeVisible();
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/auth", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      json: { error: "Isolated UI test: no account created." },
    });
  });
  await page.getByLabel("Username", { exact: true }).fill("preview_ui_test");
  await page
    .getByLabel("Email", { exact: true })
    .fill("docked-preview-ui@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fictional-form-input-only");
  await page.getByLabel("Confirm password").fill("Fictional-mismatch-input");
  await page.getByLabel("Country code").fill("AU");
  await page.getByLabel("State / region").fill("VIC");
  await page.getByRole("checkbox", { name: /I am 18/ }).check();
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page.getByRole("checkbox", { name: /I accept the Privacy/ }).check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Passwords do not match.");
  expect(requests).toHaveLength(0);
  await page.getByLabel("Confirm password").fill("Fictional-form-input-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Isolated UI test: no account created.",
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    action: "signup",
    app: true,
    username: "preview_ui_test",
    age: true,
    terms: true,
    privacy: true,
    marketing: false,
  });
  expect(requests[0]).not.toHaveProperty("invitationCode");
});

test("app login and recovery handle service interruption without claiming success", async ({
  page,
}) => {
  await page.route("**/api/auth", (route) => route.abort("failed"));
  await page.goto("/app/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("docked-preview-ui@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fictional-form-input-only");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("cannot connect");
  await expect(page).toHaveURL(/\/app\/login$/);
  await page.goto("/app/forgot-password");
  await page
    .getByLabel("Email", { exact: true })
    .fill("docked-preview-ui@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("cannot connect");
  await expect(page).toHaveURL(/\/app\/forgot-password$/);
});
