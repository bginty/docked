/** Serve-only isolated fixture. Browser interactions use the authorised CUA tool. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  storePackFixture,
  storePackReceipt,
  packMember,
} from "../tests/fixtures/store-pack-lifecycle";
import { memberTestView } from "../src/core/member-test-wallet";
import { MemberStoreTestPurchases } from "../src/server/member-store-purchases";
import { settleStoreTestReceipt } from "../src/server/store-test-settlement";
import { layoutCss } from "../tests/fixtures/layout-css";
async function main() {
  let state = storePackFixture();
  const receipt = storePackReceipt();
  const service = new MemberStoreTestPurchases({
    authenticate: async () => ({
      member: packMember.id,
      session: "synthetic-session",
    }),
    admission: async () => ({
      version: "fixture",
      expiresAt: Date.now() + 60000,
      products: [receipt.product],
    }),
    rateLimit: async () => true,
    bindingSecret: "synthetic-binding-not-a-live-credential",
    verify: async (_token, account) => ({ ...receipt, account }),
    accept: async (r, member, account) => {
      state = settleStoreTestReceipt(
        state,
        r,
        member,
        account,
        Date.now(),
      ).state;
    },
  });
  const mock = resolve("tests/fixtures/google-native-mock.ts");
  // Both imports share exactly one module/listener registry.
  const fixture = await bundleCommunityFixture(
    "tests/fixtures/google-test-wallet.tsx",
    {
      [createRequire(import.meta.url).resolve("@capacitor/core")]:
        `export {Capacitor,registerPlugin} from ${JSON.stringify(mock.replaceAll("\\", "/"))};`,
    },
  );
  // The real wallet route imports its own stylesheet after the root layout.
  const css = layoutCss() + "\n" + readFileSync("src/app/test-wallet.css", "utf8");
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const url = new URL(req.url!, "http://localhost");
    try {
      if (url.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(fixture);
      }
      if (url.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (url.pathname === "/api/store/google/test") {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET")
          return res.end(JSON.stringify(await service.session()));
        if (url.searchParams.get("action") === "reconcile")
          return res.end(JSON.stringify({ checked: 1, morePossible: false }));
        let body = "";
        for await (const c of req) body += c;
        if (body.length > 8192) throw Error("Too large");
        return res.end(JSON.stringify(await service.receipt(JSON.parse(body))));
      }
      if (url.pathname === "/api/test-wallet") {
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            state: memberTestView(
              state,
              packMember.id,
              [],
              false,
              Date.now(),
              [],
              { catalogue: false },
            ),
          }),
        );
      }
      if (
        url.pathname.startsWith("/brand/") ||
        url.pathname.startsWith("/images/")
      ) {
        const file = resolve("public", "." + url.pathname);
        if (!file.startsWith(resolve("public") + sep)) throw Error("Forbidden");
        res.setHeader(
          "Content-Type",
          file.endsWith("svg")
            ? "image/svg+xml"
            : file.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      }
      if (url.pathname.startsWith("/api/")) {
        res.statusCode = 403;
        return res.end("{}");
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch {
      res.statusCode = 400;
      res.end('{"error":"Isolated fixture rejected request"}');
    }
  });
  server.listen(3028, "127.0.0.1", () =>
    console.log(
      "Isolated shared wallet browser fixture: http://127.0.0.1:3028",
    ),
  );
}
void main();
