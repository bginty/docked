import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PostgameResults } from "../src/components/postgame-results";
import type { PostgameView } from "../src/server/postgame-results";
import assert from "node:assert/strict";
async function main() {
  const records: PostgameView[] = JSON.parse(
    await readFile("docs/qa/postgame/hosted-ingestion.json", "utf8"),
  ).readView;
  const css = (
    await Promise.all(
      ["brand-theme", "globals", "scoring"].map((f) =>
        readFile(`src/app/${f}.css`, "utf8"),
      ),
    )
  ).join("\n");
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const size of [
      { name: "s24", width: 360, height: 780 },
      { name: "desktop", width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const render = async (data: PostgameView[]) =>
        page.setContent(
          `<!doctype html><html lang="en"><head><title>Docked post-game acceptance</title><style>${css}</style></head><body><main>${renderToStaticMarkup(React.createElement(PostgameResults, { records: data }))}</main></body></html>`,
        );
      await render(records);
      await page.getByText(/Aaron Rodgers · QB/).click();
      assert.equal(await page.locator("details[open]").count(), 1);
      assert.ok(await page.getByText("71.24", { exact: false }).count());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      let a = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(a.violations, []);
      await page.screenshot({
        path: `docs/qa/postgame/${size.name}-postgame.png`,
        fullPage: true,
      });
      await render([]);
      assert.ok(
        await page.getByRole("heading", { name: "Awaiting results" }).count(),
      );
      a = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(a.violations, []);
      assert.deepEqual(errors, []);
      checks.push({
        viewport: size.name,
        pass: true,
        checks: [
          "hosted read-model rendered by production component",
          "player details expandable",
          "no horizontal overflow",
          "empty state",
          "axe zero violations",
          "no page exceptions",
        ],
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const report = {
    at: new Date().toISOString(),
    scope:
      "Local browser component rendering of actual hosted read model; NOT authenticated hosted browser or physical S24 acceptance",
    checks,
  };
  await mkdir("docs/qa/postgame", { recursive: true });
  await writeFile(
    "docs/qa/postgame/visual.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
