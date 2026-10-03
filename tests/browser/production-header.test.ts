import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { headerAccountLabel } from "../../src/core/public-presentation";
import { evidenceRoot } from "./evidence";

for (const width of [320, 390, 1366])
  test(`production closed-registration label fits the rendered public header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator(".site-header .brand img")
      .evaluate((image: HTMLImageElement) => image.decode());
    // Use the actual shared production label in the real rendered header. This
    // projects only presentation; it does not fake production config or Auth.
    const label = headerAccountLabel({
      production: true,
      registrationAvailable: false,
    });
    expect(label).toBe("Accounts");
    await page.locator(".account-nav .button").evaluate((link, text) => {
      const node = [...link.childNodes].find(
        (child) => child.nodeType === Node.TEXT_NODE,
      )!;
      node.nodeValue = text + " ";
    }, label);
    await expect(page.locator(".account-nav .button")).toContainText(label);
    const geometry = await page.evaluate(() => {
      const brand = document
        .querySelector(".site-header .brand")!
        .getBoundingClientRect();
      const account = document
        .querySelector(".account-nav")!
        .getBoundingClientRect();
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brandRight: brand.right,
        accountLeft: account.left,
        accountRight: account.right,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.accountLeft);
    expect(geometry.accountRight).toBeLessThanOrEqual(width);
    for (const control of await page.locator(".account-nav a").all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(width <= 760 ? 44 : 24);
    }
    expect(
      (await new AxeBuilder({ page }).include(".site-header").analyze())
        .violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
    const output = path.join(evidenceRoot, "production-header");
    await mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, `ISOLATED-header-${width}.png`),
    });
    await writeFile(
      path.join(output, `header-${width}.json`),
      JSON.stringify(
        {
          scope:
            "production presentation projected into actual rendered header; no authentication or environment override",
          ...geometry,
          errors,
          violations: 0,
        },
        null,
        2,
      ) + "\n",
    );
  });
