// Real SportSandbox UI with disposable migration-backed fixtures; no hosted state.
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect as baseExpect } from "@playwright/test";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { sportConfigurations } from "../src/core/sport-configuration";
import type { SandboxState } from "../src/core/sport-sandbox";

async function main() {
  const expect = baseExpect.configure({ timeout: 20000 });
  assert(
    !process.env.AUSTRALIAN_SALARY_TEST_DB,
    "Embedded disposable fixtures only",
  );
  const out = "docs/qa/ux-refinement-20261108/play";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "tests/fixtures/australian-salary-ui.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  let state: SandboxState;
  let posts = 0;
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://local").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST") {
      posts++;
      res.statusCode = 403;
      return res.end("No mutations in this fixture");
    }
    if (path === "/state" || path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(path === "/state" ? state : { state }));
    }
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      return res.end(js);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      return res.end(css);
    }
    if (path.startsWith("/brand/") || path.startsWith("/images/")) {
      const file = resolve("public", "." + path);
      assert(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const results: object[] = [];
  try {
    for (const sport of ["afl", "nrl"]) {
      const db = await multiSportDatabase(sportConfigurations[sport]);
      try {
        await db.q(
          "insert into beta_private.roles(user_id,role)values($1,'owner')",
          [db.user],
        );
        await db.q("select sports_feed.adopt_australian_salary($1,$2)", [
          db.rounds.SALARY_CAP2,
          "Isolated UX acceptance",
        ]);
        const cards = db.inventories[db.user];
        cards.forEach((c) => {
          c.tier = "RARE";
        });
        await db.q(
          "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
          [JSON.stringify(cards), db.user, sport],
        );
        state = await db.state();
        state.team_name = "Isolated UX Team";
        state.server_time = "2099-01-15T00:00:00Z";
        state.competitions.forEach((c) => {
          if (c.round === 1) c.locks_at = "2099-01-14T00:00:00Z";
          if (c.round === 3) Object.assign(c.rules, { disabled: true });
        });
        for (const width of [320, 412, 1366]) {
          const page = await browser.newPage({
            viewport: { width, height: 915 },
            reducedMotion: "reduce",
          });
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", (r) =>
            new URL(r.request().url()).origin === origin
              ? r.continue()
              : r.abort(),
          );
          for (const mode of ["SALARY_CAP", "OPEN"]) {
            const future = db.rounds[mode + "2"],
              past = db.rounds[mode + "1"];
            await page.goto(
              `${origin}/fantasy/play?sport=${sport}&mode=${mode}`,
            );
            await expect(
              page.getByRole("heading", { name: "Your lineup", exact: true }),
            ).toBeVisible();
            const selector = page.getByRole("combobox", {
              name: "Round",
              exact: true,
            });
            await expect(selector).toHaveValue(future);
            await expect(
              selector.locator(`option[value="${db.rounds[mode + "3"]}"]`),
            ).toContainText("Entries unavailable");
            const summary = page.locator(".sport-team-summary");
            await expect(summary).toContainText(
              mode === "OPEN"
                ? "No salary cap"
                : `${sport === "afl" ? "13,800,000" : "8,200,000"} fantasy salary dollars`,
            );
            await page.screenshot({
              path: `${out}/${sport}-${mode.toLowerCase()}-play-${width}.png`,
              fullPage: true,
            });
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              "Play overflow",
            );
            const slotButton = page.getByRole("button", {
              name: new RegExp(`^Select ${db.config.slots[0].id}$`),
            });
            await slotButton.click();
            const picker = page.getByRole("dialog");
            await expect(picker).toBeVisible();
            if (mode === "SALARY_CAP")
              await expect(picker).toContainText("600,000 salary dollars");
            await page.screenshot({
              path: `${out}/${sport}-${mode.toLowerCase()}-picker-${width}.png`,
              fullPage: true,
            });
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              "Picker overflow",
            );
            await picker
              .getByRole("button", { name: /^Select QA / })
              .first()
              .click();
            await expect(picker).toHaveCount(0);
            await expect(summary).toContainText(
              `1 / ${db.config.slots.length} selected`,
            );
            if (mode === "SALARY_CAP")
              await expect(summary).toContainText("$600,000 /");
            await expect(
              page.getByRole("button", { name: "Save draft", exact: true }),
            ).toBeEnabled();
            page.once("dialog", (d) => d.dismiss());
            await selector.selectOption(past);
            await expect(selector).toHaveValue(future);
            await expect(summary).toContainText(
              `1 / ${db.config.slots.length} selected`,
            );
            page.once("dialog", (d) => d.accept());
            await selector.selectOption(past);
            await expect(selector).toHaveValue(past);
            await expect(
              page.locator(".competition-round-value"),
            ).toContainText("Entries closed");
            await expect(
              page.getByRole("button", { name: "Save draft", exact: true }),
            ).toHaveCount(0);
            assert.equal(
              new URL(page.url()).searchParams.get("competition"),
              past,
            );
            await page.reload();
            await expect(selector).toHaveValue(past);
            await page.screenshot({
              path: `${out}/${sport}-${mode.toLowerCase()}-historical-${width}.png`,
              fullPage: true,
            });
            await page
              .getByRole("button", { name: "Next round", exact: true })
              .click();
            await expect(selector).toHaveValue(future);
            await slotButton.click();
            await picker
              .getByRole("button", { name: /^Select QA / })
              .first()
              .click();
            const otherMode = page.getByRole("button", {
              name: mode === "OPEN" ? /^Traditional/ : /^All-Star/,
            });
            page.once("dialog", (d) => d.dismiss());
            await otherMode.click();
            await expect(selector).toHaveValue(future);
            page.once("dialog", (d) => d.accept());
            await otherMode.click();
            await expect(otherMode).toHaveAttribute("aria-pressed", "true");
            assert.equal(
              new URL(page.url()).searchParams.get("mode"),
              mode === "OPEN" ? "SALARY_CAP" : "OPEN",
            );
            assert.deepEqual(errors, []);
            results.push({
              sport,
              width,
              mode,
              futureDefault: true,
              historicalDeepLink: true,
              picker: true,
              salarySummary: true,
              draftGuardCancelAndAccept: true,
              modeGuard: true,
              overflow: false,
            });
          }
          await page.close();
        }
      } finally {
        await db.pg.close();
      }
    }
    assert.equal(posts, 0);
    writeFileSync(
      `${out}/australian-full-play.json`,
      JSON.stringify(
        { isolated: true, customerMutations: 0, posts, results },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ passed: true, checks: results.length, posts }),
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
  }
}
void main();
