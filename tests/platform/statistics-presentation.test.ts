import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerStatistics } from "../../src/components/player-statistics";
import type { PlayerHistory } from "../../src/core/player-card-history";
import examples from "../../config/card-statistics-preview.json";

test("member statistics omit internal metadata while keeping closed rules and attribution accessible", () => {
  const example = examples.examples[0];
  const history = structuredClone(example.history) as PlayerHistory;
  history.scoringVersion = "PRIVATE_RULE_ID";
  if (history.feed) history.feed.lastSuccess = "2099-01-01T00:00:00Z";
  const original = JSON.stringify(history);
  const html = renderToStaticMarkup(createElement(PlayerStatistics, {
    history, name: example.name, sport: example.sport, position: example.position,
    category: "passing", categoryChange: () => {}, seasonChange: () => {},
  }));
  assert.ok(!html.includes("PRIVATE_RULE_ID"));
  assert.ok(!html.includes("2099-01-01"));
  assert.ok(!html.includes("docked-nfl-postgame-full-ppr-test-v1"));
  assert.match(html, /<details class="statistics-info"><summary>Rules/);
  assert.match(html, /<details class="statistics-info"><summary>About Statistics/);
  assert.ok(!html.includes("<details open"));
  assert.match(html, /https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
  assert.match(html, /https:\/\/github.com\/nflverse\/nflverse-data/);
  assert.equal(JSON.stringify(history), original);
});

test("compact presentation keeps missing scores distinct from verified zero without audit paragraphs", () => {
  const example = examples.examples[0];
  const history = structuredClone(example.history) as PlayerHistory;
  const game = history.games![0];
  game.base = null;
  game.scoringStatus = "Missing data";
  game.values.passing_yards = 0;
  delete game.values.passing_touchdowns;
  const html = renderToStaticMarkup(createElement(PlayerStatistics, {
    history, name: example.name, sport: example.sport, position: "QB", compact: true,
    category: "passing", categoryChange: () => {}, seasonChange: () => {},
  }));
  assert.match(html, /<strong>—<\/strong>/);
  assert.match(html, /<td>0<\/td><td>—<\/td>/);
  assert.match(html, /Unavailable/);
  assert.match(html, /View Full Game Log/);
  assert.ok(!html.includes("Full-PPR"));
  assert.ok(!html.includes("statistics-disclosure"));
});
