import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Isolated rendering fixture: no application route, Auth session or data record.
const instant = "2026-10-03T23:30:00.123Z";
let bundle = "";
let html = "";
test.beforeAll(async () => {
  // Use real Node SSR outside Playwright's JSX fixture transform.
  html = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `
    const { createElement } = require('react');
    const { renderToString } = require('react-dom/server');
    const { LocalTimestamp } = require('./src/components/local-timestamp.tsx');
    process.stdout.write(renderToString(createElement(LocalTimestamp, { value: ${JSON.stringify(instant)} })));
  `,
    ],
    { encoding: "utf8", env: { ...process.env, TZ: "UTC" } },
  );
  const result = await build({
    stdin: {
      contents: `import { createElement } from 'react';
        import { hydrateRoot } from 'react-dom/client';
        import { LocalTimestamp } from './src/components/local-timestamp';
        window.hydrationErrors = [];
        hydrateRoot(document.getElementById('timestamp-root'), createElement(LocalTimestamp, {value: ${JSON.stringify(instant)}}), {
          onRecoverableError(error) { window.hydrationErrors.push(error.message); }
        });`,
      resolveDir: process.cwd(),
      sourcefile: "isolated-timestamp-hydration.tsx",
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-node-read-fixture",
        setup(b) {
          // Same Node-read isolation used by the existing Windows UI fixtures.
          b.onResolve({ filter: /.*/ }, (args) => {
            const target = args.path.startsWith(".")
              ? path.resolve(args.resolveDir || process.cwd(), args.path)
              : createRequire(
                  path.isAbsolute(args.importer)
                    ? args.importer
                    : path.resolve("package.json"),
                ).resolve(args.path);
            const file = [
              target,
              target + ".tsx",
              target + ".ts",
              target + ".js",
            ].find(existsSync);
            if (!file)
              throw new Error("Timestamp fixture module is unavailable.");
            return { path: file, namespace: "timestamp-fixture" };
          });
          b.onLoad(
            { filter: /.*/, namespace: "timestamp-fixture" },
            (args) => ({
              contents: readFileSync(args.path, "utf8"),
              loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : args.path.endsWith(".json") ? "json" : "js",
              resolveDir: path.dirname(args.path),
            }),
          );
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
});

for (const [locale, timezoneId] of [
  ["en-AU", "Australia/Sydney"],
  ["en-US", "America/New_York"],
] as const) {
  test(`UTC server markup hydrates safely into ${timezoneId} local time`, async ({
    browser,
  }) => {
    expect(html).toContain("2026-10-03 23:30:00 UTC");
    const context = await browser.newContext({ locale, timezoneId });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent(`<main id="timestamp-root">${html}</main>`);
      const expected = await page.evaluate(
        (value) =>
          new Date(value).toLocaleString(undefined, { timeZoneName: "short" }),
        instant,
      );
      expect(expected).not.toBe("2026-10-03 23:30:00 UTC");
      await page.addScriptTag({ content: bundle });
      await expect(page.locator("time")).toHaveText(expected);
      await expect(page.locator("time")).toHaveAttribute("datetime", instant);
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { hydrationErrors: string[] })
              .hydrationErrors,
        ),
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
