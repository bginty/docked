/** Real UI; local fixture identity, transport and persistence. No hosted mutations. */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import type { FantasyState } from "../src/core/fantasy";
import { nflSeven } from "../src/core/nfl-seven";
import { recommendOwnedLineup } from "../src/core/owned-lineup-recommendation";
import { rarities, rarityRule } from "../src/core/card-rarity";
async function main() {
  const dir = "docs/qa/pack-rounds-autofill-20261115/browser";
  mkdirSync(dir, { recursive: true });
  const js = await bundleCommunityFixture("tests/fixtures/premium-ux.tsx", {
    [resolve("tests/fixtures/community-framework-shim.tsx")]: readFileSync(
      "tests/fixtures/community-framework-shim.tsx",
      "utf8",
    ).replaceAll('"popstate"', '"fixture:query-change"'),
  });
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
    for (const week of [6, 7, 10]) {
      const id = `${mode}-${week}`,
        closed = week !== 10,
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
          week === 10 && mode === "SALARY_CAP"
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
      if (closed && mode === "SALARY_CAP")
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
  data.seven!.established = { "nfl:SALARY_CAP": true };
  const rolled = {
    competition_id: "SALARY_CAP-10",
    revision: 1,
    updated_at: new Date(now).toISOString(),
    selections: cards
      .slice(0, 1)
      .map((c, i) => ({ slot: nflSeven.slots[i].id, card: c.id })),
  };
  data.seven!.drafts.push(rolled);
  data.seven!.rollovers = [
    {
      ...rolled,
      source_competition_id: "SALARY_CAP-6",
      omitted: [],
      created_at: new Date(now).toISOString(),
    },
  ];
  data.competitions.push({
    id: "practice-only",
    name: "Practice",
    season: "2026 Practice",
    round: 1,
    locks_at: new Date(now + 86400000).toISOString(),
    scored_at: null,
    rules: {
      mode: "SALARY_CAP",
      lineup_version: nflSeven.version,
      practice: true,
    },
  });
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
      if (action === "seven_enter") {
        const round = data.competitions.find(
          (c) => c.id === payload.competition_id,
        )!;
        data.seven!.entries.push({
          competition_id: round.id,
          revision: 1,
          updated_at: new Date().toISOString(),
          snapshot: payload.selections.map(
            (p: { slot: string; card: string }) => ({
              ...cards.find((c) => c.id === p.card)!,
              slot: p.slot,
              card_id: p.card,
              salary: 500000,
              kickoff: data.seven!.fixtures[round.id][0].scheduledAt,
            }),
          ),
        });
        data.seven!.established!["nfl:" + round.rules.mode] = true;
        return json({ state: data, result: { revision: 1, entered: true } });
      }
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
    if (u.pathname === "/api/fantasy/auto-select") {
      assert.equal(req.method, "POST");
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      return json({
        member,
        competition: body.competition,
        asOf: new Date(now).toISOString(),
        recommendation: recommendOwnedLineup(
          data,
          body.competition,
          {},
          now,
          body.picks,
        ),
      });
    }
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
    if (u.pathname.startsWith("/api/")) {
      res.statusCode = 503;
      return json({ error: "Isolated fixture" });
    }
    res.setHeader("Content-Type", "text/html");
    const suffix = u.searchParams.has("before") ? "?before=1" : "";
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated UX</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css${suffix}"></head><body class="fantasy-mode"><div id="fixture-root"></div><script>const push=history.pushState.bind(history);history.pushState=(...args)=>{push(...args);window.dispatchEvent(new Event("fixture:query-change"));};</script><script src="/fixture.js${suffix}"></script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: string[] = [];
  const errors: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/fantasy/play");
    const selector = page.getByLabel("NFL season week", { exact: true });
    await expect(selector).toHaveValue("10");
    await expect(selector.locator("option")).toHaveCount(18);
    assert(
      !(await selector.locator("option").allTextContents()).some((s) =>
        /Practice/.test(s),
      ),
    );
    await page
      .getByRole("button", { name: "Fill empty positions", exact: true })
      .click();
    await expect(
      page.getByText("Existing selection, unchanged", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Apply to draft", exact: true })
      .click();
    const draft = await page.evaluate(() =>
      JSON.parse(
        sessionStorage.getItem(
          "docked-seven:11111111-1111-4111-8111-111111111111",
        )!,
      ),
    );
    assert.equal(draft["SALARY_CAP-10"].picks.length, 7);
    assert.equal(
      draft["SALARY_CAP-10"].picks.find((p: any) => p.slot === "QB1").card,
      "qa-card-0",
    );
    assert.equal(
      data.seven!.entries.some((e) => e.competition_id === "SALARY_CAP-10"),
      false,
    );
    checks.push(
      "Traditional carried partial lineup fills seven positions, preserves manual QB, remains an unsaved draft",
    );
    await page.screenshot({
      path: dir + "/traditional-390.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "All-Star", exact: true }).click();
    await page
      .getByRole("button", { name: "Auto-fill lineup", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply to draft", exact: true })
      .click();
    const star = await page.evaluate(() =>
      JSON.parse(
        sessionStorage.getItem(
          "docked-seven:11111111-1111-4111-8111-111111111111",
        )!,
      ),
    );
    assert.equal(star["OPEN-10"].picks.length, 7);
    assert.equal(
      data.seven!.entries.some((e) => e.competition_id === "OPEN-10"),
      false,
    );
    checks.push(
      "All-Star empty lineup fills seven owned positions without entering",
    );
    await selector.selectOption("18");
    await expect(
      page.getByText("Entries and scoring are unavailable", { exact: false }),
    ).toBeVisible();
    await page
      .getByText("Fixtures and byes · Week 18", { exact: true })
      .click();
    await expect(
      page.getByText("Date/time TBD", { exact: false }).first(),
    ).toBeVisible();
    await page.screenshot({ path: dir + "/season-390.png", fullPage: true });
    checks.push(
      "All 18 weeks selectable with unavailable entries and explicit TBD fixtures; no synthetic Practice in season selector",
    );
    await page
      .getByRole("button", { name: "Traditional", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Practice archive", exact: true })
      .click();
    await expect(page.getByLabel("Round", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "2026 season", exact: true })
      .click();
    await expect(selector).toHaveValue("18");
    checks.push(
      "Practice records retained in separate archive; returning restores selected season week",
    );
    assert.deepEqual(errors, []);
    await context.close();
    writeFileSync(
      dir + "/acceptance.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          environment:
            "Loopback real components, synthetic transport and member only",
          checks,
          productionWrites: 0,
          physicalAndroidTest: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
