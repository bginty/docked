import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { sandboxRecommendation } from "../src/core/sport-sandbox";
async function main() {
  const db = await multiSportDatabase();
  const js = await bundleCommunityFixture(
    "tests/fixtures/sport-sandbox-ui.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "fantasy",
    "fantasy-play",
    "collectible",
    "card-viewer",
    "premium-ux",
    "multi-sport",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, "http://localhost").pathname;
      if (path === "/state") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await db.state()));
        return;
      }
      if (path === "/api/admin/sports-sandbox") {
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
          await db.command(
            input.action,
            input.competition_id,
            input.selections,
            input.revision,
            input.request_id,
          );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ state: await db.state(), recommendation }));
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
        const root = resolve("public");
        const file = resolve(root, "." + path);
        assert.ok(file.startsWith(root + sep));
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
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch();
  const out = "docs/qa/multi-sport/afl";
  mkdirSync(out, { recursive: true });
  const results = [];
  try {
    for (const width of [412, 360, 1024, 1440, 1536]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(
        page.getByRole("heading", { name: "AFL · Team laboratory" }),
      ).toBeVisible();
      if (width === 412) {
        await page
          .getByRole("button", { name: "Auto Select", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Review Auto Select" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Apply lineup", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Save draft", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText("Draft saved");
        await page
          .getByRole("button", { name: "Confirm sandbox entry", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText("entry confirmed");
        await expect(
          page.getByRole("button", { name: "Auto Select", exact: true }),
        ).toHaveCount(0);
        await page
          .getByLabel("Round", { exact: true })
          .selectOption(db.rounds.OPEN2);
        await expect(
          page.getByText("22/22 selected", { exact: false }),
        ).toBeVisible();
        await page.getByRole("button", { name: /Select BACK1:/ }).click();
        await expect(
          page.getByRole("dialog", { name: "Select BACK1" }),
        ).toBeVisible();
        const entry = (await db.state()).entries.find(
          (e: any) =>
            e.competition_id === db.rounds.OPEN1 && e.user_id === db.user,
        );
        const original = entry.snapshot.find((s: any) => s.slot === "BACK1");
        const unused = db.inventories[db.user].find(
          (c) =>
            c.position === "DEF" &&
            !entry.snapshot.some((s: any) => s.card_id === c.id),
        )!;
        await page
          .getByRole("dialog")
          .getByRole("button", { name: `Select ${unused.name}`, exact: true })
          .click();
        await page
          .getByRole("button", { name: "Save draft", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText("Draft saved");
        await page
          .getByLabel("Round", { exact: true })
          .selectOption(db.rounds.OPEN1);
        await expect(
          page.getByRole("button", {
            name: `Select BACK1: ${original.name}`,
            exact: true,
          }),
        ).toBeVisible();
      }
      await page.screenshot({
        path: `${out}/field-${width}.png`,
        fullPage: true,
      });
      for (const group of ["Midfielders", "Forwards", "Rucks"]) {
        await page.getByRole("button", { name: new RegExp(group) }).click();
        await expect(page.locator(".sport-slot")).toHaveCount(
          group === "Midfielders" ? 8 : group === "Rucks" ? 2 : 6,
        );
      }
      await page
        .getByRole("button", { name: "List view", exact: true })
        .click();
      await expect(page.locator("[data-slot]")).toHaveCount(22);
      await page.screenshot({
        path: `${out}/list-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      results.push({ width, slots: 22, overflow: false, errors });
      await page.close();
    }
    await db.asUser(db.other);
    await db.command(
      "seven_enter",
      db.rounds.OPEN1,
      db.config.slots.map((s, i) => ({
        slot: s.id,
        card: db.inventories[db.other][i].id,
      })),
      0,
    );
    await db.asUser(db.user);
    await db.q("select set_config('qa.now','2099-02-01T00:00:01Z',false)");
    const page = await browser.newPage({
      viewport: { width: 412, height: 900 },
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "List view", exact: true }).click();
    await expect(page.locator("[data-slot]")).toHaveCount(22);
    const own = (await db.state()).entries.find(
      (e: any) => e.competition_id === db.rounds.OPEN1 && e.user_id === db.user,
    );
    for (const c of own.snapshot)
      await expect(
        page.locator(`[data-slot="${c.slot}"] [data-card]`),
      ).toHaveAttribute("data-card", c.card_id);
    await page.screenshot({
      path: `${out}/historical-412.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "View locked team", exact: true })
      .click();
    await expect(page.locator("[data-slot]")).toHaveCount(22);
    for (let i = 0; i < 22; i++)
      await expect(
        page.locator(`[data-slot="${db.config.slots[i].id}"] [data-card]`),
      ).toHaveAttribute("data-card", db.inventories[db.other][i].id);
    await page.screenshot({ path: `${out}/community-412.png`, fullPage: true });
    await page.close();
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          results,
          lockedAndCommunitySlots: 22,
          journey:
            "SQL-backed auto preview/apply/save/confirm/rollover/manual replacement/history",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(results));
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
