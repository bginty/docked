import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { bundleCommunityFixture } from "../fixtures/bundle-community";

let html = "",
  bundle = "";
test.beforeAll(async () => {
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
    const {AuthFormHydrationView} = require('./tests/fixtures/auth-form-hydration-view.tsx');
    process.stdout.write(renderToString(React.createElement(AppRouterContext.Provider,{value:{}},React.createElement(AuthFormHydrationView))));
  `,
    ],
    { encoding: "utf8" },
  );
  bundle = await bundleCommunityFixture(
    "tests/fixtures/auth-form-hydration.tsx",
  );
});
function documentHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated account hydration</title></head><body><main id="auth-form-fixture">${html}</main><script defer src="/hydration-fixture.js"></script></body></html>`;
}

const fictionalEmail = "docked-preview-hydration-test@example.invalid";
const fictionalPassword = "fictional-hydration-regression-only";

test("authentication waits for hydration and submits exactly one JSON request", async ({
  page,
}) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  const submissions: Array<{
    method: string;
    search: string;
    contentType: string;
    body: string;
  }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname === "/api/auth" || url.searchParams.has("password")) {
      submissions.push({
        method: request.method(),
        search: url.search,
        contentType: request.headers()["content-type"] ?? "",
        body: request.postData() ?? "",
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Fictional submission intercepted." }),
      });
    }
    if (url.pathname === "/hydration-fixture.js") {
      await scriptsReady;
      return route.fulfill({
        contentType: "application/javascript",
        body: bundle,
      });
    }
    return route.fulfill({ contentType: "text/html", body: documentHtml() });
  });
  try {
    await page.goto("/login", { waitUntil: "commit" });
    const form = page
      .locator("form")
      .filter({ has: page.locator('[name="password"]') });
    const submit = form.getByRole("button", { name: "Log in", exact: true });
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/api/auth");
    await expect(form).toHaveAttribute("data-api-ready", "false");
    await expect(submit).toBeDisabled();
    await form.locator('[name="email"]').fill(fictionalEmail);
    await form.locator('[name="password"]').fill(fictionalPassword);
    await submit.evaluate((button) => (button as HTMLButtonElement).click());
    await form.locator('[name="password"]').press("Enter");
    await page.waitForTimeout(200);
    expect(submissions).toHaveLength(0);
    expect(new URL(page.url()).search).toBe("");
    releaseScripts();
    await expect(form).toHaveAttribute("data-api-ready", "true");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(form.getByRole("status")).toHaveText(
      "Fictional submission intercepted.",
    );
    expect(submissions).toHaveLength(1);
    expect(submissions[0].method).toBe("POST");
    expect(submissions[0].search).toBe("");
    expect(submissions[0].contentType).toContain("application/json");
    expect(JSON.parse(submissions[0].body)).toEqual({
      action: "login",
      email: fictionalEmail,
      password: fictionalPassword,
    });
  } finally {
    releaseScripts();
  }
});

test("JavaScript-disabled authentication stays disabled and forced native submission never puts credentials in the URL", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  const submissions: Array<{
    method: string;
    pathname: string;
    search: string;
    body: string;
  }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname === "/api/auth" || url.searchParams.has("password")) {
      submissions.push({
        method: request.method(),
        pathname: url.pathname,
        search: url.search,
        body: request.postData() ?? "",
      });
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Intercepted fictional form</title><p>Intercepted locally.</p>",
      });
    }
    if (url.pathname === "/hydration-fixture.js")
      return route.fulfill({
        contentType: "application/javascript",
        body: bundle,
      });
    return route.fulfill({ contentType: "text/html", body: documentHtml() });
  });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const form = page
      .locator("form")
      .filter({ has: page.locator('[name="password"]') });
    await expect(form).toHaveAttribute("data-api-ready", "false");
    await expect(
      form.getByRole("button", { name: "Log in", exact: true }),
    ).toBeDisabled();
    expect(
      await form.locator("noscript").evaluate((element) => element.textContent),
    ).toContain("Enable JavaScript");
    await form.locator('[name="email"]').fill(fictionalEmail);
    await form.locator('[name="password"]').fill(fictionalPassword);
    await form.evaluate((element) =>
      HTMLFormElement.prototype.submit.call(element),
    );
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].method).toBe("POST");
    expect(submissions[0].pathname).toBe("/api/auth");
    expect(submissions[0].search).toBe("");
    expect(new URLSearchParams(submissions[0].body).get("password")).toBe(
      fictionalPassword,
    );
  } finally {
    await context.close();
  }
});
