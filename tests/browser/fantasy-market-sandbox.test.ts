import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import {
  sandboxTradeFees,
  tradeFeeWindow,
} from "../../src/core/fantasy-market-fees";
test("sandbox confirmation UI executes real SQL mock transaction and immutable receipt", async ({
  page,
}) => {
  test.setTimeout(120000);
  const db = new PGlite();
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  try {
    await db.exec(await readFile("sandbox/fantasy-market.sql", "utf8"));
    await db.exec(
      `update market_sandbox.policy set cycle_start='2026-10-10T00:00Z',test_clock='2026-10-13T00:00Z';insert into market_sandbox.accounts values('${id(1)}',10000),('${id(2)}',10000);insert into market_sandbox.cards(id,owner_id) values('${id(10)}','${id(1)}'),('${id(11)}','${id(2)}');insert into market_sandbox.offers(id,maker,taker,kind,give,take,price_cents) values('${id(20)}','${id(1)}','${id(2)}','swap',array['${id(10)}']::uuid[],array['${id(11)}']::uuid[],0);`,
    );
    const bundle = await bundleCommunityFixture(
      "tests/fixtures/fantasy-market.tsx",
    );
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/api/fantasy/market-proposal")
        return route.fulfill({
          json: {
            mode: "ILLUSTRATION_ONLY",
            executionEnabled: false,
            serverTime: "2026-10-13T00:00:00Z",
            policy: sandboxTradeFees,
            window: tradeFeeWindow(
              sandboxTradeFees,
              Date.parse("2026-10-13T00:00Z"),
            ),
          },
        });
      if (u.pathname === "/sandbox/quote") {
        await db.query("select set_config('sandbox.actor',$1,false)", [id(2)]);
        const q = (
          await db.query<{ v: any }>(
            "select market_sandbox.quote($1::uuid) v",
            [id(20)],
          )
        ).rows[0].v;
        await db.query("select market_sandbox.confirm($1::uuid)", [q.id]); // Explicit synthetic counterparty consent.
        return route.fulfill({ json: q });
      }
      if (u.pathname === "/sandbox/confirm") {
        await db.query("select set_config('sandbox.actor',$1,false)", [id(1)]);
        const q = (
          await db.query<{ v: any }>(
            "select market_sandbox.confirm($1::uuid) v",
            [route.request().postDataJSON().id],
          )
        ).rows[0].v;
        return route.fulfill({ json: q });
      }
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>Local transaction QA</title></head><body class="fantasy-mode"><div id="fixture-root"></div></body></html>',
      });
    });
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("https://sandbox.example.invalid");
    for (const name of ["brand-theme", "globals", "fantasy", "fantasy-play"])
      await page.addStyleTag({
        content: await readFile(`src/app/${name}.css`, "utf8"),
      });
    await page.addScriptTag({ content: bundle });
    await page
      .getByRole("button", { name: "Review sandbox trade", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("$5.00");
    await mkdir("docs/qa/fantasy-ux/screens", { recursive: true });
    await page.screenshot({
      path: "docs/qa/fantasy-ux/screens/local-paid-window-confirmation-412.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Confirm with sandbox balance" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sandbox receipt" }),
    ).toBeVisible();
    await expect(page.getByText("Status: completed")).toBeVisible();
    {
      expect(
        (
          await db.query<{ owner_id: string }>(
            "select owner_id from market_sandbox.cards where id=$1",
            [id(10)],
          )
        ).rows[0].owner_id,
      ).toBe(id(2));
    }
    expect(
      (
        await db.query<{ n: number }>(
          "select sum(cents)::int n from market_sandbox.fee_history",
        )
      ).rows[0].n,
    ).toBe(500);
    await page.screenshot({
      path: "docs/qa/fantasy-ux/screens/local-sandbox-receipt-412.png",
      fullPage: true,
    });
  } finally {
    await db.close();
  }
});
