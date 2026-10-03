import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";
import type { EnvironmentPresentation } from "../../src/components/environment-context";

declare global {
  interface Window {
    renderEnvironmentFixture: (
      environment: EnvironmentPresentation,
      view: "signup" | "recover" | "shell",
    ) => void;
  }
}

let bundle = "";
const closed: EnvironmentPresentation = {
  production: true,
  accountConfigured: true,
  registrationAvailable: false,
  emailAvailable: false,
  invitationAllowed: false,
  policyVersions: null,
  reason: "Account verification and recovery email are not enabled.",
};
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture(
    "tests/fixtures/production-presentation.tsx",
  );
  await mkdir(path.join(evidenceRoot, "production-presentation"), {
    recursive: true,
  });
});

for (const width of [320, 412, 1366])
  test(`production account readiness and environment chrome at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    const apiRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    // Every request is fulfilled locally. No signup, provider, hosting or mail call is made.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) {
        apiRequests.push(url.pathname);
        return route.fulfill({
          status: 200,
          json: { message: "Fixture accepted; no real account created." },
        });
      }
      if (url.pathname === "/presentation-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Isolated production presentation</title></head><body><main id="fixture-root"></main></body></html>',
        });
      const directory = path.resolve("public");
      const file = path.resolve(directory, `.${url.pathname}`);
      if (!file.startsWith(directory + path.sep)) return route.abort();
      try {
        return route.fulfill({
          body: await readFile(file),
          contentType: file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "font/woff2",
        });
      } catch {
        return route.abort();
      }
    });
    // An intercepted non-secure fixture origin keeps service-worker lifecycle
    // outside this component test; native/PWA behaviour has its own suite.
    await page.goto("http://presentation.example.invalid/presentation-fixture");
    for (const css of [
      "brand-theme.css",
      "globals.css",
      "community-app.css",
      "native.css",
      "mobile-app.css",
      "app-auth.css",
    ])
      await page.addStyleTag({ path: path.resolve("src/app", css) });
    await page.addStyleTag({
      content:
        ".fixture-label{margin:0;background:#0c1220;color:white;font-size:12px;padding:8px}",
    });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(
      (value) => window.renderEnvironmentFixture(value, "signup"),
      closed,
    );
    await expect(page.locator("form")).toHaveAttribute(
      "data-api-ready",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
    await expect(page.getByText("PREVIEW", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "I have a Preview invitation" }),
    ).toHaveCount(0);
    await expect(page.getByText(closed.reason!, { exact: true })).toBeVisible();
    for (const name of ["age", "terms", "privacy", "marketing"])
      await expect(page.locator(`input[name=${name}]`)).not.toBeChecked();
    await expect(page.locator("input[name=privacy]")).toHaveAttribute(
      "required",
      "",
    );
    await page
      .locator("form")
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
    expect(apiRequests).toEqual([]);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(
        evidenceRoot,
        "production-presentation",
        `ISOLATED-signup-closed-${width}.png`,
      ),
      fullPage: true,
    });
    await page.evaluate(
      (value) => window.renderEnvironmentFixture(value, "recover"),
      closed,
    );
    await expect(
      page.getByRole("button", { name: "Send reset link" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Account email is not enabled. No message will be sent."),
    ).toBeVisible();
    await page.evaluate(
      (value) => window.renderEnvironmentFixture(value, "shell"),
      closed,
    );
    await expect(page.locator(".app-preview-label")).toHaveCount(0);
    await expect(
      page.getByText("Research validation pending.", { exact: false }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(
      (value) =>
        window.renderEnvironmentFixture(
          { ...value, production: false, invitationAllowed: true },
          "signup",
        ),
      closed,
    );
    await expect(page.getByText("PREVIEW", { exact: true })).toBeVisible();
    await page
      .getByRole("checkbox", { name: "I have a Preview invitation" })
      .check();
    await expect(page.getByLabel("Private invitation code")).toBeVisible();
    await page.evaluate(
      (value) =>
        window.renderEnvironmentFixture(
          {
            ...value,
            registrationAvailable: true,
            emailAvailable: true,
            policyVersions: {
              terms: "fixture-terms",
              privacy: "fixture-privacy",
            },
            reason: null,
          },
          "signup",
        ),
      closed,
    );
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeEnabled();
    await expect(page.getByLabel("Private invitation code")).toHaveCount(0);
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
