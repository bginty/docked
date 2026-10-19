/** Real UI; local fixture identity, transport and persistence. No hosted mutations. */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import type { FantasyState } from "../src/core/fantasy";
import { nflSeven } from "../src/core/nfl-seven";
import { recommendOwnedLineup } from "../src/core/owned-lineup-recommendation";
import { rarities, rarityRule } from "../src/core/card-rarity";
async function main() {
  const dir = `docs/qa/premium-ux/browser-${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  const js = await bundleCommunityFixture("tests/fixtures/premium-ux.tsx");
  const beforeJs = await bundleCommunityFixture(
    "tests/fixtures/premium-ux.tsx",
    Object.fromEntries(
      ["src/components/content-loading.tsx"].map((f) => [
        resolve(f),
        execFileSync("git", ["show", `HEAD:${f}`], {
          encoding: "utf8",
          windowsHide: true,
        }),
      ]),
    ),
  );
  const cssNames = [
    "brand-theme",
    "globals",
    "sports-visuals",
    "sports-experience",
    "community-app",
    "native",
    "mobile-app",
    "app-auth",
    "beta-experience",
    "fantasy",
    "fantasy-play",
    "pack-opening",
    "scoring",
    "test-wallet",
    "marketplace",
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "standings",
    "pack-shop",
    "card-viewer",
    "startup-loading",
    "premium-ux",
  ];
  const css = cssNames
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const beforeCss = cssNames
    .map((n) =>
      n === "mobile-cleanup"
        ? execFileSync("git", ["show", `HEAD:src/app/${n}.css`], {
            encoding: "utf8",
            windowsHide: true,
          })
        : readFileSync(`src/app/${n}.css`, "utf8"),
    )
    .join("\n");
  const now = Date.now(),
    member = "11111111-1111-4111-8111-111111111111";
  const cards = Array.from({ length: 21 }, (_, i) => ({
    id: `qa-card-${i}`,
    edition_id: `edition-${i}`,
    player_id: `player-${i}`,
    owner_id: member,
    name: `Local Player ${i}`,
    position: ["QB", "RB", "RB", "WR", "WR", "TE", "RB"][i % 7],
    sport: "nfl",
    team: "BUF",
    tier: i < 7 ? "CORE" : rarities[(i - 7) % 6],
    serial: 1,
    max_supply:
      i < 7 ? 0 : (rarityRule(rarities[(i - 7) % 6]).lifetimeCap ?? 0),
    season: "2026",
    kind: "regular",
    colour: "#1677ff",
    shirt: 1,
    status: "active",
    tradeable: true,
    listed: false,
    created_at: new Date(now).toISOString(),
    acquired_at: new Date(now).toISOString(),
  }));
  let data: FantasyState = {
    user_id: member,
    team_name: "Local Week Planners",
    credits: 0,
    admin: false,
    fee_bps: 500,
    catalog: null,
    cards,
    packs: [],
    shop: [],
    market: [],
    trades: [],
    competitions: [],
    entries: [],
    results: [],
    ledger: [],
    provenance: [],
    members: [],
    replacements: [],
    seven: {
      inventory: cards,
      configurations: { [nflSeven.version]: nflSeven },
      drafts: [],
      entries: [],
      locks: [],
      fixtures: {},
      server_time: new Date(now).toISOString(),
    },
  };
  for (const mode of ["SALARY_CAP", "OPEN"])
    for (const week of [1, 6, 7]) {
      const id = `${mode}-${week}`,
        closed = week !== 7,
        lock = new Date(
          now + (closed ? -86400000 : 7 * 86400000),
        ).toISOString();
      data.competitions.push({
        id,
        name: `Week ${week}`,
        season: "2026",
        round: week,
        locks_at: lock,
        scored_at: week === 1 ? lock : null,
        opens_at:
          week === 7
            ? new Date(now + 86400000).toISOString()
            : new Date(now - 7 * 86400000).toISOString(),
        sport: "nfl",
        rules: { mode, lineup_version: nflSeven.version },
      });
      data.seven!.fixtures[id] = cards.map((c, i) => ({
        fixtureId: `f-${i}`,
        playerIds: [c.player_id],
        scheduledAt: new Date(
          now +
            (week === 1 || (week === 6 && i === 0) ? -86400000 : 10 * 86400000),
        ).toISOString(),
        status: "scheduled",
      }));
      if (closed)
        data.seven!.entries.push({
          competition_id: id,
          revision: 1,
          updated_at: lock,
          snapshot: cards.slice(0, 7).map((c, i) => ({
            ...c,
            id: week === 1 ? `sold-${c.id}` : c.id,
            name: week === 1 ? `Historical Player ${i}` : c.name,
            card_id: week === 1 ? `sold-${c.id}` : c.id,
            slot: nflSeven.slots[i].id,
            kickoff: data.seven!.fixtures[id][i].scheduledAt,
            salary: 500000,
          })),
        });
    }
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://local");
    const json = (v: unknown) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(v));
    };
    if (u.pathname === "/fixture-state") return json(data);
    if (u.pathname === "/fixture-command") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { action, payload } = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(action, "seven_draft");
      const old = data.seven!.drafts.find(
        (d) => d.competition_id === payload.competition_id,
      );
      assert.equal(payload.revision, old?.revision ?? 0);
      const draft = {
        competition_id: payload.competition_id,
        selections: payload.selections,
        revision: (old?.revision ?? 0) + 1,
        updated_at: new Date().toISOString(),
      };
      data = {
        ...data,
        seven: {
          ...data.seven!,
          drafts: [
            ...data.seven!.drafts.filter(
              (d) => d.competition_id !== draft.competition_id,
            ),
            draft,
          ],
        },
      };
      return json({
        state: data,
        result: { revision: draft.revision, saved: true },
      });
    }
    if (u.pathname === "/api/fantasy/lineup-history") {
      const competition = u.searchParams.get("competition"),
        entry = data.seven!.entries.find(
          (e) => e.competition_id === competition,
        ),
        round = data.competitions.find((c) => c.id === competition);
      return json({
        competition,
        finalised: !!round?.scored_at,
        entry: entry
          ? {
              key: "local",
              name: "Local Week Planners",
              isMe: true,
              rank: round?.scored_at ? 2 : null,
              centipoints: round?.scored_at ? 8820 : null,
              status: round?.scored_at ? "final" : "pending-data",
              lineup: entry.snapshot.map((c) => ({
                ...c,
                centipoints: round?.scored_at ? 1260 : null,
                baseCentipoints: round?.scored_at ? 1260 : null,
                locked: !!round?.scored_at,
                parts: [],
              })),
            }
          : null,
      });
    }
    if (u.pathname === "/api/fantasy/auto-select")
      return json({
        member,
        competition: u.searchParams.get("competition"),
        asOf: new Date(now).toISOString(),
        recommendation: recommendOwnedLineup(
          data,
          u.searchParams.get("competition")!,
          Object.fromEntries(
            cards.map((c, i) => [
              c.player_id,
              { average: 1000 + i * 100, appearances: 3, throughWeek: 5 },
            ]),
          ),
          now,
        ),
      });
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(u.searchParams.has("before") ? beforeJs : js);
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(u.searchParams.has("before") ? beforeCss : css);
    }
    if (u.pathname.startsWith("/brand/") || u.pathname.startsWith("/images/")) {
      const path = resolve("public", "." + u.pathname);
      assert.ok(path.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith(".svg")
            ? "image/svg+xml"
            : path.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(path));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (u.pathname.startsWith("/api/"))
      return json({ error: "Isolated fixture" });
    res.setHeader("Content-Type", "text/html");
    const suffix = u.searchParams.has("before") ? "?before=1" : "";
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated UX</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css${suffix}"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js${suffix}"></script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const evidence: unknown[] = [];
  try {
    const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        reducedMotion: "reduce",
        recordVideo: { dir },
      }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [1536, 1440, 1024, 412, 360]) {
      await page.setViewportSize({ width, height: width > 600 ? 1024 : 915 });
      for (const before of [true, false]) {
        const start = performance.now();
        await page.goto(
          `${origin}/fantasy/play?view=loader${before ? "&before=1" : ""}`,
        );
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: before ? "Loading Docked" : "Getting Docked" })
            .first(),
        ).toBeVisible();
        evidence.push({
          width,
          before,
          localFixtureLoadMs: Math.round(performance.now() - start),
        });
        await page.screenshot({
          path: `${dir}/loading-${before ? "before" : "after"}-${width}.png`,
          fullPage: true,
        });
        await page.goto(
          `${origin}/fantasy/play?view=reveal&tier=CORE${before ? "&before=1" : ""}`,
        );
        await page
          .getByRole("button", { name: "Open isolated reveal" })
          .click();
        await expect(page.locator(".pack-case")).toBeVisible();
        const box = await page.locator(".pack-case").boundingBox();
        assert.ok(box);
        const offset = box.x + box.width / 2 - width / 2;
        evidence.push({ width, before, cardCenterOffsetPx: offset });
        if (!before)
          assert.ok(Math.abs(offset) < 3, `card center ${width}: ${offset}`);
        await page.screenshot({
          path: `${dir}/reveal-${before ? "before" : "after"}-${width}.png`,
          fullPage: true,
        });
      }
      await page.goto(`${origin}/fantasy/play?view=celebration&tier=ICON`);
      await page
        .getByRole("button", { name: "Show isolated celebration" })
        .click();
      await expect(page.locator(".purchase-card")).toBeVisible();
      await page.screenshot({
        path: `${dir}/celebration-${width}.png`,
        fullPage: true,
      });
      const box = await page.locator(".purchase-card").boundingBox();
      assert.ok(box && Math.abs(box.x + box.width / 2 - width / 2) < 3);
      await page.getByRole("button", { name: "Continue Browsing" }).click();
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    }
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`${origin}/fantasy/play?competition=SALARY_CAP-6`);
    await expect(page.locator(".competition-weeks")).toContainText("Week 6");
    const current = JSON.stringify(
      data.seven!.entries.find((e) => e.competition_id === "SALARY_CAP-6"),
    );
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(page.locator(".competition-weeks")).toContainText("Week 7");
    await expect(
      page.getByRole("button", { name: "Enter Competition", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Auto Select", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Review Auto Select" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Apply lineup" }).click();
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(
      page.getByText("Draft saved. Your competition entry has not changed."),
    ).toBeVisible();
    assert.equal(
      data.seven!.drafts.find((d) => d.competition_id === "SALARY_CAP-7")!
        .selections.length,
      7,
    );
    assert.equal(
      JSON.stringify(
        data.seven!.entries.find((e) => e.competition_id === "SALARY_CAP-6"),
      ),
      current,
    );
    await page.screenshot({
      path: `${dir}/future-draft-412.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    await expect(page.locator(".competition-weeks")).toContainText("Week 6");
    await page
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    await expect(page.locator(".seven-field")).toContainText(
      "Historical Player",
    );
    await expect(page.locator(".weekly-lineup-result")).toContainText("88.20");
    await expect(
      page.getByRole("button", { name: "Auto Select", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: `${dir}/historical-412.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /2026 · Week 1/ }).click();
    await page
      .getByRole("dialog", { name: "Choose competition week" })
      .getByRole("button", { name: /2026 · Week 7/ })
      .click();
    await expect(page.locator(".competition-weeks")).toContainText("Week 7");
    await page.reload();
    await expect(page.locator(".selection-count")).toContainText("7/7");
    await page.getByRole("button", { name: "All-Star", exact: true }).click();
    await page
      .getByRole("button", { name: "Auto Select", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const violations = (
      await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze()
    ).violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );
    assert.deepEqual(violations, []);
    assert.deepEqual(errors, []);
    // Every canonical rarity under reduced motion.
    for (const tier of rarities) {
      await page.goto(`${origin}/fantasy/play?view=reveal&tier=${tier}`);
      await page.getByRole("button", { name: "Open isolated reveal" }).click();
      await expect(page.locator(".pack-case")).toBeVisible();
      const box = await page.locator(".pack-case").boundingBox();
      assert.ok(box && Math.abs(box.x + box.width / 2 - 206) < 3);
      await page.screenshot({
        path: `${dir}/reveal-${tier}-412.png`,
        fullPage: true,
      });
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${origin}/fantasy/play?view=reveal&tier=ICON`);
    await page.getByRole("button", { name: "Open isolated reveal" }).click();
    await expect(
      page.getByRole("button", { name: "Reveal next card" }),
    ).toBeEnabled({ timeout: 10000 });
    await page.getByRole("button", { name: "Reveal next card" }).click();
    await expect(page.locator(".pack-count")).toContainText("2 of 4");
    await expect(
      page.getByRole("button", { name: "Reveal next card" }),
    ).toBeEnabled({ timeout: 10000 });
    const nextCenter = await page.locator(".pack-case").boundingBox();
    assert.ok(
      nextCenter && Math.abs(nextCenter.x + nextCenter.width / 2 - 206) < 3,
    );
    await page.getByRole("button", { name: "Skip remaining reveals" }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(4);
    await page.getByRole("button", { name: "Close panel" }).click();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    await page.goto(`${origin}/fantasy/play?view=celebration&tier=ICON`);
    await page
      .getByRole("button", { name: "Show isolated celebration" })
      .click();
    await page.screenshot({ path: `${dir}/celebration-motion-412.png` });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 600 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/fantasy/play?view=reveal&tier=RARE`);
    await page.getByRole("button", { name: "Open isolated reveal" }).click();
    await page.getByRole("button", { name: "Reveal next card" }).click();
    await expect(page.locator(".pack-count")).toContainText("2 of 4");
    await page.screenshot({ path: `${dir}/reveal-short-360.png` });
    await context.close();
    writeFileSync(
      `${dir}/results.json`,
      JSON.stringify(
        {
          scope:
            "Real components with local simulated identity/persistence; timings are fixture render loads, not authenticated hosted navigation",
          evidence,
          checks: [
            "Week 7 draft independent of Week 6",
            "historical sold cards restored from entry snapshot",
            "cap-aware Auto Select preview/apply/cancel",
            "all rarity reveal centering",
            "five viewports",
            "Back-safe sheets",
            "reload saved draft",
            "serious/critical accessibility checks",
            "animated Next/Skip and immediate Escape dismissal; short-screen controls reachable",
          ],
          errors,
        },
        null,
        2,
      ),
    );
    console.log(dir);
  } finally {
    await browser.close();
    server.close();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
