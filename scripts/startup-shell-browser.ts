import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixture,
  packMember,
  packNow,
} from "../tests/fixtures/pack-economy";
import {
  memberTestView,
  memberTestSummary,
} from "../src/core/member-test-wallet";
import { isBetaSport } from "../src/core/sports-private-beta";
async function main() {
  const before = process.argv.includes("--before");
  const out = "docs/qa/startup-shell";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture("tests/fixtures/startup-shell.tsx");
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  let requests: string[] = [];
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://localhost");
    const ref = new URL(req.headers.referer ?? "http://localhost");
    const sport = ref.searchParams.get("sport") ?? "nfl";
    res.setHeader("Cache-Control", "no-store");
    if (u.pathname.startsWith("/api/")) {
      requests.push(u.pathname + u.search);
      res.setHeader("Content-Type", "application/json");
      if (u.pathname === "/api/nba-beta" || u.pathname === "/api/sports-beta") {
        if (u.searchParams.get("view") !== "state") {
          await new Promise((r) => setTimeout(r, 250));
          return res.end(
            JSON.stringify({
              allowed: ref.searchParams.has("denied")
                ? u.pathname === "/api/nba-beta"
                  ? false
                  : []
                : u.pathname === "/api/nba-beta"
                  ? true
                  : ["basketball", "afl", "nrl"],
            }),
          );
        }
        await new Promise((r) => setTimeout(r, 1000));
        if (ref.searchParams.has("fail")) {
          res.statusCode = 503;
          return res.end('{"error":"Isolated service failure"}');
        }
        return res.end(
          JSON.stringify({
            state: {
              sport,
              user_id: "isolated",
              server_time: new Date().toISOString(),
              cards: [],
              competitions: [],
              entries: [],
              drafts: [],
              configurations: {},
              continuity: { established: {} },
            },
          }),
        );
      }
      if (u.pathname === "/api/test-wallet") {
        const state = packFixture(isBetaSport(sport) ? sport : "nfl"),
          summary = u.searchParams.get("view") === "summary";
        if (!summary) {
          await new Promise((r) => setTimeout(r, 1000));
          if (ref.searchParams.has("fail")) {
            res.statusCode = 503;
            return res.end('{"error":"Isolated service failure"}');
          }
        }
        return res.end(
          JSON.stringify({
            state: summary
              ? memberTestSummary(state, packMember.id, packNow)
              : memberTestView(state, packMember.id, [], false, packNow, [], {
                  catalogue: false,
                }),
          }),
        );
      }
      res.statusCode = 403;
      return res.end("{}");
    }
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (u.pathname.startsWith("/brand/") || u.pathname.startsWith("/images/")) {
      const file = resolve("public", "." + u.pathname);
      assert(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith("svg")
            ? "image/svg+xml"
            : file.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of before ? [412] : [412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const sport of before
        ? ["basketball"]
        : ["nfl", "basketball", "afl", "nrl"]) {
        for (const surface of before ? ["cards"] : ["cards", "play", "packs"]) {
          if (sport === "nfl" && surface === "packs") continue;
          requests = [];
          const at = Date.now();
          const path =
            surface === "packs"
              ? "test-wallet?view=packs&"
              : "" + surface + "?";
          await page.goto(`${base}/fantasy/${path}sport=${sport}`);
          if (before) {
            await expect(
              page.getByText("NBA cards", { exact: true }),
            ).toHaveCount(1);
            await expect(
              page.getByRole("region", { name: "Loading Docked", exact: true }),
            ).toBeVisible();
            assert.equal(
              await page
                .getByRole("navigation", { name: "Mobile app navigation" })
                .count(),
              0,
            );
            await page.screenshot({ path: `${out}/before-mobile.png` });
            checks.push({
              sport,
              surface,
              reproduced:
                "Private cards loaded but startup overlay still blocks navigation",
            });
          } else {
            await expect(
              page.getByRole("region", { name: "Loading Docked", exact: true }),
            ).toHaveCount(0, { timeout: 3000 });
            await expect(
              page.getByRole("navigation", {
                name: width < 800 ? "Mobile app navigation" : "App navigation",
              }),
            ).toBeVisible();
            const shellReadyMs = Date.now() - at;
            if (sport !== "nfl") {
              await expect(page.locator(".app-content")).not.toContainText(
                "Coming soon",
              );
              await expect
                .poll(
                  () => requests.filter((p) => p === "/api/sports-beta").length,
                )
                .toBe(1);
              assert.equal(
                requests.filter((p) => p === "/api/nba-beta").length,
                0,
              );
              const nav = page.getByRole("navigation", {
                name: width < 800 ? "Mobile app navigation" : "App navigation",
              });
              await expect(
                nav.getByRole("link", { name: "Cards", exact: true }),
              ).toHaveAttribute("href", `/fantasy/cards?sport=${sport}`);
            }
            await expect(
              page.getByText(/Loading (NBA|AFL|NRL) (testing|test packs)/),
            ).toHaveCount(0, { timeout: 6000 });
            if (surface === "cards" && sport !== "nfl")
              await expect(
                page.getByRole("heading", {
                  name: `${sport === "basketball" ? "NBA" : sport.toUpperCase()} cards`,
                  exact: true,
                }),
              ).toBeVisible();
            if (sport === "basketball" && surface === "cards")
              await page.screenshot({ path: `${out}/after-${width}.png` });
            checks.push({
              width,
              sport,
              surface,
              shellReadyMs,
              requests: [...requests],
              passed: true,
            });
          }
        }
      }
      if (!before) {
        await page.goto(`${base}/fantasy/cards?sport=basketball`);
        await expect(
          page.getByRole("heading", { name: "NBA cards", exact: true }),
        ).toBeVisible();
        await page.evaluate(() => {
          window.addEventListener("fixture:router-refresh", () => {
            document.documentElement.dataset.refreshed = "true";
          });
        });
        await page
          .getByLabel(width < 800 ? "Active sport" : "Active sport desktop", {
            exact: true,
          })
          .selectOption("nfl");
        await expect(page.locator("html")).toHaveAttribute(
          "data-refreshed",
          "true",
        );
        assert(new URL(page.url()).searchParams.get("sport") === "nfl");
        checks.push({
          width,
          scenario: "Return to NFL refreshes its server page",
          passed: true,
        });
        for (const suffix of ["fail=true", "denied=true"]) {
          await page.goto(`${base}/fantasy/cards?sport=basketball&${suffix}`);
          await expect(
            page.getByRole("region", { name: "Loading Docked", exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("navigation", {
              name: width < 800 ? "Mobile app navigation" : "App navigation",
            }),
          ).toBeVisible();
          if (suffix.startsWith("fail"))
            await expect(
              page.getByRole("button", { name: "Retry", exact: true }),
            ).toBeVisible({ timeout: 6000 });
          else
            await expect(
              page.getByRole("heading", { name: "NBA · Coming soon" }),
            ).toBeVisible();
          checks.push({ width, scenario: suffix, passed: true });
        }
        assert.deepEqual(errors, []);
      }
      await page.close();
    }
    writeFileSync(
      `${out}/${before ? "before" : "after"}-browser.json`,
      JSON.stringify(
        { isolated: true, authenticatedHostedTesting: false, checks },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ before, checks: checks.length, passed: true }),
    );
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
