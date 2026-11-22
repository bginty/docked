import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { commercialPack } from "../../src/core/commercial-billing";
import {
  ownerPackAwardCommand,
  type OwnerPackAwardCommand,
  type OwnerPackAwardProduct,
  type OwnerPackAwardReceipt,
  type OwnerPackAwardView,
} from "../../src/core/owner-pack-awards";

test("Owner reviews a mixed free-pack award and recovers an interrupted result without a second request", async ({
  page,
}, testInfo) => {
  // Real production UI and command schema; isolated synthetic HTTP transport.
  // Native PostgreSQL tests separately exercise permanent issuance and atomicity.
  const owner = "10000000-0000-4000-8000-000000000001";
  const otherOwner = "10000000-0000-4000-8000-000000000002";
  const member = "20000000-0000-4000-8000-000000000001";
  const duplicateName = "20000000-0000-4000-8000-000000000002";
  let signedInOwner = owner;
  const products: OwnerPackAwardProduct[] = (
    ["nfl", "afl", "nrl"] as const
  ).flatMap((sport) =>
    (["STANDARD", "PREMIUM"] as const).flatMap((family) =>
      ([1, 3, 9] as const).map((size) => {
        const product = commercialPack(sport, family, size);
        return {
          id: product.id,
          name: product.name,
          sport,
          family,
          size,
          configurationHash: product.configurationHash,
          available: true,
        };
      }),
    ),
  );
  const view: OwnerPackAwardView = {
    enabled: true,
    products,
    awards: [],
    next: null,
  };
  const requests: OwnerPackAwardCommand[] = [];
  let committed: OwnerPackAwardReceipt | null = null;
  let failHistory = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const compiled = await build({
    entryPoints: ["tests/fixtures/owner-pack-awards.tsx"],
    bundle: true,
    write: false,
    outdir: ".isolated-award-fixture",
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-next-link",
        setup(builder) {
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: path.resolve("tests/fixtures/community-framework-shim.tsx"),
          }));
        },
      },
    ],
  });
  const script = compiled.outputFiles.find((file) =>
    file.path.endsWith(".js"),
  )!.text;
  const css = compiled.outputFiles.find((file) =>
    file.path.endsWith(".css"),
  )!.text;
  const globals = await readFile("src/app/globals.css", "utf8");
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/search") {
      expect(url.searchParams.get("category")).toBe("members");
      return route.fulfill({
        json: {
          query: "Synthetic",
          page: 1,
          pageSize: 20,
          hasMore: false,
          categories: ["members"],
          results: [member, duplicateName].map((id) => ({
            id,
            category: "members",
            title: "Synthetic member",
            detail: "Account enabled",
            href: `/admin/workspace/users?record=${id}`,
          })),
        },
      });
    }
    if (url.pathname === "/api/admin/pack-awards") {
      expect(route.request().headers()["x-docked-owner"]).toBe(signedInOwner);
      if (route.request().method() === "GET") {
        if (failHistory) {
          failHistory = false;
          return route.fulfill({
            status: 503,
            json: { error: "Isolated history outage" },
          });
        }
        return route.fulfill({ json: view });
      }
      const command = ownerPackAwardCommand.parse(
        route.request().postDataJSON(),
      );
      requests.push(command);
      if (!committed) {
        committed = {
          id: randomUUID(),
          actor: signedInOwner,
          member: command.member,
          recipientName: "Synthetic member",
          request: command.request,
          reason: command.reason,
          reference: command.reference,
          createdAt: new Date().toISOString(),
          packs: command.lines.flatMap((line) =>
            Array.from({ length: line.quantity }, () => ({
              id: randomUUID(),
              sport: line.sport,
              family: line.family,
              size: line.size,
              name: commercialPack(line.sport, line.family, line.size).name,
            })),
          ),
        };
        view.awards = [committed];
        // A saved award whose response never reaches the browser.
        return route.abort("failed");
      }
      expect(command).toEqual(requests[0]);
      failHistory = true;
      return route.fulfill({ json: committed });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404 });
    if (url.pathname === "/fixture.js")
      return route.fulfill({ contentType: "text/javascript", body: script });
    if (url.pathname === "/fixture.css")
      return route.fulfill({ contentType: "text/css", body: globals + css });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated Owner pack awards</title><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:20px;background:#03101e;color:#edf5fd;font:16px system-ui}button{font:inherit;color:inherit;background:#153752;border:1px solid #46718f;border-radius:6px;padding:10px 14px}a{color:#93d0ff}</style></head><body><main id="fixture-root"></main><script>window.ownerAwardFixture=${JSON.stringify({ owner: signedInOwner, view }).replaceAll("<", "\\u003c")}</script><script src="/fixture.js"></script></body></html>`,
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://fixture.invalid/admin/pack-awards");
  await page
    .getByLabel("Customer name or member ID", { exact: true })
    .fill("Synthetic");
  await page
    .getByRole("button", { name: "Find customer", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Select Synthetic member, ${member}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText(`Member ID: ${member}`, { exact: true }),
  ).toBeVisible();

  const premium = products.find(
    (p) => p.sport === "nfl" && p.family === "PREMIUM" && p.size === 1,
  )!;
  const standard = products.find(
    (p) => p.sport === "nfl" && p.family === "STANDARD" && p.size === 9,
  )!;
  await expect(
    page
      .getByRole("combobox", { name: "Pack option", exact: true })
      .locator("option"),
  ).toHaveCount(18);
  await page
    .getByRole("combobox", { name: "Pack option", exact: true })
    .selectOption(premium.id);
  await page.getByLabel("Quantity", { exact: true }).fill("21");
  await expect(
    page.getByRole("button", { name: "Add pack", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add pack", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Pack option", exact: true })
    .selectOption(standard.id);
  await page.getByRole("button", { name: "Add pack", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Reason", exact: true })
    .selectOption("PRIZE");
  await page
    .getByLabel("Internal reference", { exact: true })
    .fill("Synthetic prize winner 01");
  await page.getByRole("button", { name: "Review award", exact: true }).click();
  const review = page.getByRole("region", {
    name: "Review free pack award",
    exact: true,
  });
  await expect(
    review.getByText(`Customer: ${member}`, { exact: true }),
  ).toBeVisible();
  await expect(
    review.getByText("2 packs · 10 cards · Free", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.screenshot({
    path: testInfo.outputPath("mixed-award-review-mobile.png"),
    fullPage: true,
  });
  const secondTab = await page.context().newPage();
  await secondTab.goto("https://fixture.invalid/admin/pack-awards");
  await secondTab
    .getByLabel("Customer name or member ID", { exact: true })
    .fill("Synthetic");
  await secondTab
    .getByRole("button", { name: "Find customer", exact: true })
    .click();
  await secondTab
    .getByRole("button", {
      name: `Select Synthetic member, ${member}`,
      exact: true,
    })
    .click();
  await secondTab
    .getByRole("combobox", { name: "Pack option", exact: true })
    .selectOption(premium.id);
  await secondTab
    .getByRole("button", { name: "Add pack", exact: true })
    .click();
  await secondTab
    .getByRole("combobox", { name: "Pack option", exact: true })
    .selectOption(standard.id);
  await secondTab
    .getByRole("button", { name: "Add pack", exact: true })
    .click();
  await secondTab
    .getByRole("combobox", { name: "Reason", exact: true })
    .selectOption("PRIZE");
  await secondTab
    .getByLabel("Internal reference", { exact: true })
    .fill("Synthetic prize winner 01");
  await secondTab
    .getByRole("button", { name: "Review award", exact: true })
    .click();
  const key = `docked:owner-pack-award:pending:${owner}`;
  // Hold the shared lock until both tabs have queued confirmation. This forces
  // the get/save race that would create two different requests without locking.
  await page.evaluate(
    (key) =>
      new Promise<void>((ready) => {
        void navigator.locks.request(
          key,
          () =>
            new Promise<void>((release) => {
              (
                window as unknown as { releaseAwardLock: () => void }
              ).releaseAwardLock = release;
              ready();
            }),
        );
      }),
    key,
  );
  await Promise.all([
    page.getByRole("button", { name: "Award 2 packs", exact: true }).click(),
    secondTab
      .getByRole("button", { name: "Award 2 packs", exact: true })
      .click(),
  ]);
  await page.evaluate(() =>
    (window as unknown as { releaseAwardLock: () => void }).releaseAwardLock(),
  );
  await expect(
    page.getByRole("button", {
      name: "Check and retry saved award",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Review award", exact: true }),
  ).toBeDisabled();
  await expect(
    secondTab.getByRole("button", {
      name: "Check and retry saved award",
      exact: true,
    }),
  ).toBeEnabled();
  expect(requests).toHaveLength(1);
  await secondTab.close();
  const pending = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), key))!,
  );
  expect(pending.owner).toBe(owner);
  expect(pending.command).toEqual(requests[0]);
  expect(requests[0].member).toBe(member);
  expect(
    requests[0].lines.map((line) => [line.family, line.size, line.quantity]),
  ).toEqual([
    ["PREMIUM", 1, 1],
    ["STANDARD", 9, 1],
  ]);

  await page.reload();
  await page
    .getByRole("button", { name: "Check and retry saved award", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Packs awarded", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Their credit balance is unchanged.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Pack awards could not be loaded. Refresh to retry.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Check and retry saved award",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(view.awards).toHaveLength(1);
  expect(committed!.packs).toHaveLength(2);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await page.screenshot({
    path: testInfo.outputPath("recovered-award-mobile.png"),
    fullPage: true,
  });

  // A different Owner on the same browser cannot see or replay the first Owner's pending command.
  await page.evaluate(
    ({ key, pending }) => localStorage.setItem(key, JSON.stringify(pending)),
    { key, pending },
  );
  signedInOwner = otherOwner;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Award packs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved award request", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).not.toBeNull();
  expect(requests).toHaveLength(2);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
