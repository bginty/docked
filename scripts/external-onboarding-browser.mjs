/** Real customer pages and external inbox links. Never reads database email tokens. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
const dir = "private-data/restored-public-preview",
  out = "docs/qa/final-australia-20261102";
const a = JSON.parse(
  await fs.readFile(dir + "/external-ui.private.json", "utf8"),
);
assert.equal(a.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(a.origin, "https://docked-preview-s24-briant-ginty.vercel.app");
assert(!a.closed && Date.parse(a.until) > Date.now());
const mode = process.argv[2];
assert(["signup", "verify", "recover", "reset", "login"].includes(mode));
const env = await fs.readFile(dir + "/oidc.private.env", "utf8"),
  oidc = env.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(oidc);
const browser = await chromium.launch({ channel: "chrome", headless: true });
let saved;
try {
  saved = JSON.parse(
    await fs.readFile(dir + "/external-session.private.json", "utf8"),
  );
} catch {}
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ...(saved ? { storageState: saved } : {}),
});
await context.route("**/*", (route) => {
  const headers = { ...route.request().headers() };
  delete headers["x-vercel-trusted-oidc-idp-token"];
  if (new URL(route.request().url()).origin === a.origin)
    headers["x-vercel-trusted-oidc-idp-token"] = oidc;
  return route.continue({ headers });
});
const page = await context.newPage(),
  report = {
    at: new Date().toISOString(),
    mode,
    origin: a.origin,
    externalEmail: true,
    operatorRelay: false,
    passed: false,
    checks: [],
  };
let checkpoint = "initial";
const post = async (name, path = "/api/auth") => {
  const response = page.waitForResponse(
    (r) => r.url() === a.origin + path && r.request().method() === "POST",
  );
  await page.getByRole("button", { name, exact: true }).click();
  const r = await response;
  if (!r.ok()) {
    const body = await r.json();
    await fs.writeFile(
      dir + "/external-ui-error.private.json",
      JSON.stringify({ status: r.status(), body }),
      { mode: 0o600 },
    );
    throw Error("Customer route rejected request; private diagnostic saved");
  }
};
try {
  if (mode === "signup") {
    checkpoint = "registration-form";
    await page.goto(a.origin + "/app/signup");
    await page.locator("form[data-api-ready=true]").waitFor();
    await page
      .getByLabel("Username", { exact: true })
      .fill("ExternalAcceptance" + Date.now().toString().slice(-6));
    await page.getByLabel("Email", { exact: true }).fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByLabel("Confirm password", { exact: true }).fill(a.password);
    await page.locator("select[name=state]").selectOption("NSW");
    for (const name of ["age", "terms", "privacy"])
      await page.locator(`[name=${name}]`).check();
    checkpoint = "registration-submit";
    await post("Create account");
    await page.waitForURL((u) => u.pathname === "/app/check-email");
    report.checks.push(
      "Actual registration form accepted; automated Auth hook required; no confirmation bypass",
    );
  } else if (mode === "verify" || mode === "reset") {
    const inbox = JSON.parse(
      await fs.readFile(
        dir + `/external-ui-${mode}-inbox.private.json`,
        "utf8",
      ),
    );
    const link = new URL(inbox.link);
    assert.equal(link.origin, a.origin);
    assert.equal(
      link.pathname,
      mode === "verify" ? "/auth/verify" : "/auth/recovery",
    );
    assert(
      inbox.receivedAt && inbox.messageId,
      "External inbox evidence required",
    );
    checkpoint = "external-email-link";
    await page.goto(link.href);
    const button = page.getByRole("button", {
      name:
        mode === "verify" ? "Verify my email" : "Continue to password reset",
      exact: true,
    });
    await button.waitFor();
    await button.click();
    if (mode === "verify") {
      await page.waitForURL((u) => u.pathname !== "/auth/verify");
      report.checks.push(
        "Externally delivered signup link opened and confirmed through the customer POST interstitial",
      );
    } else {
      checkpoint = "recovery-pkce";
      await page.waitForURL((u) => u.pathname === "/app/reset-password", {
        timeout: 45000,
      });
      await page.locator("form[data-api-ready=true]").waitFor();
      await page.getByLabel("Password", { exact: true }).fill(a.nextPassword);
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill(a.nextPassword);
      await post("Update password");
      a.password = a.nextPassword;
      a.passwordRecovered = true;
      await fs.writeFile(
        dir + "/external-ui.private.json",
        JSON.stringify(a, null, 2),
        { mode: 0o600 },
      );
      report.checks.push(
        "External recovery email, customer POST interstitial, PKCE callback and password update completed",
      );
    }
  } else if (mode === "recover") {
    checkpoint = "signout-for-recovery";
    await page.goto(a.origin + "/app");
    const logout = await page.evaluate(async () => {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout", app: true }),
      });
      return r.status;
    });
    assert.equal(logout, 200);
    await page.goto(a.origin + "/app/forgot-password");
    await page.locator("form[data-api-ready=true]").waitFor();
    await page.getByLabel("Email", { exact: true }).fill(a.email);
    checkpoint = "recovery-submit";
    await post("Send reset link");
    await page.waitForURL((u) => u.pathname === "/app/check-email");
    report.checks.push(
      "Customer recovery form requested an automatic external email; PKCE browser retained",
    );
  } else {
    checkpoint = "login";
    await page.goto(a.origin + "/app/login");
    if (await page.getByLabel("Email", { exact: true }).count()) {
      await page.locator("form[data-api-ready=true]").waitFor();
      await page.getByLabel("Email", { exact: true }).fill(a.email);
      await page.getByLabel("Password", { exact: true }).fill(a.password);
      await post("Log in");
      await page.waitForURL((u) => u.pathname !== "/app/login");
    }
    checkpoint = "onboarding";
    await page.goto(a.origin + "/app/onboarding");
    for (let i = 0; i < 4; i++) {
      if (
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
      else if (
        await page
          .getByRole("button", { name: "Enter Docked", exact: true })
          .count()
      ) {
        await post("Enter Docked", "/api/member");
        await page.waitForURL((u) => u.pathname === "/fantasy/play");
        break;
      } else break;
    }
    await page.goto(a.origin + "/fantasy/play?sport=nfl");
    await page
      .getByRole("heading", { name: "Your lineup" })
      .waitFor({ timeout: 45000 });
    const capabilities = await page.evaluate(async () => {
      const r = await fetch("/api/public-gameplay");
      return { status: r.status, body: await r.json() };
    });
    assert.equal(capabilities.status, 200);
    assert.deepEqual(capabilities.body.allowed, ["nfl", "afl", "nrl"]);
    report.checks.push(
      "Ordinary confirmed external customer signed in and completed onboarding; NFL/AFL/NRL accessible",
    );
  }
  await context.storageState({ path: dir + "/external-session.private.json" });
  // Avoid collecting token URLs, passwords or inbox content in evidence.
  if (mode === "login")
    await page.screenshot({
      path: out + "/external-member-play.png",
      fullPage: true,
    });
  report.passed = true;
  report.path = new URL(page.url()).pathname;
} catch (error) {
  report.checkpoint = checkpoint;
  report.error = error instanceof Error ? error.name : "Error";
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    out + `/external-ui-${mode}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await browser.close();
}
