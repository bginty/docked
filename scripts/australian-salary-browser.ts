import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { sportConfigurations } from "../src/core/sport-configuration";
import { sandboxRecommendation } from "../src/core/sport-sandbox";
async function main() {
  const out = "docs/qa/australian-salary-nrl";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "tests/fixtures/australian-salary-ui.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync("src/app/" + m[1], "utf8"))
    .join("\n");
  const results = [];
  for (const sport of ["afl", "nrl"]) {
    const db = await multiSportDatabase(sportConfigurations[sport]);
    await db.q(
      "insert into beta_private.roles(user_id,role)values($1,'owner')",
      [db.user],
    );
    await db.q("select sports_feed.adopt_australian_salary($1,$2)", [
      db.rounds.SALARY_CAP2,
      "Isolated browser salary verification",
    ]);
    const cards = db.inventories[db.user];
    cards.forEach((c, i) => {
      c.tier = i < (sport === "afl" ? 16 : 9) ? "RARE" : "ULTRA_RARE";
      c.team =
        sport === "nrl"
          ? [
              "BRI",
              "CAN",
              "CBY",
              "CRO",
              "DOL",
              "MAN",
              "MEL",
              "NEW",
              "NQL",
              "PAR",
              "PEN",
              "SOU",
              "SGI",
            ][i % 13]
          : "ADE";
    });
    await db.q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
      [JSON.stringify(cards), db.user, sport],
    );
    async function state() {
      const s = await db.state();
      s.team_name = "Isolated QA Team";
      s.server_time = "2099-01-15T00:00:00Z";
      s.competitions.forEach((c: any) => {
        if (c.round === 1) c.locks_at = "2099-01-14T00:00:00Z";
      });
      return s;
    }
    const server = createServer(async (req, res) => {
      try {
        const path = new URL(req.url!, "http://local").pathname;
        res.setHeader("Cache-Control", "no-store");
        if (path === "/state") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await state()));
          return;
        }
        if (path === "/api/admin/sports-sandbox") {
          let body = "";
          for await (const chunk of req) body += chunk;
          const input = body ? JSON.parse(body) : {};
          let recommendation;
          if (input.action === "auto_select")
            recommendation = sandboxRecommendation(
              await db.state(),
              input.competition_id,
            );
          else if (input.action)
            await db.command(
              input.action,
              input.competition_id,
              input.selections,
              input.revision,
              input.request_id,
            );
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ state: await state(), recommendation }));
          return;
        }
        if (path === "/fixture.js") {
          res.setHeader("Content-Type", "text/javascript");
          res.end(js);
          return;
        }
        if (path === "/fixture.css") {
          res.setHeader("Content-Type", "text/css");
          res.end(css);
          return;
        }
        if (path.startsWith("/brand/")) {
          const root = resolve("public"),
            file = resolve(root, "." + path);
          assert(file.startsWith(root + sep));
          res.setHeader(
            "Content-Type",
            file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
          );
          res.end(readFileSync(file));
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
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const browser = await chromium.launch();
    try {
      for (const width of [360, 412, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(base + "/?mode=SALARY_CAP");
        await expect(
          page.getByRole("heading", { name: "Your lineup" }),
        ).toBeVisible();
        await expect(page.getByLabel("Round", { exact: true })).toHaveValue(
          db.rounds.SALARY_CAP2,
        );
        await expect(
          page
            .getByText(
              sport === "afl" ? "$13.8m salary cap" : "$8.2m salary cap",
              { exact: false },
            )
            .first(),
        ).toBeVisible();
        await page.screenshot({
          path: `${out}/${sport}-future-${width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: new RegExp(`Select ${db.config.slots[0].id}`),
          })
          .click();
        await expect(page.getByRole("dialog")).toContainText(
          "600,000 salary dollars",
        );
        await page.screenshot({
          path: `${out}/${sport}-picker-${width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Close panel", exact: true })
          .click();
        if (width === 412) {
          await page
            .getByRole("button", { name: "Auto Select", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Apply lineup", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Save draft", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText("Draft saved");
          await page.screenshot({
            path: `${out}/${sport}-populated-${width}.png`,
            fullPage: true,
          });
          await page
            .getByRole("button", { name: "Enter Team", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText(
            "Team entry confirmed",
          );
        }
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert(geometry.scroll <= width + 1, JSON.stringify(geometry));
        assert.deepEqual(errors, []);
        results.push({ sport, width, passed: true, geometry });
        await page.close();
      }
      if (sport === "nrl")
        for (const width of [412, 1440]) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
          });
          await page.goto(base + "/?gallery=1");
          await expect(page.locator("[data-nrl-template]")).toHaveCount(17);
          await page.screenshot({
            path: `${out}/nrl-17-jerseys-${width}.png`,
            fullPage: true,
          });
          await page.close();
        }
    } finally {
      await browser.close();
      await new Promise<void>((r) => server.close(() => r()));
      await db.pg.close();
    }
  }
  writeFileSync(
    out + "/browser.json",
    JSON.stringify(
      { isolated: true, hostedAuthenticated: false, results },
      null,
      2,
    ),
  );
  console.log({ passed: true, results });
}
void main();
