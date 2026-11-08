import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import {
  sportReferenceRules,
  type SportScoringHistory,
} from "../../src/core/sport-scoring-history";
import type { CustomerSport } from "../../src/core/customer-sports";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture(
    "tests/fixtures/sport-scoring-reference.tsx",
  );
});
const output = "docs/qa/scoring-pack-refinement-20261108/scoring";
function response(url: URL): SportScoringHistory {
  const sport = url.searchParams.get("sport") as CustomerSport;
  const round = Number(url.searchParams.get("round") || 9);
  const base: SportScoringHistory = {
    sport,
    rules: sportReferenceRules(sport),
    rounds: [],
    season: null,
    round: null,
    lastSuccess: null,
    rows: [],
    page: 0,
    total: 0,
    hasMore: false,
  };
  if (sport !== "nfl")
    return {
      ...base,
      unavailable:
        "Verified player statistics are not available yet. Match results are available separately; they are not player fantasy scores.",
    };
  return {
    ...base,
    season: "2026",
    round,
    lastSuccess: "2026-11-08T00:00:00Z",
    rounds: [9, 8, 7, 6, 5, 4, 3, 2, 1].map((round) => ({
      season: "2026",
      round,
      games: 1,
      records: 3,
      mappedRecords: 3,
    })),
    total: 3,
    rows: [
      "QA Long Player Name With Several Names",
      "QA Zero Points",
      "QA Missing Statistics",
    ].map((name, i) => ({
      player: `qa:${i}`,
      name,
      position: "WR",
      scoringVersion: sportReferenceRules("nfl").version,
      game: {
        id: `qa:game:${round}`,
        week: round,
        kickoff: "2026-11-06T00:00:00Z",
        opponent: "QA Opponent",
        venue: "away",
        gameStatus: "final",
        scoringStatus:
          i === 2 ? "Scoring unavailable" : "Calculated · corrections possible",
        base: i === 2 ? null : i === 1 ? 0 : 2090,
        played: i !== 2,
        revision: 2,
        updatedAt: "2026-11-08T00:00:00Z",
        incomplete: i === 2,
        missing: i === 2 ? ["receptions"] : [],
        values: {},
        parts:
          i === 2
            ? []
            : [
                {
                  statistic: "receiving_yards",
                  quantity: 79,
                  centipoints: 790,
                },
                { statistic: "receptions", quantity: 13, centipoints: 1300 },
              ],
      },
    })),
  };
}
for (const width of [320, 412, 1366])
  test(`sport-based rules and all source rounds at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/fantasy/scoring-history")
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(response(url)),
        });
      if (url.pathname === "/scoring-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Docked scoring review</title></head><body><div id="fixture-root"></div></body></html>',
        });
      return route.abort();
    });
    async function render(query = "") {
      await page.goto(`/scoring-fixture${query}`);
      await page.addStyleTag({
        content: [
          ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
            /import "\.\/([^\"]+\.css)"/g,
          ),
        ]
          .map((match) => match[1])
          .map((file) => readFileSync(`src/app/${file}`, "utf8"))
          .join("\n"),
      });
      await page.addScriptTag({ content: bundle });
    }
    mkdirSync(output, { recursive: true });
    await render("?before=1");
    await expect(
      page.getByRole("combobox", { name: "Competition" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${output}/before-${width}.png`,
      fullPage: true,
    });
    await render();
    await expect(
      page.getByRole("heading", { name: "NFL Scoring", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Competition" }),
    ).toHaveCount(0);
    const rounds = page.getByRole("combobox", { name: "Round", exact: true });
    await expect(rounds.locator("option")).toHaveCount(9);
    await expect(rounds).toHaveValue("9");
    await rounds.selectOption("8");
    await expect(
      page.getByText("Round 8 · 3 player results", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".sport-scoring-player")).toHaveCount(3);
    await page.getByText("Scoring details", { exact: true }).first().click();
    await expect(page.locator(".sport-scoring-player").first()).toContainText(
      "Revision 2",
    );
    await expect(
      page.locator(".sport-scoring-player").nth(1).locator("strong"),
    ).toContainText("0.00");
    await expect(
      page.locator(".sport-scoring-player").nth(2).locator("strong"),
    ).toContainText("—");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${output}/nfl-after-${width}.png`,
      fullPage: true,
    });
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    for (const sport of ["AFL", "NRL"]) {
      await page.getByRole("button", { name: sport, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: `${sport} Scoring`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Verified player statistics are not available yet.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(rounds).toHaveCount(0);
      await expect(page.locator(".sport-scoring-player")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${output}/${sport.toLowerCase()}-after-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "NFL", exact: true }).click();
    await expect(rounds).toHaveValue("9");
    await expect(
      page.getByRole("button", { name: "NBA", exact: true }),
    ).toHaveCount(0);
  });
