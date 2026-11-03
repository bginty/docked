import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const dir = "private-data/restored-public-preview",
  out = "docs/qa/v30-customer-billing-20261102";
const f = JSON.parse(await fs.readFile(`${dir}/fixture.private.json`, "utf8"));
const billing = JSON.parse(
  await fs.readFile(`${dir}/billing.private.json`, "utf8"),
);
const vars = await fs.readFile(`${dir}/oidc.private.env`, "utf8");
const oidc = vars.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(oidc);
const a = f.accounts.find((a) => a.kind === "member");
assert.equal(a.email, billing.email);
const viaTransport = process.argv.includes("--transport");
if (viaTransport) f.origin = "https://docked.com.au";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
if (!viaTransport)
  await context.route("**/*", (route) => {
    const h = { ...route.request().headers() };
    delete h["x-vercel-trusted-oidc-idp-token"];
    if (new URL(route.request().url()).origin === f.origin)
      h["x-vercel-trusted-oidc-idp-token"] = oidc;
    return route.continue({ headers: h });
  });
const page = await context.newPage();
page.on("response", async (r) => {
  if (
    r.request().method() === "POST" &&
    new URL(r.url()).pathname === "/profile/qa_billing"
  ) {
    const h = await r.request().allHeaders();
    console.log(
      JSON.stringify({
        operatorPost: r.status(),
        origin: h.origin,
        type: h["content-type"],
        bytes: r.request().postDataBuffer()?.length,
      }),
    );
  }
});
try {
  if (viaTransport) {
    const e = JSON.parse(
      await fs.readFile(
        "C:/Users/61412/.codex/worktrees/v30-transport/Docked.com.au/private-data/v30-transport/env.private.json",
        "utf8",
      ),
    );
    await page.goto(f.origin + "/profile/qa_billing");
    await page
      .getByLabel("Operator access code")
      .fill(e.DOCKED_V30_TRANSPORT_KEY);
    await page.getByRole("button", { name: "Connect to TEST" }).click();
    await page.waitForURL("**/app/login");
  }
  await page.goto(f.origin + "/app/login");
  await page.locator("form[data-api-ready=true]").waitFor({ timeout: 45000 });
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  if (process.argv.includes("--input-diagnostic")) {
    // The temporary visible event trace updates when focus moves. Settle that
    // diagnostic layout before pointer-down; this does not submit the form.
    await page.getByRole("button", { name: "Log in", exact: true }).focus();
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
  }
  const response = page.waitForResponse(
    (r) =>
      r.url() === f.origin + "/api/auth" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  assert.equal((await response).status(), 200);
  // /app is an intermediate session-routing screen, not a settled login.
  await page.waitForURL((u) => u.pathname === "/fantasy/play");
  const session = await page.evaluate(async () => {
    const r = await fetch("/api/store/google/commercial");
    return { status: r.status, body: await r.json() };
  });
  assert.equal(session.status, 200, JSON.stringify(session));
  assert.equal(session.body.member, billing.member);
  assert.equal(session.body.isolatedTestOnly, true);
  assert.equal(session.body.products.length, 2);
  let readBurst;
  if (process.argv.includes("--read-burst")) {
    readBurst = await page.evaluate(async () => {
      const statuses = [];
      for (let i = 0; i < 25; i++) {
        const r = await fetch("/api/store/google/commercial?view=wallet", {
          cache: "no-store",
        });
        statuses.push(r.status);
      }
      return statuses;
    });
    assert(
      readBurst.every((x) => x === 200),
      "Normal wallet reads must not consume the purchase quota",
    );
  }
  await context.storageState({
    path: `${dir}/v30-member-session.private.json`,
  });
  const evidence = {
    at: new Date().toISOString(),
    normalHostedLogin: true,
    viaTransport,
    correctMember: true,
    isolatedTestOnly: true,
    products: session.body.products,
    wallet: session.body.wallet,
    readBurst,
    physicalDevice: false,
    googlePurchase: false,
  };
  await fs.writeFile(
    `${out}/${viaTransport ? "transport" : "preview"}-billing-read.json`,
    JSON.stringify(evidence, null, 2),
  );
  await page.goto(f.origin + "/fantasy/test-wallet?sport=nfl");
  await page.screenshot({
    path: `${out}/${viaTransport ? "transport" : "preview"}-wallet-390.png`,
    fullPage: true,
  });
  console.log(JSON.stringify(evidence));
} catch (e) {
  await page.screenshot({
    path: `${out}/transport-failure.png`,
    fullPage: true,
  });
  console.error(
    JSON.stringify({
      url: page.url(),
      text: (await page.locator("body").innerText()).slice(0, 900),
    }),
  );
  throw e;
} finally {
  await browser.close();
}
