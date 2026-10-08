// Local static-component layout evidence only; no Auth/API/production claim.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import { FantasyScreen } from "../src/components/fantasy-screen";
import type { FantasyState } from "../src/core/fantasy";

async function main() {
  const out = "docs/qa/fantasy-production";
  const state: FantasyState = {
    mode: "production",
    user_id: "10000000-0000-4000-8000-000000000001",
    credits: 0,
    fee_bps: 0,
    admin: false,
    catalog: null,
    cards: [],
    packs: [],
    shop: [],
    market: [],
    trades: [],
    competitions: [],
    entries: [],
    results: [],
    ledger: [],
    provenance: [],
    members: [],
    replacements: [],
    rewards: {
      server_time: "2026-10-08T00:00:00Z",
      period_timezone: "UTC",
      next_claim_at: "2026-10-08T00:00:00Z",
      claimed_today: false,
      points: 0,
      starter_claimed: false,
      policy: {
        daily_points: 10,
        card_every: 7,
        daily_card_limit: 100,
        version: 1,
      },
      history: [],
    },
  };
  const css = (
    await Promise.all(
      ["brand-theme", "globals", "fantasy", "mobile-app"].map((n) =>
        readFile(`src/app/${n}.css`, "utf8"),
      ),
    )
  ).join("\n");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/brand/")) {
        const root = path.resolve("public");
        const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        const type = file.endsWith(".webp")
          ? "image/webp"
          : file.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
        res.writeHead(200, { "Content-Type": type });
        res.end(await readFile(file));
        return;
      }
      const tab = url.pathname.endsWith("market") ? "market" : "cards";
      const html = renderToStaticMarkup(
        createElement(FantasyScreen, { tab, initial: state }),
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked local free-play layout fixture</title><style>${css}</style><body class="fantasy-mode"><main style="max-width:1440px;margin:auto;padding:16px"><p>LOCAL LAYOUT FIXTURE · no live account or API</p>${html}</main></body></html>`,
      );
    } catch {
      res.writeHead(500).end("Fixture failed");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No local port");
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: object[] = [];
  try {
    for (const width of [390, 1440])
      for (const tab of ["cards", "market"]) {
        const page = await browser.newPage({
          viewport: { width, height: 960 },
        });
        const response = await page.goto(
          `http://127.0.0.1:${address.port}/${tab}`,
        );
        await page.screenshot({
          path: `${out}/${tab}-${width}.png`,
          fullPage: true,
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        const text = await page.locator("body").innerText();
        const expected =
          tab === "cards"
            ? text.includes("Claim free Starter pack") &&
              text.includes("Claim daily reward")
            : text.includes("Marketplace is not open yet");
        results.push({
          width,
          tab,
          status: response?.status(),
          overflow,
          expectedCopy: expected,
          staticFixture: true,
        });
        if (overflow || !expected || response?.status() !== 200)
          process.exitCode = 1;
        await page.close();
      }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await writeFile(
    `${out}/layout.json`,
    JSON.stringify(
      {
        scope:
          "Chromium desktop and mobile-width static component rendering; no hydration, API, Android or iPhone verification",
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
