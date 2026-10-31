/** Disposable database and serve-only UI fixture; drive with authorised CUA. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../src/core/sport-configuration";
import { layoutCss } from "../tests/fixtures/layout-css";
import { sandboxRecommendation } from "../src/core/sport-sandbox";
async function main() {
  const sport = process.argv[2] === "nrl" ? nrlConfiguration : aflConfiguration;
  const d = await multiSportDatabase(sport, false, undefined, true);
  for (const c of d.inventories[d.user]) {
    await d.q(
      "insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season) values($1,$2,$3,$4,$5,'#1759a3',1,'2099')",
      [c.player_id, c.name, sport.id, c.position, c.team],
    );
    await d.q(
      "insert into sports_feed.free_core_roster values($1,$2,'2099',$3,'2099-03-01','https://example.invalid/isolated-roster',$4,true)",
      [
        c.player_id,
        sport.id,
        JSON.stringify(c.eligible_positions),
        "a".repeat(64),
      ],
    );
  }
  await d.q(
    "update sports_feed.sport_sandbox_inventory set cards='[]' where user_id=$1",
    [d.user],
  );
  await d.q(
    "update sports_feed.free_core_programmes set enabled=true where sport=$1",
    [sport.id],
  );
  const ui = resolve("tests/fixtures/sport-sandbox-ui.tsx");
  const source = readFileSync(ui, "utf8");
  if (!source.includes("<SportSandbox initial={state} />"))
    throw Error("Shared fixture entry changed");
  const js = await bundleCommunityFixture(ui, {
    [ui]: source.replace(
      "<SportSandbox initial={state} />",
      "<SportSandbox initial={state} privateBeta />",
    ),
  });
  const css = layoutCss();
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const url = new URL(req.url!, "http://localhost");
      if (url.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(js);
      }
      if (url.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (url.pathname === "/state") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(await d.state()));
      }
      if (url.pathname === "/api/admin/sports-sandbox") {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET")
          return res.end(JSON.stringify({ state: await d.state() }));
        let body = "";
        for await (const c of req) {
          body += c;
          if (body.length > 16384) throw Error("Bounded fixture body");
        }
        const v = JSON.parse(body);
        let recommendation;
        if (v.action === "auto_select")
          recommendation = sandboxRecommendation(
            await d.state(),
            v.competition_id,
          );
        else
          await d.command(
            v.action,
            v.competition_id,
            v.selections,
            v.revision,
            v.request_id,
          );
        return res.end(
          JSON.stringify({ state: await d.state(), recommendation }),
        );
      }
      if (url.pathname.startsWith("/brand/")) {
        const file = resolve("public", "." + url.pathname);
        if (!file.startsWith(resolve("public") + sep))
          throw Error("Invalid asset");
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
        );
        return res.end(readFileSync(file));
      }
      if (url.pathname.startsWith("/api/")) {
        res.statusCode = 403;
        return res.end("{}");
      }
      res.setHeader("Content-Type", "text/html");
      return res.end(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><p>ISOLATED FREE CORE FIXTURE · synthetic players and rounds · no owned cards or purchases</p><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch {
      res.statusCode = 409;
      res.end('{"error":"Fixture request rejected"}');
    }
  });
  server.listen(sport.id === "nrl" ? 3030 : 3029, "127.0.0.1", () =>
    console.log(`Isolated ${sport.id} free Core fixture ready`),
  );
}
void main();
