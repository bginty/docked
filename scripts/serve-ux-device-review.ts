// Loopback-only physical-device review. Read-only synthetic data; no hosted credentials.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { sportConfigurations } from "../src/core/sport-configuration";
import { profile } from "../tests/fixtures/global-sport-data";
import { previewPackReceipt } from "../src/components/pack-opening-preview";

async function main() {
  assert(!process.env.AUSTRALIAN_SALARY_TEST_DB, "Embedded fixtures only");
  const scripts = await Promise.all(
    [
      "tests/fixtures/play-standings-visual.tsx",
      "tests/fixtures/device-australian-play.tsx",
      "tests/fixtures/social-refinement.tsx",
      "tests/fixtures/pack-opening.tsx",
    ].map((entry) => bundleCommunityFixture(entry)),
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  const states = new Map<string, Promise<unknown>>();
  const ready = new Set<string>();
  async function prepare(sport: string) {
    const db = await multiSportDatabase(sportConfigurations[sport]);
    try {
      await db.q(
        "insert into beta_private.roles(user_id,role)values($1,'owner')",
        [db.user],
      );
      await db.q("select sports_feed.adopt_australian_salary($1,$2)", [
        db.rounds.SALARY_CAP2,
        "Isolated physical device UX review",
      ]);
      const cards = db.inventories[db.user];
      cards.forEach((c) => {
        c.tier = "RARE";
      });
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
        [JSON.stringify(cards), db.user, sport],
      );
      const state = await db.state();
      state.team_name = "Isolated UX Team";
      state.server_time = "2099-01-15T00:00:00Z";
      state.competitions.forEach(
        (c: { round: number; locks_at: string; rules: object }) => {
          if (c.round === 1) c.locks_at = "2099-01-14T00:00:00Z";
          if (c.round === 3) Object.assign(c.rules, { disabled: true });
        },
      );
      ready.add(sport);
      return state;
    } finally {
      await db.pg.close();
    }
  }
  const cards = Array.from({ length: 180 }, (_, i) => ({
    card: {
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      edition_id: `edition-${i}`,
      player_id: `player-${i}`,
      name: `Fixture Player ${String(i).padStart(3, "0")}`,
      tier: "RARE",
      serial: i + 1,
      max_supply: 2000,
      sport: ["nfl", "afl", "nrl"][i % 3],
      position: "MID",
      team: "Docked",
      colour: "#123456",
      shirt: "solid",
      season: 2026,
      kind: "PLAYER",
      status: "owned",
      tradeable: false,
    },
    offers: false,
    asking: null,
  }));
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, "http://127.0.0.1:4191");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; form-action 'none'",
      );
      const json = (value: unknown) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(value));
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 403;
        return json({
          error:
            "LOCAL DESIGN REVIEW · All server mutations disabled. Draft retained.",
        });
      }
      if (u.pathname === "/health")
        return json({
          local: true,
          readOnly: true,
          nba: false,
          ready: [...ready],
        });
      if (u.pathname === "/local-identity")
        return json({ member: "visual-member" });
      if (u.pathname === "/receipt") {
        const count =
          new URL(req.headers.referer ?? "http://local").searchParams.get(
            "count",
          ) === "3"
            ? 3
            : 9;
        const receipt = previewPackReceipt("afl");
        receipt.id = `isolated-device-issued-${count}`;
        receipt.cards = receipt.cards.slice(0, count);
        return json(receipt);
      }
      if (
        u.pathname === "/state" ||
        u.pathname === "/api/admin/sports-sandbox"
      ) {
        const requested =
          u.searchParams.get("sport") ??
          new URL(req.headers.referer ?? "http://local").searchParams.get(
            "sport",
          );
        const sport = requested === "nrl" ? "nrl" : "afl";
        if (!states.has(sport)) states.set(sport, prepare(sport));
        const state = await states.get(sport);
        return json(u.pathname === "/state" ? state : { state });
      }
      if (u.pathname === "/api/community")
        return json(
          u.searchParams.get("view") === "hub"
            ? {
                own: true,
                viewer: profile.id,
                handle: profile.handle,
                visibility: "private",
                visible: true,
                cards,
                settings: null,
                communities: [],
                canManage: false,
                teams: [],
              }
            : {
                status: "ready",
                viewer: profile,
                profiles: [],
                posts: [],
                nextCursor: null,
              },
        );
      if (u.pathname === "/api/sports-beta") {
        const sport = u.searchParams.get("sport");
        return json(
          sport === "afl" || sport === "nrl"
            ? { state: await states.get(sport), allowed: ["afl", "nrl"] }
            : { allowed: ["afl", "nrl"] },
        );
      }
      if (u.pathname === "/api/test-wallet")
        return json({
          state: {
            member: profile.id,
            wallet: { spendable: 10000 },
            packs: [],
            swaps: [],
          },
        });
      if (u.pathname.startsWith("/api/")) return json({});
      if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        return res.end(css);
      }
      const script = ["/nfl.js", "/au.js", "/social.js", "/pack.js"].indexOf(
        u.pathname,
      );
      if (script >= 0) {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        return res.end(scripts[script]);
      }
      if (
        u.pathname.startsWith("/brand/") ||
        u.pathname.startsWith("/images/")
      ) {
        const file = resolve("public", "." + u.pathname);
        assert(file.startsWith(resolve("public") + sep));
        try {
          res.setHeader(
            "Content-Type",
            file.endsWith(".svg")
              ? "image/svg+xml"
              : file.endsWith(".png")
                ? "image/png"
                : "image/webp",
          );
          return res.end(readFileSync(file));
        } catch {
          res.statusCode = 404;
          return res.end();
        }
      }
      const entry =
        u.pathname === "/pack"
          ? "/pack.js"
          : u.pathname.startsWith("/au/") ||
              (u.pathname === "/fantasy/play" &&
                ["afl", "nrl"].includes(u.searchParams.get("sport") ?? ""))
            ? "/au.js"
            : u.pathname.includes("social")
              ? "/social.js"
              : "/nfl.js";
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><title>LOCAL DESIGN REVIEW</title></head><body class="fantasy-mode"><aside style="position:relative;z-index:99999;background:#fff0a8;color:#05162a;padding:8px;font:13px system-ui"><strong>LOCAL DESIGN REVIEW · Synthetic data</strong><div>No purchases, account or server changes.</div><nav style="display:flex;flex-wrap:wrap;gap:16px;padding-top:6px"><a href="/fantasy/play?sport=nfl&scenario=entered">NFL</a><a href="/fantasy/play?sport=afl&mode=SALARY_CAP">AFL</a><a href="/fantasy/play?sport=nrl&mode=SALARY_CAP">NRL</a><a href="/fantasy/social">Social</a><a href="/pack?cinema=v3&count=3">3-card replay</a><a href="/pack?cinema=v3&count=9">9-card replay</a></nav></aside><div id="fixture-root"></div><script>if(location.pathname==="/fantasy/play"&&!new URLSearchParams(location.search).has("sport")){let sport="nfl";try{const saved=localStorage.getItem("docked:active-sport");if(["nfl","afl","nrl"].includes(saved))sport=saved;}catch{}const url=new URL(location.href);url.searchParams.set("sport",sport);location.replace(url.href);}window.fixtureNavigate=url=>location.assign(url);window.addEventListener("docked:sport-changed",()=>location.reload());</script><script src="${entry}"></script></body></html>`,
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
  });
  server.listen(4191, "127.0.0.1", () =>
    console.log(
      "LOCAL DESIGN REVIEW http://127.0.0.1:4191/fantasy/play?sport=nfl&scenario=entered",
    ),
  );
  // Warm one isolated snapshot at a time; no persistent database or external credentials.
  for (const sport of ["afl", "nrl"]) {
    const p = states.get(sport) ?? prepare(sport);
    states.set(sport, p);
    await p;
    console.log(`${sport.toUpperCase()} isolated snapshot ready`);
  }
}
void main();
