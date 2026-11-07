/** Loopback-only synthetic UI preview. No database, credentials, purchase or inventory service. */
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
  const styles = (
    await Promise.all(
      packFixtureStyles.map((s) => readFile(`src/app/${s}.css`, "utf8")),
    )
  ).join("\n");
  const receipt = previewPackReceipt("afl");
  receipt.id = "local-navigation-demo-afl-nine";
  let opened = false;
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://127.0.0.1:4187").pathname;
      res.setHeader("Cache-Control", "no-store");
      if (path === "/" || path === "/pack") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          '<!doctype html><html lang="en"><head><title>Docked · Pack navigation review</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/preview.css"></head><body class="fantasy-mode"><div style="max-width:720px;margin:20px auto;padding:16px"><p>LOCAL DESIGN REVIEW · Synthetic AFL cards. No purchases, balances or ownership changes.</p><main id="fixture-root"></main></div><script src="/preview.js"></script></body></html>',
        );
      } else if (path === "/preview.js") {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(script);
      } else if (path === "/preview.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(styles);
      } else if (
        path === "/receipt" ||
        (path === "/open-pack" && req.method === "POST")
      ) {
        if (path === "/open-pack") opened = true;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(opened ? receipt : null));
      } else if (path.startsWith("/api/")) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(
          '{"error":"Player statistics are not connected in this synthetic preview."}',
        );
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
  });
  server.listen(4187, "127.0.0.1", () =>
    console.log(
      "Docked isolated pack navigation preview: http://127.0.0.1:4187/pack?cinema=v3",
    ),
  );
}
void main();
