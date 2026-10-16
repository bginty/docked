// LOCAL ONLY synthetic accounts. No environment credentials or external DB.
import { createServer } from "node:http";
import {
  existsSync as requireExists,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { executeCredits } from "../src/core/credits-sandbox";
import { premiumUltraPackUpgrade } from "../src/core/card-economy";
import { marketQuery, marketplaceView } from "../src/core/marketplace";
import {
  memberTestView,
  memberTestCommand,
  testReceipt,
} from "../src/core/member-test-wallet";
async function main() {
  const dir = process.argv.includes("--master-v2") ? "docs/qa/master-v2/market" : process.argv.includes("--visual-regression")
    ? "docs/qa/mobile-cleanup/market-regression"
    : "docs/qa/marketplace-phase-one";
  mkdirSync(dir, { recursive: true });
  let s = marketplaceFixture(),
    origin = "",
    dropBuy = false;
  if (process.argv.includes("--premium-v3"))
    premiumUltraPackUpgrade(s.economy!, Date.now());
  const own = (i: number) =>
    Object.keys(s.cards).filter(
      (id) => s.commerce.cards[id].owner === marketActors[i].id,
    );
  // Two initial synthetic listings for browse/recovery, no real-account operation.
  for (const [i, card] of own(1).slice(0, 2).entries())
    s = executeCredits(
      s,
      marketActors[1],
      `fixture-list-${i}`,
      { kind: "list", card, price: 1000 + i },
      Date.now(),
    ).state;
  const script = await bundleCommunityFixture(
    process.argv.includes("--visual") || process.argv.includes("--pack-flow")
      ? "tests/fixtures/mobile-visual.tsx"
      : "tests/fixtures/marketplace.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "sports-visuals",
    "sports-experience",
    "community-app",
    "native",
    "mobile-app",
    "app-auth",
    "beta-experience",
    "fantasy",
    "fantasy-play",
    "pack-opening",
    "scoring",
    "test-wallet",
    "marketplace",
    ...(requireExists("src/app/mobile-cleanup.css") ? ["mobile-cleanup"] : []),
    ...(requireExists("src/app/play-cards.css") ? ["play-cards"] : []),
    ...(requireExists("src/app/social-hub.css") ? ["social-hub"] : []),
    "collectible",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, origin);
      assert.equal(req.headers.host, new URL(origin).host);
      const actor =
        marketActors[req.headers.cookie?.includes("qa=bob") ? 1 : 0];
      const json = (v: unknown, status = 200) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(v));
      };
      if (u.pathname === "/local-identity") {
        json({ member: actor.id });
        return;
      }
      if (
        u.pathname === "/api/marketplace" ||
        u.pathname === "/api/test-wallet"
      ) {
        let result: unknown = null;
        if (req.method === "POST") {
          const chunks = [];
          for await (const b of req) chunks.push(b);
          const input = JSON.parse(Buffer.concat(chunks).toString());
          const cmd = memberTestCommand(input.command);
          const out = executeCredits(s, actor, input.request, cmd, Date.now());
          s = out.state;
          result = out.result;
          if (cmd.kind === "open-pack")
            result = testReceipt(s, cmd.entitlement, actor.id);
          if (dropBuy && (cmd.kind === "buy" || cmd.kind === "buy-pack")) {
            dropBuy = false;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end("{");
            return;
          }
        }
        json({
          state:
            u.pathname === "/api/marketplace"
              ? marketplaceView(
                  s,
                  actor.id,
                  marketLabels,
                  marketQuery.parse(Object.fromEntries(u.searchParams)),
                )
              : memberTestView(s, actor.id, marketLabels),
          result,
        });
        return;
      }
      if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(script);
        return;
      }
      if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (
        u.pathname.startsWith("/brand/") ||
        u.pathname.startsWith("/images/")
      ) {
        const p = resolve("public", "." + u.pathname);
        assert.ok(p.startsWith(resolve("public") + sep));
        res.setHeader(
          "Content-Type",
          p.endsWith(".svg")
            ? "image/svg+xml"
            : p.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        res.end(readFileSync(p));
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked LOCAL marketplace</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><p style="padding:4px 12px;margin:0;font-size:11px">LOCAL VISUAL FIXTURE · no real accounts or credits</p><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: (e as Error).message, outcome: "rejected" }),
      );
    }
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? (process.argv.includes("--master-v2") ? 3024 : 3023) : 0, "127.0.0.1", r),
  );
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(`Local synthetic marketplace: ${origin}/fantasy/market`);
    return;
  }
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: string[] = [];
  try {
    if (process.argv.includes("--pack-flow")) {
      await (
        await import("./social-pack-flow")
      ).verifyPackFlow(
        browser,
        origin,
        () => s,
        () => {
          dropBuy = true;
        },
      );
      return;
    }
    const a = await browser.newContext({
        viewport: { width: 412, height: 915 },
        timezoneId: "Australia/Sydney",
        reducedMotion: "reduce",
      }),
      b = await browser.newContext();
    await b.addCookies([{ name: "qa", value: "bob", url: origin }]);
    const capture = async (p: Page, name: string) => {
      const previous = p.viewportSize()!;
      for (const [label, width] of [
        ["mobile", 412],
        ["desktop", 1440],
      ] as const) {
        await p.setViewportSize({ width, height: 915 });
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${name} overflow ${label}`,
        );
        await p.screenshot({
          path: `${dir}/${name}-${label}.png`,
          fullPage: !(await p.getByRole("dialog").count()),
        });
      }
      await p.setViewportSize(previous);
    };
    const page = await a.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/fantasy/market");
    await expect(
      page.getByRole("heading", { name: "Market", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View card & buy" }).first(),
    ).toBeVisible();
    await capture(page, "browse");
    const detailTrigger = page
      .getByRole("button", { name: "View card & buy" })
      .first();
    await detailTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
        true,
      );
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(detailTrigger).toBeFocused();
    checks.push(
      "Keyboard Enter/Tab focus containment, Escape dismissal and focus restoration",
    );
    await page
      .getByRole("button", { name: "My Listings", exact: true })
      .click();
    await page
      .getByText("Create listing from your owned cards", { exact: true })
      .click();
    await page.getByLabel("Exact owned card").selectOption(own(0)[0]);
    await page.getByLabel("Asking price · Docked Credits").fill("1000");
    await page
      .getByRole("button", { name: "Review listing", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Seller receives 925");
    await capture(page, "sell-review");
    await page
      .getByRole("button", { name: "Confirm listing", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Listed", exact: true }),
    ).toBeVisible();
    const listing = Object.entries(s.listings).find(
      ([, l]) => l.member === marketActors[0].id,
    )![0];
    const buyer = await b.newPage();
    await buyer.goto(origin + "/fantasy/market");
    await buyer.getByRole("button", { name: "View card & buy" }).click();
    await buyer
      .getByRole("button", { name: "Review purchase", exact: true })
      .click();
    await expect(buyer.getByRole("dialog")).toContainText(
      "Seller receives 925",
    );
    await capture(buyer, "purchase-review");
    dropBuy = true;
    await buyer
      .getByRole("button", { name: "Confirm purchase · 1,000 credits" })
      .click();
    await expect(
      buyer
        .getByRole("button", { name: "Recover original transaction" })
        .first(),
    ).toBeVisible();
    await buyer.reload();
    await buyer
      .getByRole("button", { name: "Recover original transaction" })
      .click();
    await expect(
      buyer.getByRole("heading", { name: "Purchased", exact: true }),
    ).toBeVisible();
    await capture(buyer, "purchase-success");
    let posts = 0;
    await buyer.route("**/api/community", async (r) => {
      posts++;
      await r.fulfill({
        status: 503,
        json: { error: "Synthetic post recovery" },
      });
    });
    await buyer.getByRole("button", { name: "Share your new card" }).click();
    assert.equal(posts, 0);
    const draft = buyer.getByRole("textbox", { name: "Your post" });
    assert.ok(!(await draft.inputValue()).includes("1000"));
    await buyer.getByRole("button", { name: "Preview post", exact: true }).click();
    await buyer.getByRole("button", { name: "Post", exact: true }).click();
    await expect(buyer.getByRole("status").last()).toContainText(
      "Synthetic post recovery",
    );
    assert.equal(posts, 1);
    await buyer.keyboard.press("Escape");
    await expect(
      buyer.getByRole("button", { name: "Share your new card" }),
    ).toHaveCount(0);
    checks.push(
      "Acquisition sharing is an editable privacy-minimised draft; explicit Post required, failure retains text, dismissal prevents repeat prompt",
    );
    assert.equal(s.listings[listing].status, "SOLD");
    assert.equal(
      s.cards[
        own(1).find((id) => id === s.listings[listing].card)!
      ].history.filter((h) => h.reference === listing).length,
      1,
    );
    checks.push(
      "Create listing, 1000/925/75 review, completed purchase response lost, reload and original receipt recovery exactly once",
    );
    await buyer
      .getByRole("button", { name: "View receipt", exact: true })
      .click();
    await expect(
      buyer.getByText(/commission 75 · seller receives 925/),
    ).toBeVisible();
    await capture(buyer, "activity");
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("Player search").fill("zz-missing");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByRole("heading", { name: "No matching results" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(page.getByLabel("Player search")).toHaveValue("zz-missing");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.route("**/api/marketplace?**", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Local injected service failure" }),
      }),
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(
      "Local injected service failure",
    );
    await page.unroute("**/api/marketplace?**");
    await page.getByRole("button", { name: "Retry loading" }).click();
    await expect(
      page.getByRole("button", { name: "View card & buy" }).first(),
    ).toBeVisible();
    checks.push(
      "Filter URL/refresh, no results, injected HTTP failure and bounded recovery",
    );
    await page.route("**/api/marketplace?**", (r) =>
      r.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Sign in with your invited account." }),
      }),
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(
      "Sign in with your invited account",
    );
    await expect(
      page.getByRole("button", { name: "View card & buy" }),
    ).toHaveCount(0);
    await page.unroute("**/api/marketplace?**");
    await page.getByRole("button", { name: "Retry loading" }).click();
    await expect(
      page.getByRole("button", { name: "View card & buy" }).first(),
    ).toBeVisible();
    await page.route("**/api/marketplace?**", async (r) => {
      const response = await r.fetch();
      const d = await response.json();
      d.state.member = marketActors[1].id;
      await r.fulfill({ response, json: d });
    });
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Account changed");
    await expect(
      page.getByRole("button", { name: "View card & buy" }),
    ).toHaveCount(0);
    await page.unroute("**/api/marketplace?**");
    await page.getByRole("button", { name: "Retry loading" }).click();
    checks.push(
      "Expired-session response recovery and wrong-account read rejected without displaying previous inventory",
    );
    // Definitive cancellation refreshes the still-open review; it does not leave an actionable stale purchase.
    await page.getByRole("button", { name: "View card & buy" }).first().click();
    await page
      .getByRole("button", { name: "Review purchase", exact: true })
      .click();
    const reviewedText = await page.getByRole("dialog").innerText();
    const cancelled = Object.entries(s.listings).find(
      ([, l]) =>
        l.status === "OPEN" &&
        l.member === marketActors[1].id &&
        reviewedText.includes(l.card),
    )![0];
    s = executeCredits(
      s,
      marketActors[1],
      "cancel-during-review",
      { kind: "cancel-listing", listing: cancelled },
      Date.now(),
    ).state;
    await page.getByRole("button", { name: /Confirm purchase ·/ }).click();
    await expect(page.getByRole("dialog")).toContainText("CANCELLED");
    await expect(
      page.getByRole("button", { name: /Confirm purchase ·/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Recover original transaction" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    checks.push(
      "Definitive cancelled-purchase rejection refreshes authoritative listing and clears stale consent; no duplicate recovery ID",
    );
    // Expired financial swap remains immutable history but Accept is absent.
    const ca = own(0)[1],
      cb = own(1).find(
        (c) =>
          !Object.values(s.listings).some(
            (l) => l.card === c && l.status === "OPEN",
          ),
      )!;
    s = executeCredits(
      s,
      marketActors[0],
      "expired-local",
      {
        kind: "offer",
        other: marketActors[1].id,
        give: [ca],
        take: [cb],
        feeEach: 50,
      },
      Date.now() - 2 * 86400000,
    ).state;
    await buyer.getByRole("button", { name: "Swaps", exact: true }).click();
    await expect(buyer.getByRole("heading", { name: /EXPIRED/ })).toBeVisible();
    await expect(
      buyer.getByRole("button", { name: "Accept swap", exact: true }),
    ).toHaveCount(0);
    checks.push("Expired offer labelled EXPIRED; no acceptance control");
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    for (const width of [360, 412, 1440]) {
      await page.setViewportSize({ width, height: 915 });
      await expect(
        page.getByRole("button", { name: "View card & buy" }).first(),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `overflow ${width}`);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await page.screenshot({
        path: `${dir}/market-${width}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    checks.push("360/412/1440 responsive, axe WCAG A/AA and console checks");
    writeFileSync(
      dir + "/browser.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          scope:
            "LOCAL real components/domain engine with synthetic cookie identity and in-memory HTTP transport. NOT authenticated application HTTP/database E2E; NOT hosted or physical S24.",
          checks,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }));
    await a.close();
    await b.close();
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
