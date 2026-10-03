import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { referenceReview } from "../fixtures/reference-ui";
import { evidenceRoot } from "./evidence";
let bundle = "";
const evidence = path.join(evidenceRoot, "reference-ui");
test("web deep-link aliases preserve canonical visibility routes", async ({
  page,
}) => {
  const id = "00000000-0000-4000-8000-000000000444";
  for (const [from, to] of [
    [`/edges/${id}`, `/tips/${id}`],
    [`/results/${id}`, `/tips/${id}`],
    [`/community/${id}`, `/community/posts/${id}`],
  ]) {
    await page.goto(from, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
  expect((await page.request.get("/edges/not-a-record")).status()).toBe(404);
});
test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  const result = await build({
    entryPoints: [path.resolve("tests/fixtures/reference-composer.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-fixture",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            const target = /^next\/(navigation|link)$/.test(args.path)
              ? path.resolve("tests/fixtures/community-framework-shim.tsx")
              : args.path.startsWith("@/")
                ? path.resolve("src", args.path.slice(2))
                : path.isAbsolute(args.path)
                  ? args.path
                  : args.path.startsWith(".")
                    ? path.resolve(path.dirname(args.importer), args.path)
                    : createRequire(
                        args.importer || path.resolve("package.json"),
                      ).resolve(args.path);
            const file = [
              target,
              target + ".tsx",
              target + ".ts",
              target + ".js",
              path.join(target, "index.js"),
            ].find(existsSync);
            if (!file) throw new Error("Unresolved isolated fixture import");
            return { path: file, namespace: "fixture" };
          });
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".json")
                  ? "json"
                  : "jsx",
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
});
async function styles(page: Page) {
  for (const file of [
    "globals.css",
    "sports-visuals.css",
    "sports-experience.css",
    "community-app.css",
    "native.css",
  ])
    await page.addStyleTag({ path: path.resolve("src/app", file) });
}
test("reference card hierarchy and unavailable data remain honest at mobile widths", async ({
  page,
}) => {
  const fixtures = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-reference-ui.ts"],
      { encoding: "utf8" },
    ),
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(
      `<!doctype html><html lang="en"><head><title>DEMO reference hierarchy</title></head><body><main class="page"><h1>DEMO · fictional UI fixture</h1>${fixtures.ready}${fixtures.missing}</main></body></html>`,
    );
    await styles(page);
    await expect(page.getByText("TAKE 1.94+", { exact: true })).toHaveCount(2);
    await expect(page.getByText("CURRENT MARKET", { exact: true })).toHaveCount(
      2,
    );
    await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${evidence}/DEMO-reference-cards-${width}.png`,
      fullPage: true,
    });
  }
});
test("reference composer sends canonical market selection only and reconfirms a moved benchmark", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sent: Record<string, unknown>[] = [];
  let submissions = 0;
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === "/api/community")
      return route.fulfill({ json: { media: [] } });
    if (req.method() === "GET")
      return route.fulfill({
        json: {
          status: "READY",
          message: "DEMO isolated reference",
          options: [referenceReview],
        },
      });
    const input = req.postDataJSON();
    sent.push(input);
    if (input.action === "review")
      return route.fulfill({ json: { ok: true, review: referenceReview } });
    if (++submissions === 1)
      return route.fulfill({
        status: 409,
        json: {
          code: "PRICE_MOVED",
          previousOdds: "2.02",
          current: {
            ...referenceReview,
            odds: "1.98",
            reviewToken: "DEMO_MOVED_TOKEN",
          },
        },
      });
    return route.fulfill({
      json: { ok: true, id: "00000000-0000-4000-8000-000000000777" },
    });
  });
  await page.goto("/offline.html");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>DEMO reference composer</title></head><body><main id="fixture" class="page"></main></body></html>',
  );
  await styles(page);
  await page.addScriptTag({ content: bundle });
  await page
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("basketball");
  await page
    .getByRole("combobox", { name: "Competition", exact: true })
    .selectOption("DEMO league");
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption(referenceReview.eventId);
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption(referenceReview.marketId);
  await page
    .getByRole("combobox", { name: "Selection", exact: true })
    .selectOption(referenceReview.selection);
  await expect(
    page.getByLabel("Bookmaker · provider-observed standard odds"),
  ).toHaveCount(0);
  await page
    .getByText("Optional personal price — social context only", { exact: true })
    .click();
  await page
    .getByLabel("Personal bookmaker (optional)", { exact: true })
    .fill("DEMO personal promotion");
  await page
    .getByLabel("Personal decimal price (optional)", { exact: true })
    .fill("4.50");
  await page.getByLabel("This personal price is a boost or promotion.").check();
  await page
    .getByRole("button", { name: "Review verified Edge", exact: true })
    .click();
  expect(sent[0]).toEqual({
    action: "review",
    marketId: referenceReview.marketId,
    selection: referenceReview.selection,
  });
  const confirmation = page.getByLabel(
    "I understand and accept this permanent record.",
  );
  await confirmation.check();
  await page
    .getByRole("button", { name: "Submit at market reference", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("2.02 → 1.98");
  await expect(
    page.getByText("CURRENT MARKET 1.98", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("CURRENT MARKET 2.02", { exact: true }),
  ).toHaveCount(0);
  await expect(confirmation).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Submit at market reference",
      exact: true,
    }),
  ).toBeDisabled();
  expect(sent[1]).toMatchObject({
    marketId: referenceReview.marketId,
    personalPrice: "4.50",
    personalPromotional: true,
  });
  expect(sent[1]).not.toHaveProperty("odds");
  expect(sent[1]).not.toHaveProperty("snapshotId");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `${evidence}/DEMO-reference-reconfirmation-390.png`,
    fullPage: true,
  });
  await confirmation.check();
  await page
    .getByRole("button", { name: "Submit at market reference", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Permanent record submitted." }),
  ).toBeVisible();
  expect(sent[2]).toMatchObject({
    reviewToken: "DEMO_MOVED_TOKEN",
    personalPrice: "4.50",
  });
  expect(errors).toEqual([]);
});
