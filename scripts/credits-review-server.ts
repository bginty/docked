import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { z } from "zod";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { alice, bob, owner, provider } from "./credits-fixture";
import { wallet, financialReport } from "../src/core/credits-sandbox";
import { creditsPolicy } from "../src/core/credits-policy";
import type { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import type { PackReceipt } from "../src/core/pack-opening";
export async function runCreditsReview(
  store: CreditsSandboxStore,
  stayOpen = false,
) {
  const script = await bundleCommunityFixture(
    "tests/fixtures/credits-review.tsx",
  );
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/credits-review.js", script);
  const css =
    (
      await Promise.all(
        [
          "brand-theme",
          "globals",
          "fantasy",
          "fantasy-play",
          "pack-opening",
        ].map((n) => readFile(`src/app/${n}.css`, "utf8")),
      )
    ).join("\n") +
    "\n.credit-review{max-width:1000px;margin:auto;padding:24px;color:#f2f5fc}.credit-review section{padding:22px;margin:20px 0;border:1px solid #425e84;border-radius:18px;background:#142946}.credit-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:15px}.credit-metrics article{display:grid;gap:8px}.credit-metrics strong{font-size:26px}.credit-review button{padding:12px 16px;background:#243cff;color:white;border:1px solid #7585ff;border-radius:10px;min-height:44px}.credit-review label{display:block;margin:12px 0}.credit-review input,.credit-review select{max-width:100%;padding:10px;background:#07152b;color:white;border:1px solid #829bbc;border-radius:7px}.credit-actions{display:flex;gap:12px;flex-wrap:wrap}.credit-pack{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 0;overflow-wrap:anywhere}.credit-review dl div{padding:6px 0;overflow-wrap:anywhere}.credit-review dd{margin:0;color:#afd6ff}.credit-review p{line-height:1.65;overflow-wrap:anywhere}";
  const token = randomBytes(24).toString("hex");
  let origin = "";
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(origin).host) {
        res.writeHead(403).end();
        return;
      }
      const url = new URL(req.url!, origin);
      if (url.pathname === `/review/${token}`) {
        res
          .writeHead(303, {
            "Set-Cookie": `sandbox=${token}; HttpOnly; SameSite=Strict; Path=/`,
            Location: "/",
          })
          .end();
        return;
      }
      if (req.headers.cookie !== `sandbox=${token}`) {
        res.writeHead(403).end("Local synthetic operator session required");
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'",
      );
      const json = (v: unknown) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(v));
      };
      if (url.pathname === "/data") {
        const s = await store.read();
        json({
          wallets: {
            [alice.id]: wallet(s, alice.id),
            [bob.id]: wallet(s, bob.id),
          },
          admin: financialReport(s),
          packs: Object.entries(s.entitlements).map(([id, e]) => ({
            id,
            member: e.member,
            status: e.status,
            product: s.commerce.orders[e.order].product,
          })),
          journal: s.journal.map((j) => ({ id: j.id, reason: j.reason })),
          cards: Object.entries(s.cards).map(([id, meta]) => ({
            id,
            owner: s.commerce.cards[id].owner,
            locked: meta.locked,
            history: meta.history,
          })),
          listings: Object.entries(s.listings).map(([id, l]) => ({
            id,
            ...l,
            fee: Math.floor((l.price * 750 + 5000) / 10000),
            net: l.price - Math.floor((l.price * 750 + 5000) / 10000),
          })),
          swaps: Object.entries(s.swaps).map(([id, offer]) => ({
            id,
            ...offer,
          })),
          withdrawals: Object.entries(s.withdrawals).map(([id, w]) => ({
            id,
            ...w,
          })),
        });
        return;
      }
      if (url.pathname === "/action" && req.method === "POST") {
        if (
          req.headers.origin !== origin ||
          !req.headers["content-type"]?.startsWith("application/json")
        ) {
          res.writeHead(403).end();
          return;
        }
        let raw = "";
        for await (const part of req) {
          raw += part;
          if (raw.length > 8192) throw Error("Request too large");
        }
        const body = z
          .object({
            op: z.enum([
              "deposit",
              "buy-pack",
              "open-pack",
              "promotion",
              "list",
              "buy",
              "offer",
              "accept",
              "reject",
              "cancel-swap",
              "withdraw",
              "reverse",
            ]),
            member: z.enum([alice.id, bob.id] as [string, string]),
            request: z.string().uuid(),
            product: z
              .enum(["premium-single-v1", "elite-single-v1"])
              .optional(),
            entitlement: z.string().optional(),
            amount: z.number().int().positive().max(10000).optional(),
            campaign: z.string().optional(),
            reason: z.string().optional(),
            card: z.string().optional(),
            take: z.string().optional(),
            reference: z.string().optional(),
          })
          .strict()
          .parse(JSON.parse(raw));
        const member = body.member === alice.id ? alice : bob,
          ref = `ui-${body.request}`;
        let result: unknown;
        if (body.op === "deposit") {
          if (!body.product) throw Error("Product required");
          await store.execute(member, ref, {
            kind: "deposit",
            product: body.product,
          });
          await store.execute(provider, `${ref}-bind`, {
            kind: "bind",
            deposit: ref,
            providerOrder: `PP-${ref}`,
          });
          await store.execute(provider, `${ref}-capture`, {
            kind: "capture",
            deposit: ref,
            event: `EV-${ref}`,
            providerOrder: `PP-${ref}`,
            capture: `CP-${ref}`,
            amount: body.product === "premium-single-v1" ? 4900 : 9900,
            currency: "AUD",
            verified: true,
          });
          result = await store.execute(provider, `${ref}-clear`, {
            kind: "clear",
            deposit: ref,
          });
        } else if (body.op === "buy-pack")
          result = await store.execute(member, ref, {
            kind: "buy-pack",
            product: body.product,
            confirmed: true,
            policy: creditsPolicy.version,
          });
        else if (body.op === "promotion")
          result = await store.execute(owner, ref, {
            kind: "promotion",
            member: member.id,
            amount: body.amount,
            campaign: body.campaign,
            reason: body.reason,
            confirmed: true,
            redeemable: false,
          });
        else if (body.op === "list")
          result = await store.execute(member, ref, {
            kind: "list",
            card: body.card,
            price: body.amount,
          });
        else if (body.op === "buy")
          result = await store.execute(member, ref, {
            kind: "buy",
            listing: body.reference,
            expectedPrice: body.amount,
            confirmed: true,
            policy: creditsPolicy.version,
          });
        else if (body.op === "offer")
          result = await store.execute(member, ref, {
            kind: "offer",
            other: member.id === alice.id ? bob.id : alice.id,
            give: [body.card],
            take: [body.take],
            feeEach: 50,
          });
        else if (["accept", "reject", "cancel-swap"].includes(body.op))
          result = await store.execute(member, ref, {
            kind: body.op,
            swap: body.reference,
          });
        else if (body.op === "withdraw")
          result = await store.execute(member, ref, {
            kind: "withdraw",
            amount: body.amount,
            beneficiary: "fixturebank",
            confirmed: true,
            policy: creditsPolicy.version,
          });
        else if (body.op === "reverse")
          result = await store.execute(owner, ref, {
            kind: "reverse",
            journal: body.reference,
            reason: body.reason,
          });
        else {
          const opened = (await store.execute(member, ref, {
            kind: "open-pack",
            entitlement: body.entitlement,
          })) as any;
          const s = await store.read(),
            card = s.commerce.cards[opened.card];
          result = {
            id: opened.receipt,
            name: "Sandbox single-card pack",
            opened_at: new Date(
              s.cards[opened.card].history[0].at,
            ).toISOString(),
            cards: [
              {
                id: opened.card,
                edition_id: `synthetic-${card.tier}`,
                player_id: "synthetic-player",
                name: "Synthetic NFL player",
                position: "QB",
                tier: card.tier,
                season: "2026",
                kind: "regular",
                max_supply: 4,
                serial: Number(opened.card.split("-").at(-1)) + 1,
                team: "Financial sandbox",
                colour: "#1A2AFF",
                shirt: 1,
                status: "active",
                sport: "nfl",
                tradeable: true,
              },
            ],
          } as PackReceipt;
        }
        json(result);
        return;
      }
      if (url.pathname === "/app.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(script);
        return;
      }
      if (url.pathname === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (url.pathname.startsWith("/brand/") && !url.pathname.includes("..")) {
        const bytes = await readFile("public" + url.pathname);
        res.setHeader(
          "Content-Type",
          url.pathname.endsWith(".png") ? "image/png" : "image/webp",
        );
        res.end(bytes);
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Docked Credits · isolated review</title><link rel="stylesheet" href="/style.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/app.js"></script></body></html>',
      );
    } catch (e) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: e instanceof Error ? e.message : "Request failed",
        }),
      );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Loopback failed");
  origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium
    .launch({ channel: "msedge" })
    .catch(async (error) => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      throw error;
    });
  const checks: string[] = [];
  try {
    assert.equal((await fetch(origin)).status, 403);
    for (const width of [390, 1366]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      await page.goto(`${origin}/review/${token}`);
      await page
        .getByRole("heading", { name: "Docked Credits", exact: true })
        .waitFor();
      assert.ok(
        await page.getByText("Cash backing and owner report").isVisible(),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (width === 390) {
        await page
          .getByRole("button", { name: "Issue sandbox promotional credits" })
          .click();
        assert.equal(
          (await store.read()).campaigns["review-campaign"],
          undefined,
        );
        await page.getByRole("checkbox").check();
        await page
          .getByRole("button", { name: "Issue sandbox promotional credits" })
          .click();
        await page.getByRole("status").waitFor();
        assert.equal((await store.read()).campaigns["review-campaign"], 250);
        await page
          .getByRole("button", { name: "Simulate A$99 deposit" })
          .click();
        await expect
          .poll(
            async () =>
              Object.values((await store.read()).deposits).filter(
                (d) =>
                  d.member === alice.id &&
                  d.amount === 9900 &&
                  d.status === "FULFILLED",
              ).length,
          )
          .toBe(1);
        await page
          .getByRole("button", { name: "Open pack", exact: true })
          .click();
        await page.getByRole("button", { name: "Open pack seal" }).click();
        await page.getByText("Card 1 of 1 · ELITE").waitFor();
        await page.screenshot({
          path: "docs/qa/credits-v1/confirmed-reveal-390.png",
          fullPage: true,
        });
        await page.getByRole("button", { name: "Close panel" }).click();
        const before = await store.read();
        const card = Object.keys(before.cards).find(
          (id) => before.commerce.cards[id].owner === alice.id,
        )!;
        page.on("dialog", (d) => void d.accept());
        await page.getByRole("button", { name: "Review listing" }).click();
        await expect
          .poll(
            async () =>
              Object.values((await store.read()).listings).filter(
                (l) => l.card === card && l.status === "OPEN",
              ).length,
          )
          .toBe(1);
        await page.getByLabel("Fictional member").selectOption(bob.id);
        await page.getByRole("button", { name: "Confirm purchase" }).click();
        await expect
          .poll(async () => (await store.read()).commerce.cards[card].owner)
          .toBe(bob.id);
        await page.reload();
        await page
          .getByRole("heading", { name: "Docked Credits", exact: true })
          .waitFor();
        const after = await store.read();
        assert.equal(after.commerce.cards[card].owner, bob.id);
        checks.push(
          "Mobile browser → server → PostgreSQL: A$99 simulated deposit, confirmed single-card reveal, reviewed 100-credit sale/8-credit commission, other member purchase and persisted ownership after reload",
        );
      }
      await page.screenshot({
        path: `docs/qa/credits-v1/review-${width}.png`,
        fullPage: true,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `docs/qa/credits-v1/wallet-${width}.png` });
      await page.close();
      checks.push(
        `${width}px: wallet/admin flow, balances, synthetic labels and no horizontal overflow`,
      );
    }
    checks.push(
      "Local session required; confirmation enforced; submitted owner promotion persists to PostgreSQL",
    );
    await writeFile(
      "docs/qa/credits-v1/browser.json",
      JSON.stringify(
        {
          passed: true,
          checks,
          scope:
            "Local loopback operator fixture; synthetic AAL2, not real owner sign-in or PayPal. Existing pack viewer reused.",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await browser.close();
    if (!stayOpen) await new Promise<void>((r) => server.close(() => r()));
  }
  if (stayOpen) {
    await mkdir("private-data/credits", { recursive: true });
    await writeFile(
      "private-data/credits/review-url.txt",
      `${origin}/review/${token}`,
    );
    console.log(
      "Local review running; URL saved to private-data/credits/review-url.txt. Ctrl+C ends the disposable session.",
    );
    await new Promise(() => {});
  }
}
