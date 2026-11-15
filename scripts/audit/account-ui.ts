/** Isolated transport only: no hosted credentials, accounts or SMS. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../../tests/fixtures/bundle-community";
async function main() {
  const out = "docs/qa/overnight-audit-20261115/account-ui";
  fs.mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "scripts/audit/account-ui.fixture.tsx",
  );
  const css = [
    ...fs
      .readFileSync("src/app/layout.tsx", "utf8")
      .matchAll(/import "\.\/(.+\.css)"/g),
  ]
    .map((x) => fs.readFileSync("src/app/" + x[1], "utf8"))
    .join("\n");
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  let mode = "pending",
    requests = 0,
    release: () => void = () => {};
  await context.route("**/*", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/auth/phone") {
      requests++;
      if (mode === "pending") await new Promise<void>((r) => (release = r));
      return route.fulfill({
        status: mode === "accepted" ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify(
          mode === "accepted"
            ? { ok: true, verified: false }
            : {
                error:
                  "Phone verification is temporarily unavailable. Please try again.",
              },
        ),
      });
    }
    if (p === "/api/auth")
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Email or password not accepted." }),
      });
    if (p === "/fixture.js")
      return route.fulfill({ contentType: "text/javascript", body: js });
    if (p === "/fixture.css")
      return route.fulfill({ contentType: "text/css", body: css });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated account UI</title><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    });
  });
  try {
    await page.goto("https://audit.invalid/phone");
    await page
      .getByRole("textbox", { name: "Australian mobile number (04 or +614)" })
      .fill("0400000001");
    const axe = await new AxeBuilder({ page }).analyze();
    await page.screenshot({ path: out + "/phone-390.png" });
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await page.waitForTimeout(17000);
    const busyAfter17s = await page
      .getByRole("button", { name: "Please wait…", exact: true })
      .isDisabled();
    const alertsAfter17s = await page.getByRole("alert").count();
    await page.screenshot({ path: out + "/phone-pending-17s.png" });
    mode = "failure";
    release();
    await expect(page.getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await expect(
      page.getByRole("button", { name: "Send code", exact: true }),
    ).toBeEnabled();
    mode = "accepted";
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Verification code" }),
    ).toHaveAttribute("autocomplete", "one-time-code");
    await page
      .getByRole("button", { name: "Change number or request another code" })
      .click();
    await expect(
      page.getByRole("button", { name: "Send code", exact: true }),
    ).toBeEnabled();
    assert.equal(requests, 2);
    await page.goto("https://audit.invalid/login");
    await page.getByLabel("Email address").fill("fictional@example.test");
    await page.getByLabel("Password").fill("Fictional-local-only-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("not accepted");
    fs.writeFileSync(
      out + "/results.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scope:
            "Unchanged real phone/shared login components; every request intercepted locally; not hosted Auth or SMS acceptance",
          phone: {
            busyAfter17s,
            alertsAfter17s,
            finiteFailureRecovered: true,
            codeAutocomplete: true,
            changeNumber: true,
            requests,
            realSms: 0,
          },
          login: { mockInvalidCredentialsVisible: true },
          axe: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            targets: v.nodes.map((n) => n.target),
          })),
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    release();
    await context.close();
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
