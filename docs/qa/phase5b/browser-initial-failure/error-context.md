# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: experience.test.ts >> preview public pages remain truthful, accessible and usable without an account
- Location: tests\browser\experience.test.ts:126:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.focus: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: 'Live publication ledger table, scroll horizontally if needed' })

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - link "Skip to content" [ref=f2e2] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=f2e3]:
    - generic [ref=f2e4]: BUILT FOR AN EDGE
    - generic [ref=f2e5]: 18+ · Research preview
  - banner [ref=f2e6]:
    - generic [ref=f2e7]:
      - link "Docked home" [ref=f2e8] [cursor=pointer]:
        - /url: /
        - generic [aria-hidden] [ref=f2e10]: DOCKED
      - generic [ref=f2e11]:
        - link "Sign in" [ref=f2e12] [cursor=pointer]:
          - /url: /login
        - link "Join free" [ref=f2e13] [cursor=pointer]:
          - /url: /join
          - text: Join free
          - generic [aria-hidden] [ref=f2e14]: ↗
    - group [ref=f2e15]:
      - generic "Explore Docked" [ref=f2e16] [cursor=pointer]
  - generic [ref=f2e17]: PREVIEW · Model research in progress · Live tips and outbound alerts are off
  - main [ref=f2e18]:
    - generic [ref=f2e19]:
      - generic [ref=f2e21]:
        - paragraph [ref=f2e22]: DOCKED / RESULTS
        - heading "DOCKED RECORD" [level=1] [ref=f2e23]
      - region "Docked official forward record" [ref=f2e25]:
        - paragraph [ref=f2e26]: Docked’s official record begins with its first genuine forward-published Edge. We do not reconstruct historical tips.
        - generic [ref=f2e27]: GENUINE FORWARD PUBLICATIONS · FIXED ONE-UNIT BENCHMARK
        - complementary [ref=f2e28]: The official record is currently unavailable. Its start date and performance cannot be inferred from an inaccessible record.
        - generic [ref=f2e29]:
          - generic [ref=f2e30]:
            - text: From publication date
            - textbox "From publication date" [ref=f2e31]
          - generic [ref=f2e32]:
            - text: To publication date
            - textbox "To publication date" [ref=f2e33]
          - generic [ref=f2e34]:
            - text: Competition
            - combobox "Competition" [ref=f2e35]:
              - option "All competitions" [selected]
          - generic [ref=f2e36]:
            - text: Model version
            - combobox "Model version" [ref=f2e37]:
              - option "All model versions" [selected]
          - button "Apply filters" [ref=f2e38] [cursor=pointer]
          - link "Complete all-time record" [ref=f2e39] [cursor=pointer]:
            - /url: /results
        - generic [ref=f2e40]:
          - generic [ref=f2e41]:
            - paragraph [ref=f2e42]: Published
            - strong [ref=f2e43]: Unavailable
          - generic [ref=f2e44]:
            - paragraph [ref=f2e45]: Settled
            - strong [ref=f2e46]: Unavailable
          - generic [ref=f2e47]:
            - paragraph [ref=f2e48]: Wins
            - strong [ref=f2e49]: Unavailable
          - generic [ref=f2e50]:
            - paragraph [ref=f2e51]: Losses
            - strong [ref=f2e52]: Unavailable
          - generic [ref=f2e53]:
            - paragraph [ref=f2e54]: Voids
            - strong [ref=f2e55]: Unavailable
          - generic [ref=f2e56]:
            - paragraph [ref=f2e57]: Pending
            - strong [ref=f2e58]: Unavailable
          - generic [ref=f2e59]:
            - paragraph [ref=f2e60]: Net Units
            - strong [ref=f2e61]: Unavailable
          - generic [ref=f2e62]:
            - paragraph [ref=f2e63]: ROI
            - strong [ref=f2e64]: Unavailable
          - generic [ref=f2e65]:
            - paragraph [ref=f2e66]: Avg Published Odds
            - strong [ref=f2e67]: Unavailable
          - generic [ref=f2e68]:
            - paragraph [ref=f2e69]: Avg Estimated Edge
            - strong [ref=f2e70]: Unavailable
          - generic [ref=f2e71]:
            - paragraph [ref=f2e72]: Max Drawdown
            - strong [ref=f2e73]: Unavailable
          - generic [ref=f2e74]:
            - paragraph [ref=f2e75]: Longest Losing Run
            - strong [ref=f2e76]: Unavailable
        - complementary [ref=f2e77]: All accessible genuine official publications are included, with losses, voids and corrections. Research, forward paper, demonstrations and reconstructed history are excluded. Estimates can be wrong; this record does not promise future profit.
        - generic [ref=f2e78]: Cumulative units will appear when a settled live record exists.
        - heading "Every official publication" [level=2] [ref=f2e79]
        - region "Complete official publication ledger" [ref=f2e80]:
          - table [ref=f2e81]:
            - caption [ref=f2e82]: One unit at the locked publication odds. Current prices never rewrite the benchmark.
            - rowgroup [ref=f2e83]:
              - row [ref=f2e84]:
                - columnheader "Publication / event" [ref=f2e85]
                - columnheader "Selection" [ref=f2e86]
                - columnheader "Model version" [ref=f2e87]
                - columnheader "Published odds" [ref=f2e88]
                - columnheader "Estimated edge" [ref=f2e89]
                - columnheader "Result" [ref=f2e90]
                - columnheader "Net units" [ref=f2e91]
                - columnheader "Corrections" [ref=f2e92]
            - rowgroup [ref=f2e93]:
              - row [ref=f2e94]:
                - cell "No accessible genuine official publications. Unavailable records are not zero performance." [ref=f2e95]
        - paragraph [ref=f2e96]: ROI is net units divided by settled non-void one-unit stakes. Pending and disputed entries have no assumed return. Voids return the unit and do not enter the ROI denominator. Published-odds and estimated-edge averages include pending and void publications; missing observations make that average unavailable. Drawdown and losing runs use settlement order, including corrected outcomes.
        - generic [ref=f2e97]:
          - heading "Performance over time" [level=2] [ref=f2e98]
          - paragraph [ref=f2e99]: Monthly performance will appear when genuine settlements are available. No historical results are filled in.
          - link "Methodology and model changes" [ref=f2e100] [cursor=pointer]:
            - /url: /methodology
  - contentinfo [ref=f2e101]:
    - generic [ref=f2e102]:
      - generic [ref=f2e103]:
        - link "Docked home" [ref=f2e104] [cursor=pointer]:
          - /url: /
          - generic [aria-hidden] [ref=f2e106]: DOCKED
        - paragraph [ref=f2e107]: BUILT FOR AN EDGE
        - paragraph [ref=f2e108]: Informational analysis. No wagering, wallets or guaranteed returns.
      - navigation "Research links" [ref=f2e109]:
        - link "Methodology" [ref=f2e110] [cursor=pointer]:
          - /url: /methodology
        - link "Sports and research scope" [ref=f2e111] [cursor=pointer]:
          - /url: /sports
        - link "Data status" [ref=f2e112] [cursor=pointer]:
          - /url: /data-status
        - link "About Docked" [ref=f2e113] [cursor=pointer]:
          - /url: /about
        - link "Contact" [ref=f2e114] [cursor=pointer]:
          - /url: /contact
      - navigation "Policy links" [ref=f2e115]:
        - link "Safer Gambling" [ref=f2e116] [cursor=pointer]:
          - /url: /safer-gambling
        - link "Terms" [ref=f2e117] [cursor=pointer]:
          - /url: /terms
        - link "Privacy" [ref=f2e118] [cursor=pointer]:
          - /url: /privacy
        - link "Legacy product support" [ref=f2e119] [cursor=pointer]:
          - /url: /legacy-support
    - generic [ref=f2e120]:
      - paragraph [ref=f2e121]: Gambling can cause harm. Never chase losses. You can use Docked without betting.
      - paragraph [ref=f2e122]: All core features free for 12 months from public launch. No card. No automatic conversion.
  - alert [ref=f2e123]
```

# Test source

```ts
  52  |     ).toEqual([]);
  53  |     await page.screenshot({
  54  |       path: `${evidenceRoot}/web-regression/sports-regression/regression-edge-${status}-320.png`,
  55  |       fullPage: true,
  56  |     });
  57  |   }
  58  |   const html = fixtures.no_edge;
  59  |   await page.setContent(
  60  |     `<!doctype html><html lang="en"><head><base href="http://localhost:3000"><title>Isolated no-edge fixture</title></head><body><main class="page"><h1>Fictional state review</h1>${html}</main></body></html>`,
  61  |   );
  62  |   await page.addStyleTag({
  63  |     path: path.join(process.cwd(), "src/app/brand-theme.css"),
  64  |   });
  65  |   await page.addStyleTag({
  66  |     path: path.join(process.cwd(), "src/app/globals.css"),
  67  |   });
  68  |   await page.addStyleTag({
  69  |     path: path.join(process.cwd(), "src/app/sports-visuals.css"),
  70  |   });
  71  |   await page.addStyleTag({
  72  |     path: path.join(process.cwd(), "src/app/sports-experience.css"),
  73  |   });
  74  |   await expect(
  75  |     page.getByRole("heading", { name: "No qualifying edge right now." }),
  76  |   ).toBeVisible();
  77  |   expect(
  78  |     (
  79  |       await new AxeBuilder({ page })
  80  |         .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  81  |         .analyze()
  82  |     ).violations,
  83  |   ).toEqual([]);
  84  |   await page.screenshot({
  85  |     path: `${evidenceRoot}/web-regression/sports-regression/regression-no-edge-isolated-fixture-320.png`,
  86  |     fullPage: true,
  87  |   });
  88  | });
  89  | test("article metadata, real PNG social card and allowlisted sports pages", async ({
  90  |   page,
  91  |   request,
  92  | }) => {
  93  |   await page.goto("/learn/minimum-odds");
  94  |   await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
  95  |     "href",
  96  |     /\/learn\/minimum-odds$/,
  97  |   );
  98  |   await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
  99  |     "content",
  100 |     /noindex/,
  101 |   );
  102 |   const data = JSON.parse(
  103 |     await page.locator('script[type="application/ld+json"]').innerText(),
  104 |   );
  105 |   expect(data["@type"]).toBe("WebPage");
  106 |   expect(data.datePublished).toBeUndefined();
  107 |   await expect(
  108 |     page.getByRole("heading", { name: "Corrections and review" }),
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
  150 |         name: "Live publication ledger table, scroll horizontally if needed",
  151 |       });
> 152 |       await tableRegion.focus();
      |                         ^ Error: locator.focus: Test timeout of 60000ms exceeded.
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
  209 |   ).toHaveText("N/A");
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