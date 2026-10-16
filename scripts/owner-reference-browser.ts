import { createServer } from "node:http";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  adminHref,
  adminNavigation,
  permittedSearchCategories,
} from "../src/core/admin-navigation";
import type { Operations } from "../src/core/owner-operations";
import type { OwnerReferenceData } from "../src/core/owner-reference-data";

const referencePath =
  ".codex-remote-attachments/01a0fc4b-1049-7211-91c9-af9141548b22/e978069f-8cb2-4a15-84d7-a5e70c4f6ced/1-1000050648.jpg";
const at = "2026-10-16T12:00:00Z";
const reference: OwnerReferenceData = {
  generatedAt: at,
  period: {
    start: "2026-09-17",
    end: "2026-10-16",
    previousStart: "2026-08-18",
    previousEnd: "2026-09-16",
    timezone: "Australia/Sydney",
  },
  kpis: {
    users: {
      current: 110,
      previous: 80,
      changePercent: 37.5,
      unit: "members",
      detail: "Retained registered fixture accounts",
    },
    packs: {
      current: 12,
      previous: 8,
      changePercent: 50,
      unit: "packs",
      detail: "Completed test-credit purchases",
    },
    revenue: {
      current: null,
      previous: null,
      changePercent: null,
      unit: "AUD",
      detail: "Settled payment reporting is not connected",
    },
    trades: {
      current: 4,
      previous: 4,
      changePercent: 0,
      unit: "trades",
      detail: "Completed isolated fixture trades",
    },
    circulation: {
      current: 90,
      previous: 74,
      changePercent: (16 / 74) * 100,
      unit: "cards",
      detail: "Issued cards, not maximum supply",
    },
  },
  registrations: Array.from({ length: 30 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 8, 17 + index)).toISOString().slice(0, 10),
    registrations: 1,
    cumulative: 81 + index,
  })),
  newUsers: { current: 30, previous: 20, changePercent: 50 },
  revenueSeries: null,
  packSales: [
    {
      id: "synthetic-premium",
      name: "NFL Premium Pack",
      type: "PREMIUM",
      sport: "nfl",
      cards: 9,
      sold: 4,
      testCredits: 7200,
      revenueAud: null,
    },
    {
      id: "synthetic-standard",
      name: "NFL Standard Pack",
      type: "STANDARD",
      sport: "nfl",
      cards: 9,
      sold: 8,
      testCredits: 7200,
      revenueAud: null,
    },
  ],
  topCards: [
    {
      id: "synthetic-card-1",
      name: "Synthetic Collector One",
      sport: "nfl",
      position: "QB",
      rarity: "RARE",
      sales: 3,
      testCredits: 1500,
      revenueAud: null,
      thumbnail: {
        name: "Synthetic Collector One",
        position: "QB",
        tier: "RARE",
        sport: "nfl",
        team: "",
        serial: 1,
        max_supply: 1000,
        verifiedJerseyNumber: null,
      },
    },
    {
      id: "synthetic-card-2",
      name: "Synthetic Collector Two",
      sport: "nfl",
      position: "WR",
      rarity: "ELITE",
      sales: 1,
      testCredits: 1200,
      revenueAud: null,
      thumbnail: {
        name: "Synthetic Collector Two",
        position: "WR",
        tier: "ELITE",
        sport: "nfl",
        team: "",
        serial: 2,
        max_supply: 500,
        verifiedJerseyNumber: null,
      },
    },
  ],
  recent: [
    {
      id: "synthetic-registration",
      kind: "registration",
      title: "New member registered",
      detail: "Isolated fixture member",
      at: "2026-10-16T11:58:00Z",
      href: "/admin/workspace/users",
    },
    {
      id: "synthetic-purchase",
      kind: "pack",
      title: "Pack purchased",
      detail: "NFL Standard Pack · test credits",
      at: "2026-10-16T11:55:00Z",
      href: "/admin/workspace/packs",
    },
    {
      id: "synthetic-listing",
      kind: "listing",
      title: "Card listed",
      detail: "Isolated test listing",
      at: "2026-10-16T11:52:00Z",
      href: "/admin/workspace/marketplace",
    },
    {
      id: "synthetic-report",
      kind: "report",
      title: "Report submitted",
      detail: "Evidence restricted to moderators",
      at: "2026-10-16T11:48:00Z",
      href: "/admin/workspace/moderation",
    },
  ],
  moderation: { content: 2, members: 1, listings: null },
  health: [
    {
      id: "database",
      label: "Database",
      status: "passed",
      detail: "Synthetic successful reporting query",
      checkedAt: at,
      href: "#owner-data",
    },
    ...(
      [
        ["api", "API"],
        ["web", "Web App"],
        ["android", "Android App"],
        ["jobs", "Background Jobs"],
        ["email", "Email Service"],
      ] as const
    ).map(([id, label]) => ({
      id,
      label,
      status: "unknown" as const,
      detail: "No service probe recorded in isolated fixture",
      checkedAt: null,
      href: "#owner-data",
    })),
  ],
  limitations: [
    "Synthetic local fixture. No hosted customer records or operations.",
  ],
};
const data: Operations & { reference: OwnerReferenceData } = {
  scope: "beta",
  generatedAt: at,
  metrics: { admitted: 3, newRegistrations: 30 },
  competitions: [],
  inventory: [],
  reports: [
    { id: "synthetic-report-1", status: "open", created_at: at },
    { id: "synthetic-report-2", status: "open", created_at: at },
    { id: "synthetic-report-3", status: "open", created_at: at },
  ],
  emailFailures: 0,
  limitations: reference.limitations,
  reference,
};

async function main() {
  const out = `docs/qa/owner-reference/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  console.log(JSON.stringify({ phase: "bundle", out }));
  const script = await bundleCommunityFixture(
    "tests/fixtures/owner-reference.tsx",
  );
  console.log(JSON.stringify({ phase: "bundle-ready" }));
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.*?\.css)"/g,
    ),
  ]
    .map((match) => readFileSync("src/app/" + match[1], "utf8"))
    .join("\n");
  const publicRoot = resolve("public");
  const requests: { method: string; path: string }[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://127.0.0.1");
    requests.push({ method: request.method!, path: url.pathname });
    if (url.pathname === "/fixture-state") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: url.searchParams.get("state") === "unavailable" ? null : data,
          role: url.searchParams.get("role") ?? "owner",
        }),
      );
    } else if (url.pathname === "/fixture.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(script);
    } else if (url.pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else if (url.pathname === "/api/admin/search") {
      response.setHeader("Content-Type", "application/json");
      const query = url.searchParams.get("q");
      if (query === "failure") {
        response.statusCode = 503;
        response.end(
          JSON.stringify({ error: "Search temporarily unavailable" }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          query,
          page: 1,
          pageSize: 20,
          hasMore: false,
          categories: permittedSearchCategories("owner"),
          results:
            query === "synthetic"
              ? [
                  {
                    id: "synthetic-member",
                    category: "members",
                    title: "Synthetic member",
                    detail: "Admitted isolated fixture",
                    href: "/admin/workspace/users?record=synthetic-member&category=members",
                  },
                ]
              : [],
        }),
      );
    } else if (url.pathname.startsWith("/api/")) {
      response.setHeader("Content-Type", "application/json");
      response.statusCode = 503;
      response.end(
        JSON.stringify({ error: "Isolated fixture: service unavailable" }),
      );
    } else {
      const file = resolve(publicRoot, "." + url.pathname);
      if (
        file.startsWith(publicRoot + sep) &&
        existsSync(file) &&
        !url.pathname.endsWith("/")
      ) {
        response.setHeader(
          "Content-Type",
          url.pathname.endsWith(".svg")
            ? "image/svg+xml"
            : url.pathname.endsWith(".png")
              ? "image/png"
              : url.pathname.endsWith(".webp")
                ? "image/webp"
                : url.pathname.endsWith(".woff2")
                  ? "font/woff2"
                  : "application/octet-stream",
        );
        response.end(readFileSync(file));
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked owner reference review · synthetic fixture</title><link rel="stylesheet" href="/style.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
        );
      }
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium
    .launch({ channel: "msedge", headless: true })
    .catch(async (error: unknown) => {
      await new Promise<void>((done) => server.close(() => done()));
      throw error;
    });
  console.log(JSON.stringify({ phase: "browser-ready" }));
  const checks: unknown[] = [];
  try {
    for (const [width, height] of [
      [1536, 1024],
      [1440, 900],
      [1024, 900],
      [412, 915],
      [360, 800],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "/admin/operations");
      console.log(JSON.stringify({ phase: "page-ready", width }));
      await expect(
        page.getByRole("heading", { name: /Welcome back/ }),
      ).toBeVisible();
      await page.evaluate(() =>
        Promise.race([
          (async () => {
            // Full-page evidence includes below-fold lazy card logos. Eager loading
            // applies only to this isolated screenshot document, never app source.
            for (const image of document.images) image.loading = "eager";
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.images, (image) =>
                image.decode().catch(() => undefined),
              ),
            );
          })(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Fixture assets did not settle: " +
                      Array.from(document.images)
                        .filter((image) => !image.complete)
                        .map((image) => image.getAttribute("src"))
                        .join(", "),
                  ),
                ),
              15000,
            ),
          ),
        ]),
      );
      console.log(JSON.stringify({ phase: "assets-ready", width }));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `page overflow at ${width}`,
      );
      await page.screenshot({
        path: `${out}/owner-${width}.png`,
        fullPage: false,
      });
      await page.screenshot({
        path: `${out}/owner-${width}-full.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page }).analyze();
      writeFileSync(
        `${out}/axe-${width}.json`,
        JSON.stringify(axe.violations, null, 2),
      );
      assert.deepEqual(
        axe.violations
          .filter((issue) =>
            ["critical", "serious"].includes(issue.impact ?? ""),
          )
          .map((issue) => issue.id),
        [],
      );
      const geometry = await page
        .locator(
          ".admin-sidebar,.admin-topbar,.owner-welcome,.owner-reference-kpis,.owner-reference-charts",
        )
        .evaluateAll((items) =>
          items.map((item) => ({
            className: item.className,
            bounds: item.getBoundingClientRect().toJSON(),
          })),
        );
      for (const chart of await page.locator("svg.owner-chart").all()) {
        const bounds = await chart.boundingBox();
        assert.ok(
          bounds && bounds.width >= 200 && bounds.height >= 100,
          `Readable chart dimensions at ${width}: ${JSON.stringify(bounds)}`,
        );
        const ticks = await chart.locator("g text").allTextContents();
        assert.equal(
          new Set(ticks).size,
          ticks.length,
          "Count chart axis ticks must not repeat rounded labels",
        );
      }
      const revenueKpi = page
        .locator(".owner-kpi")
        .filter({ hasText: "Revenue (AUD)" });
      assert.equal(
        await revenueKpi.locator("strong").evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        }),
        1,
        "Unavailable KPI remains one readable line",
      );
      await page.keyboard.press("Control+k");
      const search = page.getByRole("textbox", {
        name: "Search permitted administrative records",
      });
      await expect(search).toBeFocused();
      await search.fill("synthetic");
      await expect(
        page.getByRole("link", { name: /Synthetic member/ }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("region", { name: "Administrative search results" }),
      ).toBeHidden();
      await expect(search).toBeFocused();
      await page.keyboard.press("Control+k");
      await search.fill("failure");
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Search temporarily unavailable" }),
      ).toBeVisible();
      await search.fill("none");
      await expect(
        page.getByRole("status").filter({ hasText: "No matching records" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      assert.notEqual(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
        "hidden",
        "search never leaves scroll locked",
      );
      const links = await page.locator("a[href]").evaluateAll((items) =>
        items.map((item) => ({
          label: item.textContent?.trim(),
          href: item.getAttribute("href"),
        })),
      );
      for (const item of adminNavigation)
        assert.ok(
          links.some((link) => link.href === adminHref(item.id, "owner")),
          `Missing ${item.label} navigation`,
        );
      assert.deepEqual(
        await page.locator(".admin-sidebar nav a > span").allTextContents(),
        [
          "Dashboard",
          "Users",
          "Cards & Inventory",
          "Packs",
          "Marketplace",
          "Competitions",
          "Content & News",
          "Moderation",
          "Payments & Wallets",
          "Rewards & Credits",
          "Analytics",
          "Communications",
          "Settings",
        ],
        "Exact reference navigation order",
      );
      for (const [label, destination] of [
        ["Issue Credits", "/admin/workspace/rewards?action=issue"],
        ["Send Announcement", "/admin/workspace/communications?action=draft"],
        ["Manage Packs", "/admin/workspace/packs"],
        ["View Reports", "/admin/workspace/analytics"],
      ]) {
        const link = page.getByRole("link", { name: label, exact: true });
        await expect(link).toHaveAttribute("href", destination);
      }
      const selects = await page.locator("select").evaluateAll((items) =>
        items.map((item) => ({
          label: item.getAttribute("aria-label"),
          options: Array.from((item as HTMLSelectElement).options).map(
            (option) => option.value,
          ),
        })),
      );
      assert.ok(
        selects.length >= 3,
        "Three chart period controls remain available",
      );
      if (width === 1536) {
        await page.goto(
          base +
            "/admin/operations?period=30&start=2026-10-01&end=2026-10-16&sport=nfl&scope=beta",
        );
        for (const [label, value] of [
          ["Revenue reporting period", "7"],
          ["New users reporting period", "90"],
          ["User growth reporting period", "365"],
        ]) {
          await Promise.all([
            page.waitForURL((url) => url.searchParams.get("period") === value),
            page
              .getByRole("combobox", { name: label, exact: true })
              .selectOption(value),
          ]);
          await expect(
            page.getByRole("heading", { name: /Welcome back/ }),
          ).toBeVisible();
          const destination = new URL(page.url());
          assert.equal(destination.searchParams.get("start"), null);
          assert.equal(destination.searchParams.get("end"), null);
          assert.equal(destination.searchParams.get("sport"), "nfl");
          assert.equal(destination.searchParams.get("scope"), "beta");
          for (const control of await page.getByRole("combobox").all())
            await expect(control).toHaveValue(value);
        }
        await page
          .locator(".owner-health-grid")
          .getByRole("link", { name: /Background Jobs/ })
          .click();
        await expect(page.locator(".owner-reference-detail")).toHaveAttribute(
          "open",
          "",
        );
        await expect(page.locator("#owner-data")).toBeVisible();
      }
      if (width <= 1024) {
        const open = page.getByRole("button", {
          name: "Open administration navigation",
          exact: true,
        });
        await open.click();
        await expect(
          page.getByRole("navigation", { name: "Administration", exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("navigation", { name: "Administration", exact: true }),
        ).toBeHidden();
        await expect(open).toBeFocused();
        await page.keyboard.press("Space");
        await expect(
          page.getByRole("navigation", { name: "Administration", exact: true }),
        ).toBeVisible();
        await page.evaluate(() =>
          window.dispatchEvent(new PopStateEvent("popstate")),
        );
        await expect(
          page.getByRole("navigation", { name: "Administration", exact: true }),
        ).toBeHidden();
      }
      assert.deepEqual(errors, [], "No client runtime errors");
      checks.push({
        width,
        height,
        pageOverflow: false,
        criticalOrSeriousAxe: 0,
        keyboardSearch: "pass",
        searchFailureRecovery: "pass",
        navigationHrefs: links,
        chartSelects: selects,
        geometry,
        runtimeErrors: errors,
      });
      await context.close();
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(base + "/admin/operations?state=unavailable");
    await expect(
      page.getByText(/unavailable|not connected/i).first(),
    ).toBeVisible();
    await page.screenshot({
      path: `${out}/owner-unavailable.png`,
      fullPage: true,
    });
    await page.goto(base + "/admin/operations?role=editor");
    const sidebarLinks = await page
      .locator(".admin-sidebar a[href]")
      .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
    for (const section of ["payments", "rewards", "users", "cards"])
      assert.ok(
        !sidebarLinks.includes(`/admin/workspace/${section}`),
        `${section} hidden from editor sidebar`,
      );
    await page.goto(base + "/admin/workspace/communications");
    await page
      .getByLabel("Title", { exact: true })
      .fill("Isolated review notice");
    await page
      .getByLabel("Message", { exact: true })
      .fill("Synthetic announcement preview. No delivery requested.");
    await page
      .getByRole("button", { name: "Preview announcement", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Announcement preview" }),
    ).toBeVisible();
    await expect(
      page.getByText("Draft · not sent or saved", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear draft", exact: true })
      .click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("article", { name: "Announcement preview" }),
    ).toBeHidden();
    for (const [kind, shown, hidden] of [
      ["content", "content case", "member case"],
      ["members", "member case", "content case"],
    ]) {
      await page.goto(base + "/admin/community/reports?kind=" + kind);
      await expect(
        page.getByRole("heading", { name: shown, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: hidden, exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "closed case", exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole("combobox", { name: "Report status", exact: true }),
      ).toHaveValue("outstanding");
      await expect(
        page.getByRole("button", { name: "Record moderation action" }),
      ).toBeHidden();
    }
    await context.close();
    assert.deepEqual(
      requests.filter((request) => request.method !== "GET"),
      [],
      "Presentation review cannot issue financial or member mutations",
    );
    copyFileSync(referencePath, `${out}/reference-original.jpg`);
    writeFileSync(
      `${out}/comparison.html`,
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked owner reference comparison</title><style>body{background:#030c1d;color:#edf4ff;font:15px system-ui;margin:24px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;height:auto;border:1px solid #20334e}p{max-width:1000px}a{color:#65bcff}@media(max-width:900px){main{grid-template-columns:1fr}}</style><h1>Owner dashboard · reference comparison</h1><p>Left: original supplied 1280 × 853 JPEG, copied unchanged. Right: actual 1536 × 1024 browser rendering with synthetic fixture records. Figures intentionally differ. Revenue is unavailable and unprobed health stays unknown. This is visual review, not authenticated or physical-device acceptance.</p><main><figure><figcaption>Supplied reference</figcaption><img src="reference-original.jpg" alt="Supplied Docked owner dashboard reference"></figure><figure><figcaption>Implemented dashboard · isolated synthetic records</figcaption><img src="owner-1536.png" alt="Actual desktop dashboard rendering"></figure></main><p><a href="owner-1440.png">1440 desktop</a> · <a href="owner-1024-full.png">Tablet</a> · <a href="owner-412-full.png">412 mobile</a> · <a href="owner-360-full.png">360 narrow mobile</a> · <a href="acceptance.json">Machine-readable evidence</a></p></html>`,
    );
    const result = {
      passed: true,
      out,
      reference: { path: referencePath, width: 1280, height: 853 },
      scope:
        "Actual production presentation components with isolated synthetic aggregates and simulated search API. Not authentication, hosted actions, physical-device or pixel-perfect acceptance.",
      checks,
      restrictedEditorSidebar: true,
      noMutationRequests: true,
    };
    writeFileSync(`${out}/acceptance.json`, JSON.stringify(result, null, 2));
    cpSync(out, "docs/qa/owner-reference/final", { recursive: true });
    writeFileSync(
      "docs/qa/owner-reference/latest.json",
      JSON.stringify(
        {
          out,
          acceptance: "docs/qa/owner-reference/final/acceptance.json",
          comparison: "docs/qa/owner-reference/final/comparison.html",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, out }));
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
