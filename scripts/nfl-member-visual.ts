import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { FantasyScreen } from "../src/components/fantasy-screen";
import type { FantasyState } from "../src/core/fantasy";
async function main() {
  const state: FantasyState = JSON.parse(
    await readFile("private-data/nfl-worker/owner-state.json", "utf8"),
  );
  const css = (
    await Promise.all(
      ["brand-theme", "globals", "fantasy", "fantasy-play", "scoring"].map(
        async (f) => {
          try {
            return await readFile(`src/app/${f}.css`, "utf8");
          } catch {
            return "";
          }
        },
      ),
    )
  ).join("\n");
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of [360, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const tab of ["play", "cards", "market", "profile"]) {
        await page.setContent(
          `<!doctype html><html lang="en"><head><title>Docked NFL acceptance</title><style>${css}</style></head><body class="fantasy-mode"><main>${renderToStaticMarkup(React.createElement(FantasyScreen, { tab, initial: state }))}</main></body></html>`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        checks.push({
          width,
          tab,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
        await page.screenshot({
          path: `docs/qa/nfl-member/${tab}-${width}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(
    "docs/qa/nfl-member/visual.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Local production-component rendering of actual owner hosted state; not authenticated browser or physical device acceptance",
        checks,
      },
      null,
      2,
    ),
  );
  assert.ok(checks.every((c) => !c.violations.length));
  console.log(
    "Eight NFL viewport/screen renders, no overflow, axe or page errors",
  );
}
void main();
