/** Loopback-only, existing receipt UI. No purchases, database, credentials or ownership writes. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixtureMarkup,
  packFixtureStyles,
} from "../tests/fixtures/pack-browser";
import { previewPackReceipt } from "../src/components/pack-opening-preview";

async function main() {
  const script = await bundleCommunityFixture(
    "tests/fixtures/pack-opening.tsx",
  );
  const css = (
    await Promise.all(
      packFixtureStyles.map((name) => readFile(`src/app/${name}.css`, "utf8")),
    )
  ).join("\n");
  const receipt = previewPackReceipt("afl");
  receipt.id = "local-pack-review-nine";
  receipt.cards[3].name = "Alexandria Montgomery-Wetherington";
  receipt.cards[3].team = "North Melbourne Kangaroos";
  createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1:4192").pathname;
    res.setHeader("Cache-Control", "no-store");
    try {
      if (path === "/" || path === "/pack") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          '<!doctype html><html lang="en"><head><title>Docked · Pack review and sharing</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/preview.css"></head><body class="fantasy-mode"><div style="max-width:720px;margin:20px auto;padding:16px"><p>LOCAL DESIGN REVIEW · Synthetic AFL cards. No purchases, balances or ownership changes.</p><main id="fixture-root"></main></div><script src="/preview.js"></script></body></html>',
        );
      } else if (path === "/preview.js") {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(script);
      } else if (path === "/preview.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else if (path === "/receipt") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(receipt));
      } else if (path.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            eligibility: { allowed: false, reason: "Isolated preview" },
            rows: [],
            seasons: [],
            scores: [],
          }),
        );
      } else if (req.method !== "GET") {
        res.statusCode = 405;
        res.end("This preview cannot purchase or issue cards.");
      } else {
        const file = await packFixtureMarkup(path);
        res.statusCode = file.status ?? 200;
        if (file.contentType) res.setHeader("Content-Type", file.contentType);
        res.end(file.body);
      }
    } catch {
      res.statusCode = 500;
      res.end("Preview unavailable");
    }
  }).listen(4192, "127.0.0.1", () =>
    console.log(
      "Docked isolated review/share preview: http://127.0.0.1:4192/pack?cinema=v3",
    ),
  );
}
void main();
