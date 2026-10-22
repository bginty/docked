import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import {
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
} from "../src/core/sport-configuration";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { sandboxRecommendation } from "../src/core/sport-sandbox";
async function main() {
  const sport = process.argv[2] ?? "basketball";
  const config =
    sport === "afl"
      ? aflConfiguration
      : sport === "nrl"
        ? nrlConfiguration
        : nbaWeeklyConfiguration;
  assert.equal(config.id, sport);
  const label = config.label;
  const db = await multiSportDatabase(config, true);
  // Existing local fixture identity transport, real NBA membership/command SQL.
  await db.pg.exec(
    `create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;`,
  );
  await db.q(
    "insert into sports_feed.nba_beta_control values(true,true,'Local UI acceptance',clock_timestamp())",
  );
  await db.q(
    "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Local UI acceptance','infinity')",
    [db.user],
  );
  await db.q("select set_config('docked.nba_private_beta','enabled',false)");
  await db.q(
    "select set_config('docked.private_beta_sport',$1,false),set_config('docked.sports_private_beta','enabled',false)",
    [sport],
  );
  if (sport !== "basketball")
    await db.q(
      "update sports_feed.private_beta_sports set enabled=true where sport=$1",
      [sport],
    );
  const js = await bundleCommunityFixture(
    "tests/fixtures/nba-private-beta-ui.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  let allowed = true;
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, "http://localhost");
      if (u.pathname === "/api/nba-beta" || u.pathname === "/api/sports-beta") {
        res.setHeader("Content-Type", "application/json");
        if (!allowed) {
          res.statusCode = 403;
          res.end(JSON.stringify({ allowed: false }));
          return;
        }
        await db.q("select sports_feed.private_beta_sport_capability()");
        if (req.method === "GET") {
          res.end(
            JSON.stringify(
              u.searchParams.get("view") === "state"
                ? { state: await db.state() }
                : {
                    allowed:
                      u.pathname === "/api/sports-beta"
                        ? [sport]
                        : sport === "basketball",
                  },
            ),
          );
          return;
        }
        let body = "";
        for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        let recommendation;
        if (input.action === "auto_select")
          recommendation = sandboxRecommendation(
            await db.state(),
            input.competition_id,
          );
        else
          await db.q("select sports_feed.sport_sandbox_command($1,$2,$3)", [
            input.action,
            JSON.stringify({
              competition_id: input.competition_id,
              revision: input.revision,
              selections: input.selections,
            }),
            input.request_id,
          ]);
        res.end(JSON.stringify({ state: await db.state(), recommendation }));
        return;
      }
      if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
        return;
      }
      if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (u.pathname.startsWith("/brand/")) {
        const root = resolve("public"),
          file = resolve(root, "." + u.pathname);
        assert(file.startsWith(root + sep));
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
        );
        res.end(readFileSync(file));
        return;
      }
      if (u.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        res.end("{}");
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      res.statusCode = 409;
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    browser = await chromium.launch();
  const out =
    process.env.NBA_ACCEPTANCE_OUT ?? `docs/qa/overnight-multisport/${sport}`;
  mkdirSync(out, { recursive: true });
  const checks = [];
  try {
    for (const width of [412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/fantasy/play");
      const selector = page.getByLabel(
        width < 900 ? "Active sport" : "Active sport desktop",
        { exact: true },
      );
      await expect(selector.locator(`option[value="${sport}"]`)).toBeEnabled();
      await selector.selectOption(sport);
      await expect(
        page.getByRole("heading", { name: `${label} · Private beta` }),
      ).toBeVisible();
      if (width === 412) {
        await page
          .getByRole("button", { name: "Auto Select", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Apply lineup", exact: true })
          .click();
        await selector.selectOption("nfl");
        await expect(selector).toHaveValue(sport);
        await expect(
          page
            .locator(".shell-sport-mobile")
            .getByText(
              "Save or discard your lineup changes before changing sport.",
            )
            .first(),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Save draft", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "Draft saved" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Confirm sandbox entry", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "entry confirmed" }),
        ).toBeVisible();
        await page
          .getByLabel("Competition", { exact: true })
          .selectOption("SALARY_CAP");
        await page
          .getByRole("button", { name: "Auto Select", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Apply lineup", exact: true })
          .click();
        if (sport === "basketball")
          await expect(
            page.getByText(/\$4,000,000 \/ \$5,200,000/),
          ).toBeVisible();
        await page
          .getByRole("button", { name: "Confirm sandbox entry", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "entry confirmed" }),
        ).toBeVisible();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/integrated-play-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("navigation", {
          name: width < 900 ? "Mobile app navigation" : "App navigation",
          exact: true,
        })
        .getByRole("link", { name: "Cards", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: `${label} test cards` }),
      ).toBeVisible();
      const collection = page.getByRole("list", {
        name: `${label} test collection`,
      });
      const total = await collection.getByRole("listitem").count();
      assert(total > 8);
      await page
        .getByLabel(`Search your ${label} cards`)
        .fill("not-a-player-xyz");
      await expect(collection.getByRole("listitem")).toHaveCount(0);
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(collection.getByRole("listitem")).toHaveCount(total);
      await page
        .getByLabel("Position", { exact: true })
        .selectOption(config.slots[0].positions[0]);
      const filtered = await collection.getByRole("listitem").count();
      assert(filtered > 0 && filtered < total);
      await page.getByLabel("Position", { exact: true }).selectOption("");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${out}/integrated-cards-${width}.png`,
        fullPage: true,
      });
      await page
        .getByLabel(width < 900 ? "Active sport" : "Active sport desktop", {
          exact: true,
        })
        .selectOption("nfl");
      await expect(
        page.getByRole("heading", { name: "NFL regression fixture" }),
      ).toBeVisible();
      assert.deepEqual(errors, []);
      checks.push({ width, switching: true, cards: true, overflow: false });
      await page.close();
    }
    allowed = false;
    const page = await browser.newPage();
    await page.goto(origin + `/fantasy/play?sport=${sport}`);
    await expect(
      page.getByRole("heading", { name: `${label} · Coming soon` }),
    ).toBeVisible();
    await expect(
      page.locator(`option[value="${sport}"]`).first(),
    ).toHaveAttribute("disabled", "");
    await page.close();
    writeFileSync(
      out + "/integrated-browser.json",
      JSON.stringify(
        {
          passed: true,
          isolatedSql: true,
          authenticatedHosted: false,
          checks,
          unauthorisedHidden: true,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(checks));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
    await db.pg.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
