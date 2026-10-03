import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import sharp from "sharp";

const evidence = path.resolve(
  process.env.DOCKED_QA_ROOT
    ? path.join(process.env.DOCKED_QA_ROOT, "brand-browser")
    : "docs/qa/edge-signal-brand/browser",
);
const sources = JSON.parse(
  readFileSync("docs/qa/edge-signal-brand/approved-source-assets.json", "utf8"),
) as {
  assets: Record<string, { sha256: string; bytes: number }>;
};
const routes = {
  homepage: "/",
  home: "/home",
  login: "/login",
  join: "/join",
  dashboard: "/dashboard",
  edges: "/edges",
  results: "/results",
  community: "/community",
  compose: "/compose",
  profile: "/profile",
  notifications: "/notifications",
  article: "/learn/value-versus-winners",
};
const matrix = [
  ...[320, 390, 768, 1440].map((width) => ({
    width,
    scheme: "light" as const,
  })),
  ...[390, 1440].map((width) => ({ width, scheme: "dark" as const })),
];
const checkedAssets = new Set<string>();
let demoBundle = "",
  officialFixtureHtml = "";

test.beforeAll(async ({}, info) => {
  const origin = new URL(
    String(info.project.use.baseURL ?? "http://localhost:3000"),
  );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    throw Error(
      "Brand UI fixture QA is restricted to a local preview; no hosted account is used.",
    );
  await mkdir(evidence, { recursive: true });
  officialFixtureHtml = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-experience.ts"],
      { encoding: "utf8" },
    ),
  ).active;
  const bundled = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [path.resolve("tests/fixtures/community-demo.tsx")],
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "brand-isolated-ui-fixture",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            let target: string;
            if (/^next\/(navigation|link)$/.test(args.path))
              target = path.resolve(
                "tests/fixtures/community-framework-shim.tsx",
              );
            else if (args.path.startsWith("@/"))
              target = path.resolve("src", args.path.slice(2));
            else if (path.isAbsolute(args.path)) target = args.path;
            else if (args.path.startsWith("."))
              target = path.resolve(path.dirname(args.importer), args.path);
            else
              target = createRequire(
                args.importer || path.resolve("package.json"),
              ).resolve(args.path);
            const file = [
              target,
              target + ".tsx",
              target + ".ts",
              target + ".js",
              path.join(target, "index.js"),
            ].find(existsSync);
            if (!file)
              throw Error(`Unresolved isolated fixture import: ${args.path}`);
            return { path: file, namespace: "fixture-source" };
          });
          b.onLoad({ filter: /.*/, namespace: "fixture-source" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".json")
                  ? "json"
                  : "jsx",
          }));
        },
      },
    ],
  });
  demoBundle = bundled.outputFiles[0].text;
});

function monitor(page: Page) {
  const errors: string[] = [],
    failedAssets: string[] = [],
    fontRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      response.status() >= 400 &&
      (/\.(png|ico|svg|woff2?|webp)$/.test(url.pathname) ||
        url.pathname.startsWith("/brand/"))
    )
      failedAssets.push(`${response.status()} ${url.pathname}`);
  });
  page.on("request", (request) => {
    if (
      /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(
        request.url(),
      )
    )
      fontRequests.push(new URL(request.url()).hostname);
  });
  return { errors, failedAssets, fontRequests };
}

async function suppliedAsset(page: Page, url: string) {
  const file = new URL(url, page.url()).pathname;
  const original =
    file === "/brand/canonical/docked-master.png"
      ? "/brand/icons/docked-app-icon-1024.png"
      : file === "/favicon.ico"
      ? "/brand/icons/docked-app-icon-32.png"
      : file === "/icons/docked-192.png"
        ? "/brand/icons/docked-app-icon-192.png"
        : file === "/icons/docked-512.png"
          ? "/brand/icons/docked-app-icon-512.png"
          : file;
  const approved = sources.assets[original];
  expect(
    approved,
    `Asset ${file} must be the supplied approved raster artwork`,
  ).toBeTruthy();
  if (checkedAssets.has(file)) return;
  const response = await page.request.get(file);
  expect(response.status(), file).toBe(200);
  const bytes = await response.body();
  if (file === "/favicon.ico") {
    expect(bytes.readUInt16LE(2)).toBe(1);
    expect(bytes.readUInt16LE(4)).toBe(1);
    expect([bytes[6], bytes[7]]).toEqual([32, 32]);
    const offset = bytes.readUInt32LE(18), length = bytes.readUInt32LE(14);
    expect(offset).toBe(22);
    expect(bytes.length).toBe(offset + length);
    expect(length).toBe(approved.bytes);
    expect(createHash("sha256").update(bytes.subarray(offset)).digest("hex")).toBe(approved.sha256);
    checkedAssets.add(file);
    return;
  }
  expect(bytes.length, `${file} bytes`).toBe(approved.bytes);
  expect(
    createHash("sha256").update(bytes).digest("hex"),
    `${file} supplied-image identity`,
  ).toBe(approved.sha256);
  checkedAssets.add(file);
}

async function brandIdentity(page: Page) {
  const logos = page.locator(".brand-logo:visible > img");
  expect(
    await logos.count(),
    "At least one supplied brand asset must be visible",
  ).toBeGreaterThan(0);
  const samples = [];
  for (const logo of await logos.all()) {
    // Full-page evidence includes off-screen lazy logos. Explicitly request
    // their bytes before decode instead of waiting on viewport intersection.
    await logo.evaluate((image: HTMLImageElement) => { image.loading = "eager"; });
    await expect(logo).toHaveJSProperty("complete", true);
    await logo.evaluate((image: HTMLImageElement) => image.decode());
    const item = await logo.evaluate((image: HTMLImageElement) => {
      const style = getComputedStyle(image),
        box = image.getBoundingClientRect();
      return {
        src: image.currentSrc || image.src,
        width: box.width,
        height: box.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        objectFit: style.objectFit,
        transform: style.transform,
        filter: style.filter,
        shadow: style.boxShadow,
      };
    });
    expect(item.naturalWidth).toBeGreaterThan(0);
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
    if (item.objectFit !== "contain")
      expect(
        Math.abs(
          item.width / item.height - item.naturalWidth / item.naturalHeight,
        ),
      ).toBeLessThan(0.03);
    expect(item.transform).toBe("none");
    expect(item.filter).toBe("none");
    expect(item.shadow).toBe("none");
    await suppliedAsset(page, item.src);
    samples.push({ ...item, src: new URL(item.src).pathname });
  }
  expect(
    await page.locator(".brand-symbol").count(),
    "Old CSS/text D must not remain",
  ).toBe(0);
  return samples;
}

async function checks(page: Page, log: ReturnType<typeof monitor>) {
  await page.evaluate(() => document.fonts.ready);
  const font = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: [...document.fonts].some(
      (face) =>
        face.family.replaceAll('"', "") === "Sora" && face.status === "loaded",
    ),
  }));
  expect(font.family).toContain("Sora");
  expect(font.loaded, "Sora must actually be loaded before measurements").toBe(
    true,
  );
  const brand = await brandIdentity(page);
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const bytes = context.getImageData(0, 0, 1, 1).data;
      return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255];
    };
    const luminance = (color: number[]) =>
      color
        .slice(0, 3)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce(
          (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const over = (foreground: number[], background: number[]) =>
      foreground
        .slice(0, 3)
        .map((v, i) => v * foreground[3] + background[i] * (1 - foreground[3]))
        .concat(1);
    return [
      ...document.querySelectorAll<HTMLElement>(
        ".button, .topline, .app-preview-label",
      ),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          !element.matches(":disabled,[aria-disabled=true]")
        );
      })
      .map((element) => {
        const chain: HTMLElement[] = [];
        let ancestor: HTMLElement | null = element;
        while (ancestor) {
          chain.unshift(ancestor);
          ancestor = ancestor.parentElement;
        }
        // Images and gradients need pixel-aware/manual evaluation; Axe still checks them.
        if (
          chain.some(
            (node) =>
              getComputedStyle(node).backgroundImage !== "none" ||
              Number(getComputedStyle(node).opacity) < 1,
          )
        )
          return {
            selector: element.className,
            checked: false,
            reason:
              "image/gradient/opacity surface; covered by Axe and screenshot",
          };
        let background = [1, 1, 1, 1];
        for (const node of chain)
          background = over(
            rgba(getComputedStyle(node).backgroundColor),
            background,
          );
        const style = getComputedStyle(element),
          foreground = over(rgba(style.color), background);
        const a = luminance(foreground),
          b = luminance(background);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const large =
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.66 &&
            Number(style.fontWeight) >= 700);
        return {
          selector: element.className,
          checked: true,
          ratio,
          minimum: large ? 3 : 4.5,
          foreground: style.color,
          background,
        };
      });
  });
  for (const sample of contrast)
    if (sample.checked)
      expect(sample.ratio, sample.selector).toBeGreaterThanOrEqual(
        sample.minimum!,
      );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  expect(overflow, "Page must not horizontally overflow").toBe(false);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(log.errors).toEqual([]);
  expect(log.failedAssets).toEqual([]);
  expect(log.fontRequests, "Brand fonts must be self-hosted").toEqual([]);
  return {
    brand,
    font,
    contrast,
    overflow,
    accessibilityViolations: axe.violations.length,
    ...log,
  };
}

for (const { width, scheme } of matrix) {
  test(`Edge Signal public routes at ${width}px / ${scheme} OS preference`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const log = monitor(page),
      receipts = [];
    for (const [name, route] of Object.entries(routes)) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      const result = await checks(page, log);
      await page.screenshot({
        path: path.join(evidence, `${name}-${width}-${scheme}.png`),
        fullPage: true,
      });
      if (name === "homepage" && [320, 390, 1440].includes(width))
        await page.screenshot({
          path: path.join(evidence, `${name}-${width}-${scheme}-viewport.png`),
        });
      receipts.push({
        route,
        renderedPath: new URL(page.url()).pathname,
        ...result,
      });
    }
    await writeFile(
      path.join(evidence, `public-${width}-${scheme}.json`),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
          width,
          osPreference: scheme,
          account: "anonymous; no test account used",
          fixtures: false,
          routes: receipts,
        },
        null,
        2,
      ) + "\n",
    );
  });

  test(`Edge Signal isolated member UI at ${width}px / ${scheme} OS preference`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const log = monitor(page);
    // No real Auth/API operation is permitted from this labelled fixture page.
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() === "GET" &&
        url.pathname === "/api/community-edges" &&
        url.searchParams.get("view") === "options"
      )
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "NOT_CONFIGURED",
            message:
              "DEMO isolated empty provider state; no real prices or account.",
            options: [],
            providerStatus: "NOT_CONFIGURED",
            ruleVersion: "DEMO",
          }),
        });
      if (
        route.request().method() === "GET" &&
        url.pathname === "/api/community" &&
        url.searchParams.get("view") === "own_media"
      )
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"media":[],"fixture":true}',
        });
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: '{"error":"Isolated brand UI fixture: no operation accepted."}',
      });
    });
    await page.goto("/offline.html", { waitUntil: "networkidle" });
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>DEMO isolated brand review</title><meta name="robots" content="noindex,nofollow"></head><body><main id="demo-root"></main></body></html>',
    );
    for (const file of [
      "brand-theme.css",
      "globals.css",
      "sports-visuals.css",
      "sports-experience.css",
      "community-app.css",
      "native.css",
      "mobile-app.css",
    ])
      if (existsSync(path.join("src/app", file)))
        await page.addStyleTag({ path: path.resolve("src/app", file) });
    await page.addStyleTag({
      content:
        ".demo-label{padding:12px;background:#0B1F3B;color:#fff;font:700 12px/1.6 sans-serif;position:relative;z-index:60}.community-shell{min-height:90vh}",
    });
    await page.evaluate((html) => {
      Object.assign(window, { demoOfficialHtml: html });
    }, officialFixtureHtml);
    await page.addScriptTag({ content: demoBundle });
    const receipts = [];
    for (const view of ["home", "compose", "profile", "notifications"]) {
      await page.evaluate(
        (name) =>
          (
            window as unknown as { renderDemo: (name: string) => void }
          ).renderDemo(name),
        view,
      );
      await expect(page.getByRole("note")).toContainText(
        "NO AUTHENTICATED SESSION",
      );
      const result = await checks(page, log);
      await page.screenshot({
        path: path.join(evidence, `DEMO-${view}-${width}-${scheme}.png`),
        fullPage: true,
      });
      if (["home", "profile"].includes(view) && [390, 1440].includes(width))
        await page.screenshot({
          path: path.join(
            evidence,
            `DEMO-${view}-${width}-${scheme}-viewport.png`,
          ),
        });
      receipts.push({ view, ...result });
    }
    await writeFile(
      path.join(evidence, `DEMO-${width}-${scheme}.json`),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          width,
          osPreference: scheme,
          fixtures: true,
          statement:
            "Isolated fictional member-style UI only. No Auth session, database writes or real performance.",
          views: receipts,
        },
        null,
        2,
      ) + "\n",
    );
  });
}

test("Edge Signal PWA/favicon/offline artwork serves approved supplied bytes", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const links = await page
    .locator('link[rel="icon"],link[rel="apple-touch-icon"]')
    .evaluateAll((elements) =>
      elements.map((e) => (e as HTMLLinkElement).href),
    );
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) await suppliedAsset(page, link);
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toContain("Docked");
  expect(manifest.start_url).toBe("/home");
  expect(manifest.icons.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    if (icon.purpose !== "maskable") {
      await suppliedAsset(page, icon.src);
      continue;
    }
    // A documented platform derivative: intact 1024 master contained in a safe circle.
    const response = await page.request.get(icon.src);
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    const metadata = await sharp(bytes).metadata();
    expect([metadata.width, metadata.height]).toEqual([512, 512]);
    const source = await readFile(
      "public/brand/icons/docked-app-icon-1024.png",
    );
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      sources.assets["/brand/icons/docked-app-icon-1024.png"].sha256,
    );
    const sourcePixels = await sharp(source)
      .resize(280, 280, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const containedPixels = await sharp(bytes)
      .extract({ left: 116, top: 116, width: 280, height: 280 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(
      containedPixels.equals(sourcePixels),
      "Entire approved master preserved in centered safe area",
    ).toBe(true);
    const corner = await sharp(bytes)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    expect([...corner]).toEqual([11, 31, 59]);
  }
  await page.goto("/offline.html", { waitUntil: "networkidle" });
  const offlineLogo = page.locator(".brand img");
  await expect(offlineLogo).toHaveCount(1);
  await expect(offlineLogo).toHaveJSProperty("complete", true);
  await offlineLogo.evaluate((image: HTMLImageElement) => image.decode());
  const offline = await offlineLogo.evaluate((image: HTMLImageElement) => ({
    source: image.src,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    width: image.getBoundingClientRect().width,
    height: image.getBoundingClientRect().height,
    filter: getComputedStyle(image).filter,
    transform: getComputedStyle(image).transform,
    shadow: getComputedStyle(image).boxShadow,
  }));
  expect(offline.source.startsWith("data:image/png;base64,")).toBe(true);
  expect(
    createHash("sha256")
      .update(Buffer.from(offline.source.split(",")[1], "base64"))
      .digest("hex"),
  ).toBe(sources.assets["/brand/icons/docked-app-icon-1024.png"].sha256);
  expect([offline.naturalWidth, offline.naturalHeight]).toEqual([1024, 1024]);
  expect(Math.abs(offline.width / offline.height - 1)).toBeLessThan(
    0.03,
  );
  expect([offline.filter, offline.transform, offline.shadow]).toEqual([
    "none",
    "none",
    "none",
  ]);
  await expect(page.locator("h1")).toContainText(/offline/i);
  await page.screenshot({
    path: path.join(evidence, "offline.png"),
    fullPage: true,
  });
});
