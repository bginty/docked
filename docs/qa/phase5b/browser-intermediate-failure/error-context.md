# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: experience.test.ts >> preview public pages remain truthful, accessible and usable without an account
- Location: tests\browser\experience.test.ts:126:5

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
  - link "Sign in":
    - /url: /login
  - link "Join free":
    - /url: /join
  - group: Explore Docked
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
  109 |   ).toBeVisible();
  110 |   for (const route of [
  111 |     "/sports",
  112 |     "/sports/football",
  113 |     "/sports/nba",
  114 |     "/sports/nfl",
  115 |     "/leagues/nba",
  116 |   ]) {
  117 |     expect((await page.goto(route))?.status()).toBe(200);
  118 |     await expect(page.locator("h1")).toHaveCount(1);
  119 |   }
  120 |   expect((await request.get("/sports/nonexistent")).status()).toBe(404);
  121 |   expect((await request.get("/leagues/nonexistent")).status()).toBe(404);
  122 |   const image = await request.get("/opengraph-image");
  123 |   expect(image.status()).toBe(200);
  124 |   expect(image.headers()["content-type"]).toContain("image/png");
  125 | });
  126 | test("preview public pages remain truthful, accessible and usable without an account", async ({
  127 |   page,
  128 |   request,
  129 | }) => {
  130 |   const errors: string[] = [];
  131 |   page.on("pageerror", (error) => errors.push(error.message));
  132 |   await page.setViewportSize({ width: 390, height: 900 });
  133 |   for (const [name, route] of Object.entries({
  134 |     homepage: "/",
  135 |     edges: "/edges",
  136 |     results: "/results",
  137 |     methodology: "/methodology",
  138 |     article: "/learn/minimum-odds",
  139 |     signup: "/join",
  140 |     "member-dashboard-locked": "/dashboard",
  141 |     "admin-dashboard-locked": "/admin",
  142 |     "data-health-locked": "/admin/data-health",
  143 |     "model-performance-locked": "/admin/model-performance",
  144 |     "forward-paper-locked": "/admin/forward-paper",
  145 |   })) {
  146 |     expect((await page.goto(route))?.status(), route).toBe(200);
  147 |     await expect(page.locator("h1")).toHaveCount(1);
  148 |     if (route === "/results") {
  149 |       const tableRegion = page.getByRole("region", {
  150 |         name: "Complete official publication ledger",
  151 |       });
  152 |       await tableRegion.focus();
  153 |       await expect(tableRegion).toBeFocused();
  154 |       await page.keyboard.press("ArrowRight");
  155 |       await expect
  156 |         .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
  157 |         .toBeGreaterThan(0);
  158 |     }
  159 |     expect(
  160 |       await page.evaluate(
  161 |         () => document.documentElement.scrollWidth <= innerWidth,
  162 |       ),
  163 |       route,
  164 |     ).toBe(true);
  165 |     expect(
  166 |       (
  167 |         await new AxeBuilder({ page })
  168 |           .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  169 |           .analyze()
  170 |       ).violations,
  171 |       route,
  172 |     ).toEqual([]);
  173 |     await page.screenshot({
  174 |       path: `${evidenceRoot}/web-regression/sports-regression/regression-${name}-390.png`,
  175 |       fullPage: true,
  176 |     });
  177 |   }
  178 |   await page.goto("/join");
  179 |   for (const input of await page.locator("input[type=checkbox]").all())
  180 |     await expect(input).not.toBeChecked();
  181 |   await expect(
  182 |     page.getByRole("checkbox", { name: /optional usage analytics/ }),
  183 |   ).not.toBeChecked();
  184 |   for (const article of articles) {
  185 |     await page.goto(`/learn/${article.slug}`);
  186 |     await expect(
  187 |       page.getByRole("heading", { name: article.title, exact: true }),
  188 |     ).toBeVisible();
  189 |     await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
  190 |       "content",
  191 |       /noindex/,
  192 |     );
  193 |   }
  194 |   const response = await request.get("/api/edges");
  195 |   expect(response.status()).toBe(200);
  196 |   expect((await response.json()).tips).toEqual([]);
  197 |   const health = await (await request.get("/api/status")).json();
  198 |   expect(health.oddsProviderStatus).toBe("NOT_CONFIGURED");
  199 |   expect(health.resultsProviderStatus).toBe("NOT_CONFIGURED");
  200 |   expect(health.feed).toBe(false);
  201 |   await page.goto("/results");
  202 |   await expect(
  203 |     page.getByText(
  204 |       "No accessible genuine official publications. Unavailable records are not zero performance.",
  205 |     ),
  206 |   ).toBeVisible();
  207 |   await expect(
  208 |     page.getByText("Settled publications").locator("..").locator("strong"),
> 209 |   ).toHaveText("N/A");
      |     ^ Error: expect(locator).toHaveText(expected) failed
  210 |   const exported = await request.get("/api/member");
  211 |   expect(exported.status()).toBe(401);
  212 |   const deleted = await request.post("/api/member", {
  213 |     headers: { Origin: "http://localhost:3000" },
  214 |     data: { action: "delete", confirm: "DELETE" },
  215 |   });
  216 |   expect(deleted.status()).toBe(403);
  217 |   expect(errors).toEqual([]);
  218 | });
  219 | 
```