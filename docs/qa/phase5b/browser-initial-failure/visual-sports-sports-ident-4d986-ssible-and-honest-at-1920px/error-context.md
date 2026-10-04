# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-sports.test.ts >> sports identity remains accessible and honest at 1920px
- Location: tests\browser\visual-sports.test.ts:43:7

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByText('Settled publications').locator('..').locator('strong')
Expected: "N/A"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" getByText('Settled publications').locator('..').locator('strong') with timeout 5000ms
  - waiting for getByText('Settled publications').locator('..').locator('strong')

```

```yaml
- link "Skip to content":
  - /url: "#main"
- text: BUILT FOR AN EDGE 18+ · Research preview
- banner:
  - link "Docked home":
    - /url: /
  - navigation "Main navigation":
    - link "Edges":
      - /url: /edges
    - link "Results":
      - /url: /results
    - link "Sports":
      - /url: /sports
    - link "Research":
      - /url: /research
    - link "Community":
      - /url: /community
    - link "Learn":
      - /url: /learn
    - link "Methodology":
      - /url: /methodology
  - link "Sign in":
    - /url: /login
  - link "Join free":
    - /url: /join
- text: PREVIEW · Model research in progress · Live tips and outbound alerts are off
- main:
  - paragraph: DOCKED / RESULTS
  - heading "DOCKED RECORD" [level=1]
  - region "Docked official forward record":
    - paragraph: Docked’s official record begins with its first genuine forward-published Edge. We do not reconstruct historical tips.
    - text: GENUINE FORWARD PUBLICATIONS · FIXED ONE-UNIT BENCHMARK
    - complementary: The official record is currently unavailable. Its start date and performance cannot be inferred from an inaccessible record.
    - text: From publication date
    - textbox "From publication date"
    - text: To publication date
    - textbox "To publication date"
    - text: Competition
    - combobox "Competition":
      - option "All competitions" [selected]
    - text: Model version
    - combobox "Model version":
      - option "All model versions" [selected]
    - button "Apply filters"
    - link "Complete all-time record":
      - /url: /results
    - paragraph: Published
    - strong: Unavailable
    - paragraph: Settled
    - strong: Unavailable
    - paragraph: Wins
    - strong: Unavailable
    - paragraph: Losses
    - strong: Unavailable
    - paragraph: Voids
    - strong: Unavailable
    - paragraph: Pending
    - strong: Unavailable
    - paragraph: Net Units
    - strong: Unavailable
    - paragraph: ROI
    - strong: Unavailable
    - paragraph: Avg Published Odds
    - strong: Unavailable
    - paragraph: Avg Estimated Edge
    - strong: Unavailable
    - paragraph: Max Drawdown
    - strong: Unavailable
    - paragraph: Longest Losing Run
    - strong: Unavailable
    - complementary: All accessible genuine official publications are included, with losses, voids and corrections. Research, forward paper, demonstrations and reconstructed history are excluded. Estimates can be wrong; this record does not promise future profit.
    - text: Cumulative units will appear when a settled live record exists.
    - heading "Every official publication" [level=2]
    - region "Complete official publication ledger":
      - table "One unit at the locked publication odds. Current prices never rewrite the benchmark.":
        - caption: One unit at the locked publication odds. Current prices never rewrite the benchmark.
        - rowgroup:
          - row "Publication / event Selection Model version Published odds Estimated edge Result Net units Corrections":
            - columnheader "Publication / event"
            - columnheader "Selection"
            - columnheader "Model version"
            - columnheader "Published odds"
            - columnheader "Estimated edge"
            - columnheader "Result"
            - columnheader "Net units"
            - columnheader "Corrections"
        - rowgroup:
          - row "No accessible genuine official publications. Unavailable records are not zero performance.":
            - cell "No accessible genuine official publications. Unavailable records are not zero performance."
    - paragraph: ROI is net units divided by settled non-void one-unit stakes. Pending and disputed entries have no assumed return. Voids return the unit and do not enter the ROI denominator. Published-odds and estimated-edge averages include pending and void publications; missing observations make that average unavailable. Drawdown and losing runs use settlement order, including corrected outcomes.
    - heading "Performance over time" [level=2]
    - paragraph: Monthly performance will appear when genuine settlements are available. No historical results are filled in.
    - link "Methodology and model changes":
      - /url: /methodology
- contentinfo:
  - link "Docked home":
    - /url: /
  - paragraph: BUILT FOR AN EDGE
  - paragraph: Informational analysis. No wagering, wallets or guaranteed returns.
  - navigation "Research links":
    - link "Methodology":
      - /url: /methodology
    - link "Sports and research scope":
      - /url: /sports
    - link "Data status":
      - /url: /data-status
    - link "About Docked":
      - /url: /about
    - link "Contact":
      - /url: /contact
  - navigation "Policy links":
    - link "Safer Gambling":
      - /url: /safer-gambling
    - link "Terms":
      - /url: /terms
    - link "Privacy":
      - /url: /privacy
    - link "Legacy product support":
      - /url: /legacy-support
  - paragraph: Gambling can cause harm. Never chase losses. You can use Docked without betting.
  - paragraph: All core features free for 12 months from public launch. No card. No automatic conversion.
- alert
```

# Test source

```ts
  1   | import { test, expect, type Locator, type Route } from "@playwright/test";
  2   | import AxeBuilder from "@axe-core/playwright";
  3   | import { execFileSync } from "node:child_process";
  4   | import { mkdir, writeFile } from "node:fs/promises";
  5   | import path from "node:path";
  6   | import { sports } from "../../src/content/sports";
  7   | import { evidenceRoot } from "./evidence";
  8   | 
  9   | const evidenceDirectory = path.join(
  10  |   evidenceRoot,
  11  |   "web-regression/sports-regression",
  12  | );
  13  | const routes = {
  14  |   homepage: "/",
  15  |   edges: "/edges",
  16  |   results: "/results",
  17  |   learn: "/learn",
  18  |   article: "/learn/minimum-odds",
  19  |   sports: "/sports",
  20  |   "sport-football": "/sports/football",
  21  |   "sport-basketball": "/sports/basketball",
  22  |   "sport-tennis": "/sports/tennis",
  23  |   "member-locked": "/dashboard",
  24  |   "admin-locked": "/admin",
  25  | };
  26  | 
  27  | async function expectStaticResponsivePhoto(photo: Locator) {
  28  |   const source = new URL(
  29  |     await photo.evaluate((image) => (image as HTMLImageElement).currentSrc),
  30  |   );
  31  |   expect(source.origin).toBe("http://localhost:3000");
  32  |   expect(source.pathname).toMatch(
  33  |     /^\/images\/sports\/(?:responsive\/)?[a-z0-9-]+\.webp$/,
  34  |   );
  35  |   await expect(photo).toHaveAttribute(
  36  |     "srcset",
  37  |     /\/images\/sports\/responsive\/.+\.webp \d+w/,
  38  |   );
  39  |   await photo.evaluate((image) => (image as HTMLImageElement).decode());
  40  | }
  41  | 
  42  | for (const width of [390, 430, 768, 1366, 1920]) {
  43  |   test(`sports identity remains accessible and honest at ${width}px`, async ({
  44  |     page,
  45  |   }) => {
  46  |     test.setTimeout(180000);
  47  |     await mkdir(evidenceDirectory, { recursive: true });
  48  |     await page.setViewportSize({ width, height: 1000 });
  49  |     const errors: string[] = [];
  50  |     const optimizerRequests: string[] = [];
  51  |     page.on("request", (request) => {
  52  |       if (new URL(request.url()).pathname === "/_next/image")
  53  |         optimizerRequests.push(request.url());
  54  |     });
  55  |     page.on("pageerror", (error) => errors.push(error.message));
  56  |     page.on("console", (message) => {
  57  |       if (message.type() === "error") errors.push(message.text());
  58  |     });
  59  |     const scanned: {
  60  |       route: string;
  61  |       decorativePhotos: number;
  62  |       violations: number;
  63  |     }[] = [];
  64  |     for (const [name, route] of Object.entries(routes)) {
  65  |       expect(
  66  |         (await page.goto(route, { waitUntil: "networkidle" }))?.status(),
  67  |       ).toBe(200);
  68  |       await expect(page.locator("h1")).toHaveCount(1);
  69  |       // Load below-fold photos before the screenshot; this is deliberately separate from performance measurement.
  70  |       for (const photo of await page.locator(".sport-image img").all()) {
  71  |         await photo.scrollIntoViewIfNeeded();
  72  |         await expect(photo).toHaveAttribute("alt", "");
  73  |         await expect
  74  |           .poll(() =>
  75  |             photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  76  |           )
  77  |           .toBeGreaterThan(0);
  78  |         await expectStaticResponsivePhoto(photo);
  79  |       }
  80  |       expect(
  81  |         await page.evaluate(
  82  |           () => document.documentElement.scrollWidth <= innerWidth,
  83  |         ),
  84  |         route,
  85  |       ).toBe(true);
  86  |       if (route === "/edges") {
  87  |         await expect(
  88  |           page.getByRole("heading", { name: "Research validation pending" }),
  89  |         ).toBeVisible();
  90  |         await expect(
  91  |           page.getByRole("heading", { name: "No qualifying edge right now." }),
  92  |         ).toHaveCount(0);
  93  |       }
  94  |       if (route === "/results") {
  95  |         await expect(
  96  |           page
  97  |             .getByText("Settled publications")
  98  |             .locator("..")
  99  |             .locator("strong"),
> 100 |         ).toHaveText("N/A");
      |           ^ Error: expect(locator).toHaveText(expected) failed
  101 |       }
  102 |       if (route === "/dashboard")
  103 |         await expect(
  104 |           page.getByRole("heading", {
  105 |             name: "Sign in to your verified account",
  106 |           }),
  107 |         ).toBeVisible();
  108 |       if (route === "/admin")
  109 |         await expect(
  110 |           page.getByRole("heading", { name: "Verified access required." }),
  111 |         ).toBeVisible();
  112 |       const violations = (
  113 |         await new AxeBuilder({ page })
  114 |           .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  115 |           .analyze()
  116 |       ).violations;
  117 |       expect(violations, route).toEqual([]);
  118 |       scanned.push({
  119 |         route,
  120 |         decorativePhotos: await page.locator(".sport-image img").count(),
  121 |         violations: violations.length,
  122 |       });
  123 |       await page.evaluate(() =>
  124 |         window.scrollTo({ top: 0, behavior: "instant" }),
  125 |       );
  126 |       await page.screenshot({
  127 |         path: path.join(evidenceDirectory, `${name}-${width}.png`),
  128 |         fullPage: true,
  129 |       });
  130 |     }
  131 |     await writeFile(
  132 |       path.join(evidenceDirectory, `browser-${width}.json`),
  133 |       JSON.stringify({ width, errors, optimizerRequests, scanned }, null, 2) +
  134 |         "\n",
  135 |     );
  136 |     expect(errors).toEqual([]);
  137 |     expect(optimizerRequests).toEqual([]);
  138 |   });
  139 | }
  140 | 
  141 | test("all ten sport routes decode local optimized photos and retain explicit coverage status", async ({
  142 |   page,
  143 |   request,
  144 | }) => {
  145 |   test.setTimeout(90000);
  146 |   await page.setViewportSize({ width: 1366, height: 1000 });
  147 |   const errors: string[] = [];
  148 |   page.on("pageerror", (error) => errors.push(error.message));
  149 |   page.on("console", (message) => {
  150 |     if (message.type() === "error") errors.push(message.text());
  151 |   });
  152 |   for (const sport of sports) {
  153 |     const route = `/sports/${sport.slug}`;
  154 |     expect(
  155 |       (await page.goto(route, { waitUntil: "networkidle" }))?.status(),
  156 |     ).toBe(200);
  157 |     await expect(page.locator("h1")).toHaveText(sport.title);
  158 |     await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
  159 |       "href",
  160 |       new RegExp(`${route}$`),
  161 |     );
  162 |     await expect(
  163 |       page.locator(".sport-page-hero .sport-coverage-badge"),
  164 |     ).toHaveText(
  165 |       ["football", "basketball"].includes(sport.slug)
  166 |         ? "Research coverage"
  167 |         : "Coming soon",
  168 |     );
  169 |     const photo = page.locator(".sport-page-photo img");
  170 |     await expect(photo).toHaveAttribute("alt", "");
  171 |     await expect
  172 |       .poll(() =>
  173 |         photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  174 |       )
  175 |       .toBeGreaterThan(0);
  176 |     await expectStaticResponsivePhoto(photo);
  177 |     await expect(page.locator(".sport-opportunities .edge-card")).toHaveCount(
  178 |       0,
  179 |     );
  180 |     await expect(page.locator(".sport-quiet-state")).toContainText(
  181 |       ["football", "basketball"].includes(sport.slug)
  182 |         ? "does not imply a completed scan or a live feed"
  183 |         : "no active pricing pipeline",
  184 |     );
  185 |   }
  186 |   const legacy = await request.get("/sports/nba", { maxRedirects: 0 });
  187 |   expect(legacy.status()).toBe(308);
  188 |   expect(legacy.headers().location).toBe("/sports/basketball");
  189 |   expect(errors).toEqual([]);
  190 | });
  191 | 
  192 | test("cancelled atmosphere and motorsport photo loads recover on immediate revisit without a runtime optimizer", async ({
  193 |   page,
  194 | }) => {
  195 |   await page.setViewportSize({ width: 390, height: 1000 });
  196 |   const optimizerRequests: string[] = [],
  197 |     errors: string[] = [];
  198 |   page.on("request", (request) => {
  199 |     if (new URL(request.url()).pathname === "/_next/image")
  200 |       optimizerRequests.push(request.url());
```