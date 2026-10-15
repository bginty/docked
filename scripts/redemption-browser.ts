import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { startRedemptionPreview } from "./redemption-local";
async function main() {
  const app = await startRedemptionPreview(0),
    base = `http://127.0.0.1:${app.port}`,
    browser = await chromium.launch({ headless: true }),
    checks: string[] = [];
  const output = "docs/qa/redemption";
  await mkdir(output, { recursive: true });
  try {
    const customer = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      staff = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await customer.newPage(),
      admin = await staff.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    admin.on("pageerror", (e) => errors.push(e.message));
    async function login(p: typeof page, role: string) {
      await p.goto(base + "/qa");
      await p.getByLabel("Fixture role").selectOption(role);
      await p.getByRole("button", { name: "Open fixture" }).click();
      await p
        .getByRole("heading", {
          name: role === "staff" ? "Credit redemption requests" : "Withdrawals",
          exact: true,
        })
        .waitFor();
      await expect(p.getByText("Loading withdrawals…")).toHaveCount(0);
    }
    async function confirm(p: typeof page) {
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(p.getByRole("dialog")).toHaveCount(0);
    }
    async function overflow(p: typeof page) {
      if (
        !(await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ))
      )
        console.log(
          await p.evaluate(() =>
            [...document.querySelectorAll("*")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(-12)
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                width: e.getBoundingClientRect().width,
                text: e.textContent?.slice(0, 60),
              })),
          ),
        );
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "No horizontal overflow",
      );
    }
    await login(page, "member");
    await expect(
      page.getByText("25,000", { exact: false }).first(),
    ).toBeVisible();
    await overflow(page);
    await page.screenshot({
      path: `${output}/customer-desktop.png`,
      fullPage: true,
    });
    await page
      .getByLabel("Amount to receive (AUD)", { exact: true })
      .fill("100.001");
    await page.getByRole("button", { name: "Review redemption" }).click();
    await expect(page.getByRole("alert")).toContainText("two decimal");
    await expect(
      page.getByLabel("Amount to receive (AUD)", { exact: true }),
    ).toHaveValue("100.001");
    await page
      .getByLabel("Amount to receive (AUD)", { exact: true })
      .fill("100.00");
    await page.getByRole("button", { name: "Review redemption" }).click();
    await expect(page.getByRole("dialog")).toContainText("10,000");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review redemption" }),
    ).toBeFocused();
    await page.setViewportSize({ width: 412, height: 915 });
    await page.evaluate(() => scrollTo(0, 0));
    await overflow(page);
    await page.screenshot({
      path: `${output}/customer-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Review redemption" }).click();
    await page.screenshot({ path: `${output}/review-mobile.png` });
    await page
      .getByRole("button", { name: "Redeem credits", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Credits reserved");
    await page.screenshot({
      path: `${output}/requested-mobile.png`,
      fullPage: true,
    });
    checks.push(
      "Customer desktop/mobile, exact quote, invalid amount retained, explicit confirmation, reservation and history",
    );
    const data = await (
        await customer.request.get(base + "/api/redemptions")
      ).json(),
      request = data.requests[0].id;
    assert.equal(data.balance.available, 15000);
    assert.equal(data.balance.pending, 10000);
    await login(admin, "staff");
    await admin.locator(".redemption-row").first().click();
    await admin
      .getByLabel("Customer-facing reason", { exact: true })
      .fill("Synthetic request reviewed");
    await admin
      .getByLabel("Internal note (staff only)")
      .last()
      .fill("Private staff note fixture");
    await admin.screenshot({
      path: `${output}/admin-desktop.png`,
      fullPage: true,
    });
    await admin
      .getByRole("button", { name: "Approve redemption", exact: true })
      .click();
    await confirm(admin);
    await admin.getByRole("button", { name: "Claim for manual EFT" }).click();
    await confirm(admin);
    await admin
      .getByRole("button", { name: "Reveal bank details · access logged" })
      .click();
    await expect(admin.getByRole("dialog")).toContainText("001234");
    await admin.keyboard.press("Escape");
    await page.reload();
    await page.locator(".redemption-row").first().click();
    await expect(
      page.getByRole("button", { name: "Cancel request", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      "Private staff note fixture",
    );
    await admin
      .getByLabel("Bank / reconciliation reference")
      .fill("SYNTHETIC-BROWSER-EFT");
    await admin
      .getByRole("button", { name: "Mark EFT sent", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toContainText("not received");
    await confirm(admin);
    await admin.setViewportSize({ width: 412, height: 915 });
    await overflow(admin);
    await admin.screenshot({
      path: `${output}/admin-mobile.png`,
      fullPage: true,
    });
    await page.reload();
    await page.locator(".redemption-row").first().click();
    await expect(
      page.getByText(
        "Staff recorded the EFT as sent. Receipt by your bank is not confirmed.",
      ),
    ).toBeVisible();
    checks.push(
      "Staff approval/claim/audited bank reveal/explicit sent; customer cannot cancel claimed payment or see internal notes",
    );
    // Real local HTTP mutation completes, then deliberately lose the response.
    await page
      .getByLabel("Amount to receive (AUD)", { exact: true })
      .fill("1.00");
    let lost = false;
    await page.route("**/api/redemptions", async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Review redemption" }).click();
    await page
      .getByRole("button", { name: "Redeem credits", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.unroute("**/api/redemptions");
    await page.reload();
    await expect(page.getByRole("status")).toContainText("recovered");
    const recovered = await (
      await customer.request.get(base + "/api/redemptions")
    ).json();
    assert.equal(recovered.requests.length, 2);
    assert.equal(recovered.balance.pending, 100);
    checks.push(
      "Interrupted response recovered on refresh by original operation ID, no duplicate reservation",
    );
    await login(page, "other");
    await expect(page.locator(".redemption-row")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(request);
    await page
      .getByRole("button", { name: "Submit synthetic evidence for review" })
      .click();
    await expect(page.locator("body")).toContainText("Evidence submitted");
    await expect(
      page.getByRole("button", { name: "Review redemption" }),
    ).toBeDisabled();
    await admin.reload();
    await admin.getByText("Identity reviews", { exact: true }).click();
    await admin.screenshot({
      path: `${output}/identity-admin-mobile.png`,
      fullPage: true,
    });
    checks.push(
      "Account switching hides prior history; evidence submission does not approve identity",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addStyleTag({ content: "html{font-size:125%}" });
    await overflow(page);
    await page.screenshot({
      path: `${output}/customer-enlarged.png`,
      fullPage: true,
    });
    checks.push(
      "Keyboard Escape/focus restoration, 360px enlarged text, reduced motion and no page overflow",
    );
    assert.deepEqual(errors, []);
    await writeFile(
      `${output}/browser.json`,
      JSON.stringify(
        {
          passed: true,
          checks,
          screenshots: 8,
          backend:
            "Actual component + local HTTP + in-memory authoritative domain; fixture sessions, not Supabase",
          physicalDevice: false,
        },
        null,
        2,
      ),
    );
    console.log(`PASS: ${checks.length} browser acceptance groups`);
  } finally {
    await browser.close();
    await new Promise<void>((done) => app.server.close(() => done()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
