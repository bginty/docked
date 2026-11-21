import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";

/** Real components, mocked loopback APIs. This is UI acceptance only; it makes
 * no claim about hosted authentication, KYC, bank execution or live balances. */
async function main() {
  const script = await bundleCommunityFixture(
    "tests/fixtures/withdrawal-ui.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/([^"\n]+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync("src/app/" + m[1], "utf8"))
    .join("\n");
  const output = "docs/qa/marketplace-withdrawals-20261121";
  mkdirSync(output, { recursive: true });
  const member = "11111111-1111-4111-8111-111111111111";
  const owner = "22222222-2222-4222-8222-222222222222";
  const destination = "33333333-3333-4333-8333-333333333333";
  const requestId = "44444444-4444-4444-8444-444444444444";
  const syntheticBank = {
    holder: "Synthetic Customer",
    bsb: "123456",
    account: "987654321",
  };
  const policy = {
    version: "ISOLATED-UI-CASH-POLICY",
    currency: "AUD",
    eligibleSource: "settled-sale-proceeds-only",
    rate: { credits: 100, audCents: 100 },
    minimumCredits: 1000,
    maximumCredits: 10000,
    dailyMaximumCredits: 20000,
    feeCents: 0,
  };
  const setup = {
    published: true,
    identityConfigured: true,
    bankProtectionConfigured: true,
  };
  const receipt = {
    id: requestId,
    memberId: member,
    status: "REQUESTED",
    revision: 1,
    credits: 1500,
    grossAudCents: 1500,
    feeCents: 0,
    audCents: 1500,
    policyVersion: policy.version,
    identityRevision: 1,
    destination,
    destinationMask: "****4321",
    claimedBy: owner,
    createdAt: "2026-11-21T00:00:00Z",
    updatedAt: "2026-11-21T00:00:00Z",
    claimedAt: "2026-11-21T00:00:00Z",
    sentAt: null,
    reconciledAt: null,
    returnedAt: null,
  };
  const customer = {
    member,
    enabled: true,
    reason: null,
    setup,
    policy,
    money: { available: 9000, eligible: 5000, pending: 0 },
    identity: { status: "approved", revision: 1 },
    destinations: [
      {
        id: destination,
        mask: "****4321",
        identityRevision: 1,
        verified: true,
      },
    ],
    requests: [] as (typeof receipt)[],
  };
  const operations = {
    owner,
    requestsEnabled: true,
    paymentsEnabled: true,
    reason: null,
    setup,
    policy,
    configuredPolicyVersion: policy.version,
    totalRequests: 1,
    openRequests: 1,
    hasMore: false,
    requests: [{ ...receipt, status: "PAYMENT_IN_PROGRESS" }],
    destinations: [
      {
        id: destination,
        memberId: member,
        mask: "****4321",
        identityRevision: 1,
        currentIdentityRevision: 1,
        currentIdentityStatus: "approved",
        verified: true,
      },
    ],
    exposures: [],
  };
  const requests: Record<string, unknown>[] = [];
  const ownerCommands: Record<string, unknown>[] = [];
  let bankSaves = 0,
    reveals = 0,
    lost = false;
  const errors: string[] = [],
    checks: string[] = [];
  let origin = "";
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    const scenario = req.headers["x-ui-scenario"];
    const json = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(value));
    };
    try {
      let body: Record<string, unknown> = {};
      if (req.method === "POST") {
        assert.equal(req.headers.origin, origin);
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString());
      }
      if (path === "/api/commercial-withdrawals") {
        if (req.method === "POST") {
          requests.push(body);
          customer.requests = [{ ...receipt }];
          customer.money.pending = 1500;
          if (!lost) {
            lost = true;
            return res.destroy();
          }
          assert.deepEqual(
            body,
            requests[0],
            "Lost-response retry must retain its original operation",
          );
          return json({ result: receipt });
        }
        return json(
          scenario === "unverified"
            ? {
                ...customer,
                destinations: [
                  { ...customer.destinations[0], verified: false },
                ],
              }
            : customer,
        );
      }
      if (path === "/api/commercial-withdrawals/destination") {
        bankSaves++;
        assert.deepEqual(body.bank, syntheticBank);
        return bankSaves === 1
          ? json(
              {
                error: "Synthetic ownership review response unavailable",
                outcome: "rejected",
              },
              409,
            )
          : json({ result: { id: destination } });
      }
      if (path === "/api/admin/withdrawals") {
        if (req.method === "POST") {
          ownerCommands.push(body);
          const command = body.command as Record<string, unknown>;
          assert.equal(command.kind, "record-sent");
          assert.equal(command.confirmed, true);
          operations.requests[0] = {
            ...operations.requests[0],
            status: "SENT",
            revision: 2,
          };
          return json({ result: operations.requests[0] });
        }
        return json(operations);
      }
      if (path === "/api/admin/withdrawals/bank") {
        reveals++;
        return json({
          bank: syntheticBank,
          expiresAt: new Date(
            Date.now() + (reveals === 1 ? 30000 : 500),
          ).toISOString(),
        });
      }
      if (path === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(script);
      }
      if (path === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (path.startsWith("/api/"))
        return json({ error: "Unknown isolated endpoint" }, 404);
      if (path !== "/customer" && path !== "/owner") {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (failure) {
      errors.push(
        failure instanceof Error ? failure.message : "Fixture server failure",
      );
      json({ error: "Isolated fixture assertion failed" }, 500);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      executablePath: process.env.DOCKED_UI_CHROMIUM ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const customerPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const unverifiedPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-ui-scenario": "unverified" },
    });
    const ownerPage = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: "reduce",
    });
    for (const page of [customerPage, unverifiedPage, ownerPage]) {
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
    }
    await customerPage.goto(origin + "/customer");
    await expect(
      customerPage.getByRole("heading", { name: "Current withdrawal terms" }),
    ).toBeVisible();
    await expect(
      customerPage
        .getByRole("heading", { name: "Current withdrawal terms" })
        .locator(".."),
    ).toContainText("1,000 credits");
    await customerPage
      .getByLabel("Verified bank account")
      .selectOption(destination);
    await customerPage.getByLabel("Credits to withdraw").fill("500");
    await expect(
      customerPage.getByRole("button", { name: "Confirm withdrawal request" }),
    ).toBeDisabled();
    await customerPage.getByLabel("Credits to withdraw").fill("6000");
    await expect(
      customerPage.getByRole("button", { name: "Confirm withdrawal request" }),
    ).toBeDisabled();
    await customerPage.getByLabel("Credits to withdraw").fill("1500");
    await expect(
      customerPage.getByText(
        "Bank payment: $15.00 after a $0.00 withdrawal fee.",
      ),
    ).toBeVisible();
    await expect(
      customerPage.getByRole("button", { name: "Confirm withdrawal request" }),
    ).toBeEnabled();
    checks.push(
      "Customer quote uses fixture rate, zero fee, minimum and eligible-balance maximum",
    );

    await unverifiedPage.goto(origin + "/customer");
    await unverifiedPage.getByLabel("Credits to withdraw").fill("1500");
    await expect(
      unverifiedPage.getByText("Account ****4321: Awaiting ownership review"),
    ).toBeVisible();
    await expect(
      unverifiedPage.getByLabel("Verified bank account").locator("option"),
    ).toHaveCount(1);
    await expect(
      unverifiedPage.getByRole("button", {
        name: "Confirm withdrawal request",
      }),
    ).toBeDisabled();
    checks.push(
      "Unverified bank account cannot be selected or used for a withdrawal",
    );

    for (let attempt = 0; attempt < 2; attempt++) {
      await customerPage
        .getByLabel("Account holder", { exact: true })
        .fill(syntheticBank.holder);
      await customerPage.getByLabel("BSB — 6 digits").fill(syntheticBank.bsb);
      await customerPage
        .getByLabel("Account number", { exact: true })
        .fill(syntheticBank.account);
      await customerPage
        .getByRole("button", { name: "Save for ownership review" })
        .click();
      await expect(
        customerPage.getByLabel("Account holder", { exact: true }),
      ).toHaveValue("");
      await expect(customerPage.getByLabel("BSB — 6 digits")).toHaveValue("");
      await expect(
        customerPage.getByLabel("Account number", { exact: true }),
      ).toHaveValue("");
    }
    checks.push(
      "Bank form clears all sensitive input after both failure and success",
    );
    await customerPage
      .getByRole("button", { name: "Confirm withdrawal request" })
      .click();
    await expect(
      customerPage.getByRole("button", { name: "Retry the same request" }),
    ).toBeVisible();
    await expect(
      customerPage.getByRole("button", { name: "Confirm withdrawal request" }),
    ).toBeDisabled();
    await customerPage
      .getByRole("button", { name: "Retry the same request" })
      .click();
    await expect(
      customerPage.getByText(
        "Your request has been recorded. The latest status appears below.",
      ),
    ).toBeVisible();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    checks.push(
      "Lost response recovers through the exact same request UUID and command",
    );
    const history = customerPage
      .getByRole("heading", { name: "Withdrawal history" })
      .locator("..");
    await expect(history).toContainText("Account ****4321");
    for (const value of Object.values(syntheticBank))
      await expect(history).not.toContainText(value);
    const stored = await customerPage.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    for (const value of Object.values(syntheticBank))
      assert.equal(stored.includes(value), false);
    checks.push(
      "Customer history and browser persistence contain no raw bank details",
    );
    assert(
      await customerPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Mobile customer layout overflows",
    );
    await customerPage.screenshot({
      path: output + "/withdrawal-customer-mocked-ui.png",
      fullPage: true,
    });

    await ownerPage.goto(origin + "/owner");
    await ownerPage
      .getByLabel("Reason for the action")
      .fill("Synthetic bank statement checked for this isolated fixture");
    await ownerPage
      .getByLabel("Evidence reference", { exact: true })
      .first()
      .fill("ISOLATED-EVIDENCE-ONLY");
    await ownerPage
      .getByLabel("Withdrawal", { exact: true })
      .selectOption(requestId);
    await ownerPage
      .getByLabel("Unique bank transaction reference")
      .fill("ISOLATED-BANK-REFERENCE");
    const sent = ownerPage.getByRole("button", {
      name: "Record payment already sent",
    });
    await expect(sent).toBeDisabled();
    await ownerPage
      .getByRole("checkbox", {
        name: "I checked the bank and personally confirm this exact payment was sent.",
      })
      .check();
    await expect(sent).toBeEnabled();
    checks.push(
      "Owner cannot record payment sent without personal bank confirmation checkbox",
    );
    await ownerPage
      .getByRole("button", { name: "Reveal this payment’s bank details" })
      .click();
    const sensitive = ownerPage.getByRole("region", {
      name: "Sensitive bank details",
    });
    await expect(sensitive).toBeVisible();
    await expect(sensitive).toContainText(syntheticBank.account);
    await ownerPage.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(sensitive).toHaveCount(0);
    await ownerPage
      .getByRole("button", { name: "Reveal this payment’s bank details" })
      .click();
    await expect(sensitive).toBeVisible();
    await expect(sensitive).toHaveCount(0, { timeout: 3000 });
    checks.push(
      "Owner raw bank reveal clears on window blur and server-provided expiry",
    );
    await sent.click();
    await expect(
      ownerPage.getByText(
        "Operation recorded. Review the updated state before continuing.",
      ),
    ).toBeVisible();
    assert.equal(ownerCommands.length, 1);
    assert.equal(
      (ownerCommands[0].command as Record<string, unknown>).confirmed,
      true,
    );
    for (const value of Object.values(syntheticBank))
      await expect(ownerPage.locator("body")).not.toContainText(value);
    checks.push(
      "Owner recorded history returns to masked bank details after sent confirmation",
    );
    await ownerPage.screenshot({
      path: output + "/withdrawal-owner-mocked-ui.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    writeFileSync(
      output + "/MOCKED_UI.json",
      JSON.stringify(
        {
          scope:
            "Actual React components with synthetic loopback API fixtures only",
          production: false,
          externalCalls: false,
          realKyc: false,
          realBankTransfer: false,
          checks,
          screenshots: [
            "withdrawal-customer-mocked-ui.png",
            "withdrawal-owner-mocked-ui.png",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        status: "PASS",
        checks: checks.length,
        evidence: output + "/MOCKED_UI.json",
      }),
    );
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
