# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: official-record.test.ts >> DEMO official forward record preserves complete outcomes and unknown states at 360px
- Location: tests\browser\official-record.test.ts:9:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "DEMO ONLY · Docked Record" [level=1] [ref=e3]
  - paragraph [ref=e4]: Fictional presentation fixture, never app data.
  - region "Docked official forward record" [ref=e5]:
    - paragraph [ref=e6]: Docked’s official record begins with its first genuine forward-published Edge. We do not reconstruct historical tips.
    - generic [ref=e7]: GENUINE FORWARD PUBLICATIONS · FIXED ONE-UNIT BENCHMARK
    - paragraph [ref=e8]:
      - text: Since
      - time [ref=e9]: 2026-10-01 01:00:00 UTC
      - text: . This is the global first-publication boundary, not the first row visible in your region.
    - generic [ref=e10]:
      - generic [ref=e11]:
        - paragraph [ref=e12]: Published
        - strong [ref=e13]: "5"
      - generic [ref=e14]:
        - paragraph [ref=e15]: Settled
        - strong [ref=e16]: "3"
      - generic [ref=e17]:
        - paragraph [ref=e18]: Wins
        - strong [ref=e19]: "1"
      - generic [ref=e20]:
        - paragraph [ref=e21]: Losses
        - strong [ref=e22]: "1"
      - generic [ref=e23]:
        - paragraph [ref=e24]: Voids
        - strong [ref=e25]: "1"
      - generic [ref=e26]:
        - paragraph [ref=e27]: Pending
        - strong [ref=e28]: "1"
      - generic [ref=e29]:
        - paragraph [ref=e30]: Net Units
        - strong [ref=e31]: 0.00 u
      - generic [ref=e32]:
        - paragraph [ref=e33]: ROI
        - strong [ref=e34]: 0.00%
      - generic [ref=e35]:
        - paragraph [ref=e36]: Avg Published Odds
        - strong [ref=e37]: "2.000"
      - generic [ref=e38]:
        - paragraph [ref=e39]: Avg Estimated Edge
        - strong [ref=e40]: 5.00%
      - generic [ref=e41]:
        - paragraph [ref=e42]: Max Drawdown
        - strong [ref=e43]: 1.00 u
      - generic [ref=e44]:
        - paragraph [ref=e45]: Longest Losing Run
        - strong [ref=e46]: "1"
    - complementary [ref=e47]: All accessible genuine official publications are included, with losses, voids and corrections. Research, forward paper, demonstrations and reconstructed history are excluded. Estimates can be wrong; this record does not promise future profit. 1 disputed record(s) remain listed while settlement is unresolved.
    - figure "Cumulative net units · complete filtered settled record" [ref=e48]:
      - img "Cumulative units from zero to 0. Minimum 0; maximum 1." [ref=e50]:
        - generic [ref=e52]: "1.00"
        - generic [ref=e53]: "0.00"
    - heading "Every official publication" [level=2] [ref=e54]
    - region "Complete official publication ledger" [active] [ref=e55]:
      - table [ref=e56]:
        - caption [ref=e57]: One unit at the locked publication odds. Current prices never rewrite the benchmark.
        - rowgroup [ref=e58]:
          - row [ref=e59]:
            - columnheader "Publication / event" [ref=e60]
            - columnheader "Selection" [ref=e61]
            - columnheader "Model version" [ref=e62]
            - columnheader "Published odds" [ref=e63]
            - columnheader "Estimated edge" [ref=e64]
            - columnheader "Result" [ref=e65]
            - columnheader "Net units" [ref=e66]
            - columnheader "Corrections" [ref=e67]
        - rowgroup [ref=e68]:
          - row [ref=e69]:
            - cell [ref=e70]:
              - link "DEMO fictional home versus fictional away — long event display name" [ref=e71] [cursor=pointer]:
                - /url: /tips/test-only-0
              - time [ref=e72]: 2026-10-01 01:00:00 UTC
            - cell "DEMO selection 0" [ref=e73]
            - cell "DEMO-football-v1" [ref=e74]
            - cell "2.00" [ref=e75]
            - cell "5.00%" [ref=e76]
            - cell "WON" [ref=e77]
            - cell "1" [ref=e78]
            - cell "0" [ref=e79]
          - row [ref=e80]:
            - cell [ref=e81]:
              - link "DEMO fictional home versus fictional away — long event display name" [ref=e82] [cursor=pointer]:
                - /url: /tips/test-only-1
              - time [ref=e83]: 2026-10-02 01:00:00 UTC
            - cell "DEMO selection 1" [ref=e84]
            - cell "DEMO-football-v1" [ref=e85]
            - cell "2.00" [ref=e86]
            - cell "5.00%" [ref=e87]
            - cell "LOST" [ref=e88]
            - cell "-1" [ref=e89]
            - cell "1" [ref=e90]
          - row [ref=e91]:
            - cell [ref=e92]:
              - link "DEMO fictional home versus fictional away — long event display name" [ref=e93] [cursor=pointer]:
                - /url: /tips/test-only-2
              - time [ref=e94]: 2026-10-03 01:00:00 UTC
            - cell "DEMO selection 2" [ref=e95]
            - cell "DEMO-football-v1" [ref=e96]
            - cell "2.00" [ref=e97]
            - cell "5.00%" [ref=e98]
            - cell "VOID" [ref=e99]
            - cell "0" [ref=e100]
            - cell "0" [ref=e101]
          - row [ref=e102]:
            - cell [ref=e103]:
              - link "DEMO fictional home versus fictional away — long event display name" [ref=e104] [cursor=pointer]:
                - /url: /tips/test-only-3
              - time [ref=e105]: 2026-10-04 01:00:00 UTC
            - cell "DEMO selection 3" [ref=e106]
            - cell "DEMO-football-v1" [ref=e107]
            - cell "2.00" [ref=e108]
            - cell "5.00%" [ref=e109]
            - cell "PENDING" [ref=e110]
            - cell "Unavailable" [ref=e111]
            - cell "0" [ref=e112]
          - row [ref=e113]:
            - cell [ref=e114]:
              - link "DEMO fictional home versus fictional away — long event display name" [ref=e115] [cursor=pointer]:
                - /url: /tips/test-only-4
              - time [ref=e116]: 2026-10-05 01:00:00 UTC
            - cell "DEMO selection 4" [ref=e117]
            - cell "DEMO-football-v1" [ref=e118]
            - cell "2.00" [ref=e119]
            - cell "5.00%" [ref=e120]
            - cell "DISPUTED" [ref=e121]
            - cell "Unavailable" [ref=e122]
            - cell "0" [ref=e123]
    - paragraph [ref=e124]: ROI is net units divided by settled non-void one-unit stakes. Pending and disputed entries have no assumed return. Voids return the unit and do not enter the ROI denominator. Published-odds and estimated-edge averages include pending and void publications; missing observations make that average unavailable. Drawdown and losing runs use settlement order, including corrected outcomes.
    - generic [ref=e125]:
      - heading "Performance over time" [level=2] [ref=e126]
      - region "Official monthly results" [ref=e127]:
        - table [ref=e128]:
          - rowgroup [ref=e129]:
            - row [ref=e130]:
              - columnheader "Settlement month (UTC)" [ref=e131]
              - columnheader "Net units" [ref=e132]
          - rowgroup [ref=e133]:
            - row [ref=e134]:
              - cell "2026-10" [ref=e135]
              - cell "0.00" [ref=e136]
      - link "Methodology and model changes" [ref=e137] [cursor=pointer]:
        - /url: /methodology
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import { execFileSync } from "node:child_process";
  4  | import { mkdir } from "node:fs/promises";
  5  | import path from "node:path";
  6  | import { evidenceRoot } from "./evidence";
  7  | 
  8  | for (const width of [360, 1366])
  9  |   test(`DEMO official forward record preserves complete outcomes and unknown states at ${width}px`, async ({
  10 |     page,
  11 |   }) => {
  12 |     const fixtures: Record<string, string> = JSON.parse(
  13 |       execFileSync(
  14 |         process.execPath,
  15 |         ["--import", "tsx", "tests/fixtures/render-official-record.ts"],
  16 |         { encoding: "utf8" },
  17 |       ),
  18 |     );
  19 |     await mkdir(path.join(evidenceRoot, "official-record"), {
  20 |       recursive: true,
  21 |     });
  22 |     await page.setViewportSize({ width, height: 844 });
  23 |     const errors: string[] = [];
  24 |     page.on("pageerror", (error) => errors.push(error.message));
  25 |     page.on("console", (message) => {
  26 |       if (message.type() === "error") errors.push(message.text());
  27 |     });
  28 |     await page.route("**/api/**", (route) => route.abort());
  29 |     for (const state of ["empty", "restricted", "populated"]) {
  30 |       await page.setContent(
  31 |         `<!doctype html><html lang="en"><head><title>DEMO record presentation</title></head><body><main class="page"><h1>DEMO ONLY · Docked Record</h1><p>Fictional presentation fixture, never app data.</p>${fixtures[state]}</main></body></html>`,
  32 |       );
  33 |       for (const file of [
  34 |         "brand-theme.css",
  35 |         "globals.css",
  36 |         "sports-visuals.css",
  37 |         "sports-experience.css",
  38 |       ])
  39 |         await page.addStyleTag({ path: path.resolve("src/app", file) });
  40 |       if (state === "empty") {
  41 |         await expect(
  42 |           page.getByText("The record has not started yet.", { exact: true }),
  43 |         ).toHaveCount(2);
  44 |         await expect(page.locator("time")).toHaveCount(0);
  45 |       } else if (state === "restricted") {
  46 |         await expect(
  47 |           page.getByText("The record has not started yet.", { exact: true }),
  48 |         ).toHaveCount(0);
  49 |         await expect(page.locator(".metric strong")).toHaveText(
  50 |           Array(12).fill("Unavailable"),
  51 |         );
  52 |       } else {
  53 |         await expect(page.locator('a[href^="/tips/test-only-"]')).toHaveCount(
  54 |           5,
  55 |         );
  56 |         await expect(
  57 |           page.getByRole("cell", { name: "LOST", exact: true }),
  58 |         ).toBeVisible();
  59 |         await expect(
  60 |           page.getByRole("cell", { name: "DISPUTED", exact: true }),
  61 |         ).toBeVisible();
  62 |         const ledger = page.getByRole("region", {
  63 |           name: "Complete official publication ledger",
  64 |         });
  65 |         await ledger.focus();
  66 |         await expect(ledger).toBeFocused();
  67 |         if (width === 360) {
  68 |           await page.keyboard.press("End");
  69 |           await expect
  70 |             .poll(() => ledger.evaluate((el) => el.scrollLeft))
> 71 |             .toBeGreaterThan(0);
     |              ^ Error: expect(received).toBeGreaterThan(expected)
  72 |         }
  73 |       }
  74 |       expect(
  75 |         await page.evaluate(
  76 |           () => document.documentElement.scrollWidth <= innerWidth + 1,
  77 |         ),
  78 |       ).toBe(true);
  79 |       expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  80 |       await page.screenshot({
  81 |         path: path.join(
  82 |           evidenceRoot,
  83 |           "official-record",
  84 |           `DEMO-${state}-${width}.png`,
  85 |         ),
  86 |         fullPage: true,
  87 |       });
  88 |     }
  89 |     expect(errors).toEqual([]);
  90 |   });
  91 | 
```