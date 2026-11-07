import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { bundleCommunityFixture } from "./bundle-community";
import { packFixture, packMember, packNow } from "./pack-economy";
import { memberTestView } from "../../src/core/member-test-wallet";
import { paidPackCatalogueUpgrade } from "../../src/core/card-economy";

export async function startFoilStore(port = 0) {
  const layout = await readFile("src/app/layout.tsx", "utf8");
  const styles = [...layout.matchAll(/import "\.\/([^"\n]+)\.css";/g)].map(
    (match) => match[1],
  );
  styles.splice(styles.indexOf("pack-opening"), 0, "test-wallet");
  const artwork = resolve("src/components/pack-artwork.tsx");
  const original = await readFile(artwork, "utf8");
  // Normal acceptance bundles the actual production renderer unchanged.
  // The optional before-comparison disables only the exact-variant branch.
  const classic = original.replace(
    "if (finishedFoilPack(props)) return <FoilPackArtwork {...props} />;",
    "",
  );
  const [script, classicScript, css, reviewCss] = await Promise.all([
    bundleCommunityFixture("tests/fixtures/foil-store.tsx"),
    bundleCommunityFixture("tests/fixtures/foil-store.tsx", {
      [artwork]: classic,
    }),
    Promise.all(styles.map((s) => readFile(`src/app/${s}.css`, "utf8"))),
    readFile("src/app/foil-pack-review.css", "utf8"),
  ]);
  const stateFor = (sport: string) => {
    const visibleSport = sport === "afl" || sport === "nrl" ? sport : "nfl";
    const state = packFixture(visibleSport);
    if (visibleSport === "nfl")
      paidPackCatalogueUpgrade(state.economy!, packNow);
    return memberTestView(state, packMember.id, [], false, packNow);
  };
  const states = {
    nfl: stateFor("nfl"),
    afl: stateFor("afl"),
    nrl: stateFor("nrl"),
  };
  const publicRoot = resolve("public");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "GET") {
        res.writeHead(405);
        return res.end("Read-only design preview");
      }
      if (url.pathname === "/" || url.pathname === "/fantasy/cards") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const classic = url.searchParams.get("classic") === "1";
        return res.end(
          `<!doctype html><html lang="en"><head><title>Docked · Finished foil packs review</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css${classic ? "?classic=1" : ""}"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js${classic ? "?classic=1" : ""}"></script></body></html>`,
        );
      }
      if (url.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        return res.end(
          url.searchParams.get("classic") === "1" ? classicScript : script,
        );
      }
      if (url.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(
          css.join("\n") +
            (url.searchParams.get("classic") === "1" ? "" : reviewCss),
        );
      }
      if (url.pathname === "/api/sports-beta") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ allowed: ["afl", "nrl"] }));
      }
      if (
        url.pathname === "/api/review-store" ||
        url.pathname === "/api/test-wallet"
      ) {
        const sport = url.searchParams.get("sport");
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            state: states[sport === "afl" || sport === "nrl" ? sport : "nfl"],
          }),
        );
      }
      if (url.pathname === "/api/weekly-core") {
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            state: {
              enabled: false,
              serverTime: packNow,
              packs: [],
              sport: url.searchParams.get("sport"),
            },
          }),
        );
      }
      if (url.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            allowed: false,
            claimable: false,
            history: [],
            status: "disabled",
            message: "Isolated design preview",
          }),
        );
      }
      if (url.pathname.startsWith("/brand/")) {
        const file = resolve(
          publicRoot,
          "." + decodeURIComponent(url.pathname),
        );
        if (!file.startsWith(publicRoot + sep)) {
          res.writeHead(403);
          return res.end();
        }
        res.setHeader(
          "Content-Type",
          (
            {
              ".webp": "image/webp",
              ".png": "image/png",
              ".svg": "image/svg+xml",
              ".jpg": "image/jpeg",
            } as Record<string, string>
          )[extname(file)] ?? "application/octet-stream",
        );
        return res.end(await readFile(file));
      }
      res.writeHead(404);
      res.end("Local design review route not found");
    } catch {
      res.writeHead(500);
      res.end("Local preview unavailable");
    }
  });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Preview not listening");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
