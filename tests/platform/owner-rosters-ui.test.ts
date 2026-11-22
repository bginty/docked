import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import type {
  OwnerRosterReport,
  OwnerRosterRow,
} from "../../src/core/commercial-player-roster";

const nativeRequire = createRequire(import.meta.url);
const loaded = build({
  entryPoints: [
    "src/components/owner-rosters.tsx",
    "src/components/owner-roster-download.tsx",
  ],
  bundle: true,
  write: false,
  outdir: "/tmp/docked-roster-ssr",
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
}).then((result) => {
  const modules: Record<string, Record<string, unknown>> = {};
  for (const file of result.outputFiles.filter((item) =>
    item.path.endsWith(".js"),
  )) {
    const module = { exports: {} as Record<string, unknown> };
    vm.runInNewContext(file.text, {
      module,
      exports: module.exports,
      require: nativeRequire,
      URL,
      URLSearchParams,
      Date,
      setTimeout,
      clearTimeout,
    });
    modules[file.path.split("/").at(-1)!] = module.exports;
  }
  return {
    Component: modules["owner-rosters.js"].OwnerRosters as ComponentType<{
      report: OwnerRosterReport;
      ownerId: string;
    }>,
    exportQuery: modules["owner-roster-download.js"].rosterExportQuery as (
      query: string,
    ) => string,
  };
});

const base: OwnerRosterRow = {
  playerId: "20000000-0000-4000-8000-000000000001",
  name: "Synthetic player",
  sport: "afl",
  currentClubId: "ADE",
  currentClubName: "Adelaide",
  savedClubs: ["Former club"],
  registration: "ACTIVE",
  availability: "AVAILABLE",
  verification: "VERIFIED",
  eligibility: true,
  eligibilityReason: "Reviewed active registration and approved supply",
  observedAt: "2026-11-22T00:00:00Z",
  effectiveAt: "2026-11-22T00:00:00Z",
  reviewedAt: "2026-11-22T00:01:00Z",
  evidenceUrl: "https://fixture.invalid/official-roster",
  evidenceHash: "a".repeat(64),
  revision: "fixture-review-1",
  existingCards: 4,
  definitionCount: 5,
  approvedDefinitions: 5,
  lifetimeIssued: 7,
  aliases: [{ provider: "fixture", providerId: "synthetic-player-1" }],
  supply: [],
};
function report(rows: OwnerRosterRow[]): OwnerRosterReport {
  return {
    generatedAt: "2026-11-22T00:02:00Z",
    filters: {
      sport: "all",
      club: "",
      status: "ALL",
      issuance: "ALL",
      verification: "ALL",
      q: "",
      page: 1,
    },
    rows,
    total: rows.length,
    page: 1,
    pageSize: 100,
    hasMore: false,
    clubs: [{ sport: "afl", id: "ADE", name: "Adelaide" }],
    summary: { verified: 2, legacy: 1, eligible: 1, excluded: 2 },
  };
}

test("actual roster UI distinguishes legacy metadata, unattached retired players and unconfigured draft candidates", async () => {
  const { Component } = await loaded;
  const legacy: OwnerRosterRow = {
    ...base,
    name: "Legacy fixture",
    currentClubId: null,
    currentClubName: null,
    verification: "LEGACY",
    registration: "LEGACY",
    eligibilityReason: "Legacy approved-pool rule; current roster unreviewed",
    reviewedAt: null,
    evidenceUrl: "javascript:alert(1)",
  };
  const retired: OwnerRosterRow = {
    ...base,
    playerId: "20000000-0000-4000-8000-000000000002",
    name: "Retired fixture",
    currentClubId: null,
    currentClubName: null,
    registration: "RETIRED",
    eligibility: false,
    eligibilityReason: "Retired: excluded from new pack draws",
  };
  const drafted: OwnerRosterRow = {
    ...base,
    playerId: "20000000-0000-4000-8000-000000000003",
    name: "Draft <fixture>",
    savedClubs: [],
    eligibility: false,
    eligibilityReason: "Commercial definitions not configured",
    existingCards: 0,
    definitionCount: 0,
    approvedDefinitions: 0,
    lifetimeIssued: 0,
  };
  const html = renderToStaticMarkup(
    createElement(Component, {
      report: report([legacy, retired, drafted]),
      ownerId: "owner-fixture",
    }),
  );
  const rowHtml = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(
    (match) => match[1],
  );
  const old = rowHtml.find((row) => row.includes(legacy.playerId))!;
  const stopped = rowHtml.find((row) => row.includes(retired.playerId))!;
  const candidate = rowHtml.find((row) => row.includes(drafted.playerId))!;
  assert.match(old, /Current club unverified/);
  assert.match(old, /Former club/);
  assert.match(old, /Audit grouping for an unreviewed roster/);
  assert.match(old, /Eligible.*legacy rule/);
  assert.match(old, /Current roster not reviewed/);
  assert(!old.includes('href="javascript:'));
  assert.match(stopped, /Unattached/);
  assert.match(stopped, /Former club/);
  assert.match(stopped, /Retired: excluded from new pack draws/);
  assert.match(candidate, /Draft &lt;fixture&gt;/);
  assert.match(candidate, /Adelaide/);
  assert.match(candidate, /No card definitions/);
  assert.match(candidate, /Not configured/);
  assert.match(html, /rel="noreferrer noopener"/);
  assert(!/Approve roster|Activate player|Relist player/.test(html));
});

test("roster pagination preserves filters and CSV export retains filters across all pages", async () => {
  const { Component, exportQuery } = await loaded;
  const data = report([base]);
  data.page = 2;
  data.hasMore = true;
  data.total = 201;
  data.filters = {
    sport: "afl",
    club: "afl:ADE",
    status: "ACTIVE",
    issuance: "ELIGIBLE",
    verification: "VERIFIED",
    q: "Synthetic",
    page: 2,
  };
  const html = renderToStaticMarkup(
    createElement(Component, { report: data, ownerId: "owner-fixture" }),
  );
  const links = [...html.matchAll(/href="(\/admin\/rosters\?[^\"]+)"/g)].map(
    (match) =>
      new URL(match[1].replaceAll("&amp;", "&"), "https://fixture.invalid"),
  );
  assert.deepEqual(
    links.map((url) => url.searchParams.get("page")),
    ["1", "3"],
  );
  for (const url of links) {
    assert.equal(url.searchParams.get("club"), "afl:ADE");
    assert.equal(url.searchParams.get("verification"), "VERIFIED");
    assert.equal(url.searchParams.get("q"), "Synthetic");
  }
  assert.match(html, /every player matching these filters across all pages/);
  const exported = new URLSearchParams(
    exportQuery(
      "sport=afl&club=afl%3AADE&q=Synthetic&page=2&offset=100&status=ACTIVE&issuance=ELIGIBLE&verification=VERIFIED",
    ),
  );
  assert.equal(exported.get("format"), "csv");
  assert.equal(exported.get("club"), "afl:ADE");
  assert.equal(exported.get("status"), "ACTIVE");
  assert.equal(exported.get("issuance"), "ELIGIBLE");
  assert.equal(exported.get("verification"), "VERIFIED");
  assert.equal(exported.get("q"), "Synthetic");
  assert.equal(exported.has("page"), false);
  assert.equal(exported.has("offset"), false);
});

test("legacy club filters remain visibly unverified through pagination and full CSV export", async () => {
  const { Component, exportQuery } = await loaded;
  const clubName = "North & South / reserves";
  const clubId = `saved:${encodeURIComponent(clubName)}`;
  const selected = `afl:${clubId}`;
  const data = report([
    {
      ...base,
      verification: "LEGACY",
      registration: "LEGACY",
      currentClubId: null,
      currentClubName: null,
      savedClubs: [clubName],
      reviewedAt: null,
    },
  ]);
  data.page = 2;
  data.total = 201;
  data.hasMore = true;
  data.filters = {
    ...data.filters,
    club: selected,
    verification: "LEGACY",
    page: 2,
  };
  data.clubs = [
    {
      sport: "afl",
      id: clubId,
      name: `${clubName} (saved card club; unverified)`,
    },
    { sport: "afl", id: "ADE", name: "Adelaide" },
  ];
  const html = renderToStaticMarkup(
    createElement(Component, { report: data, ownerId: "owner-fixture" }),
  );
  assert.match(html, /Club for audit/);
  assert.match(
    html,
    /North &amp; South \/ reserves \(saved card club; unverified\)/,
  );
  assert.match(html, /Current club unverified/);
  assert.match(html, /unreviewed players are grouped by their saved card club/);
  assert(html.includes(`value="${selected}" selected=""`));
  const links = [...html.matchAll(/href="(\/admin\/rosters\?[^\"]+)"/g)].map(
    (match) =>
      new URL(match[1].replaceAll("&amp;", "&"), "https://fixture.invalid"),
  );
  assert.equal(links.length, 2);
  for (const url of links) {
    assert.equal(url.searchParams.get("club"), selected);
    assert.equal(url.searchParams.get("verification"), "LEGACY");
    const exported = new URLSearchParams(
      exportQuery(url.searchParams.toString()),
    );
    assert.equal(exported.get("club"), selected);
    assert.equal(exported.get("verification"), "LEGACY");
    assert.equal(exported.get("format"), "csv");
    assert.equal(exported.has("page"), false);
  }
});
