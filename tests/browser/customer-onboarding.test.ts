import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
for (const width of [360, 412, 1366])
  test(`customer signup, explicit consent and unopened pack at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const requests: any[] = [];
    let error = true;
    await page.route("**/*", (route) => {
      if (route.request().url().includes("/api/auth/")) {
        requests.push({
          path: new URL(route.request().url()).pathname,
          body: route.request().postDataJSON(),
        });
        if (route.request().url().endsWith("customer-invitation"))
          return route.fulfill({ json: { ok: true } });
        return route.fulfill({
          status: error ? 403 : 200,
          json: error
            ? {
                error:
                  "Invite required. Open your personal invitation link first.",
              }
            : { ok: true, redirect: "/app/check-email?type=verification" },
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>Customer journey fixture</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
      });
    });
    const mount = async (step: string) => {
      await page.goto(
        `https://fixture.invalid/app/signup?step=${step}` +
          (step === "signup" ? "#invite=" + "a".repeat(64) : ""),
      );
      for (const name of ["brand-theme", "globals", "app-auth", "fantasy"])
        await page.addStyleTag({
          content: await readFile(`src/app/${name}.css`, "utf8"),
        });
      await page.addScriptTag({
        content: await bundleCommunityFixture(
          "tests/fixtures/customer-onboarding.tsx",
        ),
      });
    };
    await mount("signup");
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeEnabled();
    expect(new URL(page.url()).hash).toBe("");
    await page.getByLabel("Invited email").fill("fresh@example.invalid");
    await page.getByLabel("Choose a password").fill("My isolated password");
    await page.getByLabel("Confirm password").fill("My isolated password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText("Invite required");
    error = false;
    await page.getByRole("button", { name: "Create account" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).demoNavigation))
      .toBe("/app/check-email?type=verification");
    await mkdir("docs/qa/customer-onboarding", { recursive: true });
    await page.screenshot({
      path: `docs/qa/customer-onboarding/signup-${width}.png`,
      fullPage: true,
    });
    await mount("complete");
    await expect(page.getByLabel("Private beta admission code")).toHaveCount(0);
    await expect(page.getByLabel("Display name")).toBeVisible();
    for (const checkbox of await page.getByRole("checkbox").all())
      await expect(checkbox).not.toBeChecked();
    await page.getByLabel("Display name").fill("FreshFriend");
    await page.getByLabel("State / region").fill("VIC");
    for (const checkbox of await page.getByRole("checkbox").all())
      await checkbox.check();
    await page.getByRole("button", { name: "Complete account setup" }).click();
    await expect
      .poll(
        () =>
          requests.filter((x) => x.path.endsWith("invitation-setup")).length,
      )
      .toBe(1);
    const consent = requests.find((x) =>
      x.path.endsWith("invitation-setup"),
    ).body;
    expect(consent.age).toBe(true);
    expect(consent.betaRules).toBe(true);
    expect(consent).not.toHaveProperty("betaAdmissionCode");
    expect(consent).not.toHaveProperty("marketing");
    await page.screenshot({
      path: `docs/qa/customer-onboarding/consent-${width}.png`,
      fullPage: true,
    });
    await mount("pack");
    await expect(
      page.getByRole("button", { name: "Open my free pack" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).packAction),
    ).toBeUndefined();
    await page.screenshot({
      path: `docs/qa/customer-onboarding/pack-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open my free pack" }).click();
    expect(await page.evaluate(() => (window as any).packAction)).toBe(
      "open_nfl_starter",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
