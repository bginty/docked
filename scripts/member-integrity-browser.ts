import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixture,
  packMember,
  packNow,
} from "../tests/fixtures/pack-economy";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
import { executeCredits } from "../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../src/core/member-test-wallet";
import { quoteCoupon } from "../src/core/pack-coupons";
import type {
  CommunityFeed,
  SocialProfile,
} from "../src/core/community-social";
async function main() {
  const out = "docs/qa/member-integrity";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "tests/fixtures/member-integrity-ui.tsx",
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
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "card-viewer",
    "premium-ux",
    "pack-shop",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let state = packFixture();
  const products = paidPackCatalogueUpgrade(state.economy!, packNow),
    product = products.find((p) => p.type === "STANDARD" && p.cards === 9)!;
  const owner = { id: "local-owner", role: "reviewer", aal: "aal2" } as const;
  const terms = {
    code: "LOCAL50",
    type: "percent",
    value: 50,
    sport: "nfl",
    products: [product.id],
    startsAt: packNow,
    expiresAt: packNow + 86400000,
    totalLimit: 10,
    accountLimit: 1,
    maximumDiscount: 350,
    firstPurchaseOnly: false,
    allowZero: false,
  };
  state = executeCredits(
    state,
    owner,
    "save",
    {
      kind: "manage-coupon",
      mutation: { action: "save", terms, expectedRevision: 0 },
    },
    packNow,
  ).state;
  state = executeCredits(
    state,
    owner,
    "activate",
    {
      kind: "manage-coupon",
      mutation: { action: "activate", code: terms.code, expectedRevision: 1 },
    },
    packNow,
  ).state;
  const base = structuredClone(state);
  let purchaseCalls = 0,
    posts = 0;
  const profile: SocialProfile = {
    id: "10000000-0000-4000-8000-000000000001",
    handle: "localmember",
    displayName: "Local Member",
    bio: "Isolated browser fixture",
    avatarUrl: null,
    isOfficial: false,
    visibility: "members",
    status: "active",
    joinedAt: "2026-10-01T00:00:00Z",
    followers: 0,
    following: 0,
    isFollowing: false,
    isMuted: false,
    isBlocked: false,
    isOwn: true,
  };
  const feed: CommunityFeed = {
    status: "ready",
    message: "",
    viewer: profile,
    profiles: [],
    nextCursor: null,
    posts: [
      {
        id: "10000000-0000-4000-8000-000000000002",
        author: profile,
        kind: "discussion",
        body: "Which player are you starting at FLEX this week?",
        sport: "nfl",
        createdAt: new Date(packNow).toISOString(),
        moderationStatus: "visible",
        claimLabel: "social_only",
        officialTipId: null,
        communityEdgeId: null,
        media: [],
        reactionCount: 0,
        commentCount: 0,
        isReacted: false,
        isSaved: false,
        comments: [],
      },
    ],
  };
  const announcements = [
    {
      id: "10000000-0000-4000-8000-000000000003",
      title: "Marketplace update",
      body: "A local announcement layout fixture.",
      cta: null,
      published_at: new Date(packNow).toISOString(),
      pinned: true,
    },
  ];
  const admin = () => ({
    generatedCode: "A1B2C3D4E5F678901234",
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sport: p.sport,
      price: p.priceCredits,
    })),
    campaigns: Object.values(state.packCoupons!.campaigns).map((c) => ({
      ...c,
      effectiveStatus: c.status,
      successful: Object.keys(state.packCoupons!.redemptions).length,
      discounted: 0,
      remaining: 10,
      maximumAllocation: "3,500",
    })),
    redemptions: [],
  });
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://local");
    res.setHeader("Cache-Control", "no-store");
    const json = (v: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(v));
    };
    try {
      if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
        return;
      }
      if (u.pathname === "/fixture-state") {
        json({
          feed,
          announcements,
          admin: admin(),
          state: memberTestView(state, packMember.id, [], false, packNow),
        });
        return;
      }
      if (u.pathname === "/api/community") {
        if (req.method === "POST") {
          posts++;
          json({ id: "local-post" });
          return;
        }
        json(
          u.searchParams.get("view") === "hub"
            ? { cards: [], communities: [], suggestions: [], viewer: profile }
            : feed,
        );
        return;
      }
      if (u.pathname === "/api/pack-coupons") {
        let raw = "";
        for await (const c of req) raw += c;
        const input = JSON.parse(raw);
        const quotes = products.map((p) => {
          try {
            return {
              product: p.id,
              quote: quoteCoupon(state, packMember.id, input.code, p, packNow),
              error: null,
            };
          } catch (e) {
            return { product: p.id, quote: null, error: (e as Error).message };
          }
        });
        if (!quotes.some((q) => q.quote)) {
          json({ error: "Invalid coupon code." }, 400);
          return;
        }
        json({ code: terms.code, terms, quotes });
        return;
      }
      if (u.pathname === "/api/test-wallet") {
        let result: unknown = null;
        if (req.method === "POST") {
          let raw = "";
          for await (const c of req) raw += c;
          const input = JSON.parse(raw);
          if (input.command.kind === "buy-pack") purchaseCalls++;
          const next = executeCredits(
            state,
            packMember,
            input.request,
            input.command,
            packNow,
          );
          state = next.state;
          result =
            input.command.kind === "open-pack"
              ? testReceipt(state, input.command.entitlement, packMember.id)
              : next.result;
        }
        json({
          state: memberTestView(state, packMember.id, [], false, packNow),
          result,
        });
        return;
      }
      if (u.pathname.startsWith("/api/")) {
        json({ error: "Isolated fixture" }, 403);
        return;
      }
      const file = resolve("public", "." + decodeURIComponent(u.pathname));
      if (file.startsWith(resolve("public") + sep)) {
        try {
          const bytes = readFileSync(file);
          res.setHeader(
            "Content-Type",
            file.endsWith(".svg")
              ? "image/svg+xml"
              : file.endsWith(".webp")
                ? "image/webp"
                : file.endsWith(".png")
                  ? "image/png"
                  : "application/octet-stream",
          );
          res.end(bytes);
          return;
        } catch {}
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated Docked verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>`,
      );
    } catch (e) {
      json({ error: (e as Error).message, outcome: "rejected" }, 400);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks = [];
  try {
    for (const width of [412, 360, 1440]) {
      state = structuredClone(base);
      purchaseCalls = 0;
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        reducedMotion: "reduce",
      });
      page.setDefaultTimeout(15000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/fantasy/social");
      await expect(
        page.getByRole("heading", { name: "Community", exact: true }),
      ).toBeVisible();
      await expect(page.locator("textarea")).toBeEnabled();
      await page.screenshot({
        path: `${out}/social-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("link", { name: "Find people", exact: true })
        .first()
        .click();
      await page
        .getByRole("link", { name: "Start a conversation", exact: true })
        .click();
      await expect(page.locator("textarea")).toBeFocused();
      await page.locator("textarea").fill("Isolated post submission");
      const before = posts;
      await page.getByRole("button", { name: "Post", exact: true }).dblclick();
      await expect(page.getByText("Social post published.")).toBeVisible();
      assert.equal(posts, before + 1);
      await page.goto(origin + "/fantasy/test-wallet?view=packs");
      await expect(
        page.getByRole("heading", { name: "NFL Packs" }),
      ).toBeVisible();
      await page.getByLabel("Have a coupon?").fill("LOCAL50");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(page.getByText(/LOCAL50 applied/)).toBeVisible();
      await page.screenshot({
        path: `${out}/packs-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Buy Standard 9 Pack", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("350");
      await expect(dialog).toContainText("24,650");
      await page.screenshot({ path: `${out}/purchase-review-${width}.png` });
      await dialog
        .getByRole("button", { name: "Confirm Purchase", exact: true })
        .dblclick();
      await expect(
        page.getByRole("button", { name: "Reveal next card" }),
      ).toBeVisible({ timeout: 15000 });
      assert.equal(purchaseCalls, 1);
      assert.equal(Object.keys(state.packCoupons!.redemptions).length, 1);
      assert.equal(Object.keys(state.economy!.instances).length, 9);
      await page.getByRole("button", { name: "Close panel" }).click();
      await page.goto(origin + "/admin/coupons");
      await expect(
        page.getByRole("heading", { name: "Pack coupons", exact: true }),
      ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${out}/admin-coupons-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      checks.push({
        width,
        socialComposer: true,
        noOverflow: true,
        couponPurchaseOnce: true,
      });
      await page.close();
    }
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          checks,
          boundary:
            "Actual React components, local HTTP adapters and production transaction core. Hosted auth separately verified; no customer mutations.",
        },
        null,
        2,
      ),
    );
    console.log({ out, checks });
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
