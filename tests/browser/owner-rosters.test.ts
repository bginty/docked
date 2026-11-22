import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ownerRosterQuery,
  type OwnerRosterReport,
  type OwnerRosterRow,
} from "../../src/core/commercial-player-roster";
import { ownerRosterCsv } from "../../src/core/owner-roster-export";

const owner = "10000000-0000-4000-8000-000000000001";
const makeId = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base: OwnerRosterRow = {
  playerId: makeId(1),
  name: "Synthetic player 001",
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
  revision: "30000000-0000-4000-8000-000000000001",
  existingCards: 4,
  definitionCount: 5,
  approvedDefinitions: 5,
  lifetimeIssued: 7,
  aliases: [{ provider: "fixture", providerId: "synthetic-player-1" }],
  supply: [],
};
const records: OwnerRosterRow[] = [
  ...Array.from({ length: 201 }, (_, index) => ({
    ...base,
    playerId: makeId(index + 1),
    name: `Synthetic player ${String(index + 1).padStart(3, "0")}`,
  })),
  {
    ...base,
    playerId: makeId(202),
    name: "Legacy fixture",
    currentClubId: null,
    currentClubName: null,
    registration: "LEGACY",
    verification: "LEGACY",
    reviewedAt: null,
    evidenceUrl: "javascript:alert(1)",
    eligibilityReason: "Existing approved pool; current roster unreviewed",
  },
  {
    ...base,
    playerId: makeId(203),
    name: "Retired fixture",
    currentClubId: null,
    currentClubName: null,
    registration: "RETIRED",
    eligibility: false,
    eligibilityReason: "Excluded: retired",
  },
  {
    ...base,
    playerId: makeId(204),
    name: "Draft <fixture>",
    savedClubs: [],
    eligibility: false,
    eligibilityReason: "No permanent definitions registered",
    existingCards: 0,
    definitionCount: 0,
    approvedDefinitions: 0,
    lifetimeIssued: 0,
  },
];

// Transport fixture mirrors the server's already separately tested filtering.
// The browser exercise uses the real production UI, command schema and CSV encoder.
function report(url: URL, all = false): OwnerRosterReport {
  const filters = ownerRosterQuery.parse(Object.fromEntries(url.searchParams));
  const matching = records.filter(
    (row) =>
      (filters.sport === "all" || filters.sport === row.sport) &&
      (!filters.club || `${row.sport}:${row.currentClubId}` === filters.club) &&
      (filters.status === "ALL" || filters.status === row.registration) &&
      (filters.issuance === "ALL" ||
        row.eligibility === (filters.issuance === "ELIGIBLE")) &&
      (filters.verification === "ALL" ||
        row.verification === filters.verification) &&
      (!filters.q || row.name.toLowerCase().includes(filters.q.toLowerCase())),
  );
  const start = (filters.page - 1) * 100;
  return {
    generatedAt: "2026-11-22T00:02:00Z",
    filters,
    rows: all ? matching : matching.slice(start, start + 100),
    total: matching.length,
    page: filters.page,
    pageSize: 100,
    hasMore: !all && start + 100 < matching.length,
    clubs: [{ sport: "afl", id: "ADE", name: "Adelaide" }],
    summary: {
      verified: matching.filter((r) => r.verification === "VERIFIED").length,
      legacy: matching.filter((r) => r.verification === "LEGACY").length,
      eligible: matching.filter((r) => r.eligibility).length,
      excluded: matching.filter((r) => !r.eligibility).length,
    },
  };
}

async function fixture(page: Page) {
  const result = await build({
    entryPoints: ["tests/fixtures/owner-rosters.tsx"],
    bundle: true,
    write: false,
    outdir: ".isolated-roster-fixture",
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-next-link",
        setup(builder) {
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: path.resolve("tests/fixtures/community-framework-shim.tsx"),
          }));
        },
      },
    ],
  });
  const script = result.outputFiles.find((file) =>
    file.path.endsWith(".js"),
  )!.text;
  const css = result.outputFiles.find((file) =>
    file.path.endsWith(".css"),
  )!.text;
  const globals = await readFile("src/app/globals.css", "utf8");
  const exports: URL[] = [];
  const mutations: string[] = [];
  const errors: string[] = [];
  let failExport = false;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") mutations.push(request.method());
    if (url.pathname === "/api/admin/rosters") {
      exports.push(url);
      expect(request.method()).toBe("GET");
      expect(request.headers()["x-docked-owner"]).toBe(owner);
      expect(url.searchParams.get("format")).toBe("csv");
      expect(url.searchParams.has("page")).toBe(false);
      expect(url.searchParams.has("offset")).toBe(false);
      if (failExport) {
        failExport = false;
        return route.fulfill({
          status: 503,
          json: { error: "Synthetic outage" },
        });
      }
      return route.fulfill({
        contentType: "text/csv; charset=utf-8",
        body: ownerRosterCsv(report(url, true)),
      });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404 });
    if (url.pathname === "/fixture.js")
      return route.fulfill({ contentType: "text/javascript", body: script });
    if (url.pathname === "/fixture.css")
      return route.fulfill({ contentType: "text/css", body: globals + css });
    if (url.pathname === "/admin/operations")
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Synthetic operations destination</h1>",
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated Owner roster</title><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:#03101e;color:#edf5fd;font:16px system-ui}a{color:#93d0ff}</style></head><body><main id="fixture-root"></main><script>window.ownerRosterFixture=${JSON.stringify({ owner, report: report(url) }).replaceAll("<", "\\u003c")}</script><script src="/fixture.js"></script></body></html>`,
    });
  });
  return {
    exports,
    mutations,
    errors,
    failNextExport: () => {
      failExport = true;
    },
  };
}

test("Owner roster filters and pagination retain the full CSV scope on mobile", async ({
  page,
}, testInfo) => {
  const transport = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://fixture.invalid/admin/rosters");
  await expect(
    page.getByRole("heading", { name: "Player roster", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("afl");
  await page
    .getByRole("combobox", { name: "Club for audit", exact: true })
    .selectOption("afl:ADE");
  await page.getByLabel("Player name or ID", { exact: true }).fill("Synthetic");
  await page
    .getByRole("combobox", { name: "Registration", exact: true })
    .selectOption("ACTIVE");
  await page
    .getByRole("combobox", { name: "Roster / supply eligibility", exact: true })
    .selectOption("ELIGIBLE");
  await page
    .getByRole("combobox", { name: "Roster review", exact: true })
    .selectOption("VERIFIED");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "201 matching players", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("tbody tr").first()).toContainText(
    "Synthetic player 101",
  );
  await expect(page.locator("tbody tr").last()).toContainText(
    "Synthetic player 200",
  );
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    sport: "afl",
    club: "afl:ADE",
    q: "Synthetic",
    status: "ACTIVE",
    issuance: "ELIGIBLE",
    verification: "VERIFIED",
    page: "2",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const tableRegion = page.getByRole("region", {
    name: "Player roster table; scroll horizontally for all columns",
    exact: true,
  });
  await tableRegion.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => tableRegion.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("roster-page-two-mobile.png"),
    fullPage: false,
  });

  transport.failNextExport();
  await page
    .getByRole("button", { name: "Export matching roster CSV", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Roster export is unavailable. Check your Owner access and try again.",
  );
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export matching roster CSV", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(
    /^docked-player-roster-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const saved = testInfo.outputPath("complete-filtered-roster.csv");
  await download.saveAs(saved);
  const csv = await readFile(saved, "utf8");
  expect(csv.split("\r\n").filter(Boolean)).toHaveLength(202);
  expect(csv).toContain("Synthetic player 001");
  expect(csv).toContain("Synthetic player 201");
  expect(csv).not.toContain("Retired fixture");
  expect(csv).not.toContain("Legacy fixture");
  expect(transport.exports).toHaveLength(2);
  expect(Object.fromEntries(transport.exports[1].searchParams)).toMatchObject({
    club: "afl:ADE",
    q: "Synthetic",
    status: "ACTIVE",
    issuance: "ELIGIBLE",
    verification: "VERIFIED",
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Synthetic player 201");
  await expect(
    page.getByRole("link", { name: "Next page", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Commercial operations", exact: true })
    .click();
  await expect(page).toHaveURL("https://fixture.invalid/admin/operations");
  expect(transport.mutations).toEqual([]);
  expect(transport.errors).toEqual([]);
});

test("Owner roster clearly separates legacy, retired and unconfigured players without mutation", async ({
  page,
}, testInfo) => {
  const transport = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("https://fixture.invalid/admin/rosters?status=LEGACY");
  const legacy = page.locator("tbody tr");
  await expect(legacy).toContainText("Current club unverified");
  await expect(legacy).toContainText("Former club");
  await expect(legacy).toContainText("Eligible · legacy rule");
  await expect(legacy.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(
    page.getByText("Legacy players have no reviewed current roster record.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Registration", exact: true })
    .selectOption("RETIRED");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  const retired = page.locator("tbody tr");
  await expect(retired).toContainText("Unattached");
  await expect(retired).toContainText("Retired");
  await expect(retired).toContainText("Excluded: retired");
  await expect(
    retired.getByRole("cell", { name: "4", exact: true }),
  ).toBeVisible();
  await expect(
    retired.getByRole("link", { name: "Roster source", exact: true }),
  ).toHaveAttribute("rel", "noreferrer noopener");
  await page.screenshot({
    path: testInfo.outputPath("retired-roster-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Reset", exact: true }).click();
  await page.getByLabel("Player name or ID", { exact: true }).fill("Draft");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  const candidate = page.locator("tbody tr");
  await expect(candidate).toContainText("Draft <fixture>");
  await expect(candidate).toContainText("No card definitions");
  await expect(candidate).toContainText("Not configured");
  await expect(
    page.getByRole("button", { name: /Activate|Relist|Approve/ }),
  ).toHaveCount(0);
  expect(transport.mutations).toEqual([]);
  expect(transport.errors).toEqual([]);
});
