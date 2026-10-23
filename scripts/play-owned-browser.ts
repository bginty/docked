import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { grantOwnedPlayFixtures } from "../tests/fixtures/owned-play";
import {
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
} from "../src/core/sport-configuration";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { sandboxRecommendation } from "../src/core/sport-sandbox";

async function main() {
  const sport = process.argv[2] ?? "basketball";
  const config = [
    nbaWeeklyConfiguration,
    aflConfiguration,
    nrlConfiguration,
  ].find((c) => c.id === sport)!;
  assert(config);
  const db = await multiSportDatabase(config, true);
  const owned = db.inventories[db.user].slice(0, config.slots.length);
  const unowned = db.inventories[db.user].at(-1)!;
  await grantOwnedPlayFixtures(db, owned);
  await db.pg.exec(
    `create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`,
  );
  await db.q(
    "insert into sports_feed.nba_beta_control values(true,true,'Local browser test',clock_timestamp())",
  );
  await db.q(
    "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values($1,true,'Local browser test','infinity')",
    [db.user],
  );
  await db.q(
    "update sports_feed.private_beta_sports set enabled=true,authority='Local browser test'",
  );
  await db.q(
    "select set_config('docked.nba_private_beta','enabled',false),set_config('docked.sports_private_beta','enabled',false),set_config('docked.private_beta_sport',$1,false)",
    [sport],
  );
  const js = await bundleCommunityFixture("tests/fixtures/play-owned-ui.tsx");
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}`, "utf8"))
    .join("\n");
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, "http://localhost");
      if (u.pathname === "/api/play-owned") {
        let recommendation;
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) body += chunk;
          const input = JSON.parse(body);
          if (input.action === "auto_select")
            recommendation = sandboxRecommendation(
              await db.state(),
              input.competition_id,
            );
          else
            await db.q("select sports_feed.sport_sandbox_command($1,$2,$3)", [
              input.action,
              {
                competition_id: input.competition_id,
                revision: input.revision,
                selections: input.selections,
              },
              input.request_id,
            ]);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ state: await db.state(), recommendation }));
      } else if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
      } else if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
      } else if (u.pathname.startsWith("/brand/")) {
        const root = resolve("public"),
          file = resolve(root, "." + u.pathname);
        assert(file.startsWith(root + sep));
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
        );
        res.end(readFileSync(file));
      } else if (u.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        res.end("{}");
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
        );
      }
    } catch (e) {
      res.statusCode = 409;
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch();
  const out = `docs/qa/play-owned/${sport}`;
  mkdirSync(out, { recursive: true });
  const checks = [];
  try {
    for (const width of [412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin);
      await page
        .getByRole("button", {
          name: new RegExp(`^Select ${config.slots[0].id}(?:$|:)`),
        })
        .click();
      const picker = page.getByRole("dialog");
      await expect(picker.getByText(unowned.name, { exact: true })).toHaveCount(
        0,
      );
      const candidates = picker.getByRole("button", { name: /^Select QA / });
      assert((await candidates.count()) > 0);
      for (const candidate of await candidates.all()) {
        const label = await candidate.getAttribute("aria-label");
        assert(
          owned.some((c) => `Select ${c.name}` === label),
          "Only owned candidates are offered",
        );
      }
      await page.screenshot({
        path: `${out}/owned-picker-${width}.png`,
        fullPage: true,
      });
      await page.getByLabel("Find in My Cards").fill(unowned.name);
      await expect(
        picker.getByText(
          "No eligible owned cards match this position and search.",
        ),
      ).toBeVisible();
      await picker.getByRole("button", { name: "Close panel" }).click();
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
        await expect(
          page.getByRole("status").filter({ hasText: "Draft saved" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Confirm sandbox entry", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "entry confirmed" }),
        ).toBeVisible();
        await page.reload();
      }
      await expect(
        page.getByRole("button", {
          name: new RegExp(`^Select ${config.slots[0].id}:`),
        }),
      ).toBeVisible();
      const state = await db.state();
      const entry = state.entries.find(
        (e: any) => e.competition_id === db.rounds.OPEN1,
      );
      assert.equal(entry.snapshot.length, config.slots.length);
      assert(
        entry.snapshot.every((s: any) => owned.some((c) => c.id === s.card_id)),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${out}/owned-lineup-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      checks.push({
        width,
        ownedPickerOnly: true,
        missingSearchEmpty: true,
        savedReload: true,
        slots: config.slots.length,
        overflow: false,
      });
      await page.close();
    }
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          isolatedSql: true,
          authenticatedHosted: false,
          checks,
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
