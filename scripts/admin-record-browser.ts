import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

async function main() {
  const out = "docs/qa/admin-record";
  mkdirSync(out, { recursive: true });
  const bundled = await build({
    entryPoints: ["tests/fixtures/admin-record-detail.tsx"],
    outfile: "fixture.js",
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      "next/link": resolve("tests/fixtures/community-framework-shim.tsx"),
      "next/navigation": resolve("tests/fixtures/community-framework-shim.tsx"),
      "@": resolve("src"),
    },
  });
  const js = bundled.outputFiles.find((f) => f.path.endsWith(".js"))!.text;
  const css =
    [
      ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
        /import "\.\/(.*?\.css)"/g,
      ),
    ]
      .map((m) => readFileSync("src/app/" + m[1], "utf8"))
      .join("\n") +
    (bundled.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "");
  const root = resolve("public");
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    if (url.pathname === "/fixture.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(js);
    } else if (url.pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else if (url.pathname.startsWith("/api/")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ results: [], categories: [], unread: 0 }));
    } else {
      const file = resolve(root, "." + url.pathname);
      if (
        file.startsWith(root + sep) &&
        existsSync(file) &&
        /\.(png|webp|svg|jpg)$/.test(file)
      ) {
        response.setHeader(
          "Content-Type",
          file.endsWith("svg")
            ? "image/svg+xml"
            : file.endsWith("webp")
              ? "image/webp"
              : file.endsWith("jpg")
                ? "image/jpeg"
                : "image/png",
        );
        response.end(readFileSync(file));
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked record review · isolated fixture</title><link rel="stylesheet" href="/style.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
        );
      }
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch().catch(async (error: unknown) => {
    await new Promise<void>((done) => server.close(() => done()));
    throw error;
  });
  const evidence: object[] = [];
  try {
    for (const width of [1440, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}/admin/workspace/users`);
      await expect(
        page.getByRole("heading", {
          name: "Isolated fixture member · long display name",
        }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width} overflow`,
      );
      const axe = await new AxeBuilder({ page }).analyze();
      writeFileSync(
        `${out}/axe-${width}.json`,
        JSON.stringify(axe.violations, null, 2),
      );
      await page.screenshot({
        path: `${out}/record-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(
        axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: `${out}/record-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "Next events" }).click();
      await expect(
        page.getByText("Moderation: restrict", { exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Previous events" }).click();
      await expect(
        page.getByText("Admission: accepted", { exact: true }),
      ).toBeVisible();
      assert.deepEqual(errors, []);
      evidence.push({
        width,
        overflow: false,
        seriousCriticalAxe: 0,
        historyNavigation: "passed",
        errors,
      });
      await context.close();
    }
    writeFileSync(
      `${out}/acceptance.json`,
      JSON.stringify(
        {
          scope:
            "Actual component, synthetic local data; not hosted authentication acceptance",
          evidence,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
