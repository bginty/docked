import { execFileSync } from "node:child_process";
/** Actual client components in an isolated loopback browser harness. No Auth/DB. */
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const out = "docs/qa/commercial-dashboard-release/screens";
fs.mkdirSync(out, { recursive: true });
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {AdminShell as PriorShell} from 'before-shell';
import {AdminShell} from './src/components/admin-shell';
import {StartupBoundary} from './src/components/startup-loading';
import {OwnerNavigationProvider} from './src/components/owner-navigation-context';
import {SportProvider} from './src/components/sport-context';
import {EnvironmentProvider} from './src/components/environment-context';
import {PublicOwnerDashboard as Current} from './src/components/public-owner-dashboard';
import {PublicOwnerDashboard as Before} from 'before-dashboard';
const env={production:true,publicCustomer:true,accountConfigured:true,commercialSurface:true};
const data={generatedAt:"2026-11-21T01:30:00Z",metrics:{customers:8,paidPacks:2,commercialCards:10,lifetimeIssued:16,receiptsInReview:0,recoveryHolds:0,jobsNeedingAttention:0,openSales:1,openIssuance:1}, limitations:[],
inventory:[{tier:"RARE",issued:16,cards:10,available_lifetime_supply:4984}],publicSummary:{days:[{day:"2026-11-19",customers:2,sales:4900,refunds:0},{day:"2026-11-20",customers:4,sales:9900,refunds:0},{day:"2026-11-21",customers:2,sales:4900,refunds:0}],verified:5,chargeTax:null,outstanding:8900,pending:0,packs:[{sport:"afl",type:"STANDARD",total:2}],support:1,moderation:0,sms:{budget:5000,reserved:300}}};
const Old = location.search.includes("before");
function App(){const Shell=Old?PriorShell:AdminShell;return <EnvironmentProvider value={env}><SportProvider><StartupBoundary><OwnerNavigationProvider retiredBeta customerModeAvailable={!Old}><Shell role="owner" displayName="Owner fixture">{Old?<Before data={data}/>:<Current data={data}/>}</Shell></OwnerNavigationProvider></StartupBoundary></SportProvider></EnvironmentProvider>;}
createRoot(document.getElementById('root')).render(<App/>);`;
const result = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "owner-browser-fixture.tsx",
    loader: "tsx",
  },
  jsx: "automatic",
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "isolated-navigation",
      setup(b) {
        b.onResolve({ filter: /^before-shell$/ }, () => ({
          path: "before-shell",
          namespace: "baseline-shell",
        }));
        b.onLoad({ filter: /.*/, namespace: "baseline-shell" }, () => ({
          contents: execFileSync(
            "git",
            [
              "show",
              "fd162088105d02c73398b7ba761fed334dc1f5ab:src/components/admin-shell.tsx",
            ],
            { encoding: "utf8" },
          ),
          resolveDir: path.resolve("src/components"),
          loader: "tsx",
        }));
        b.onResolve({ filter: /^before-dashboard$/ }, () => ({
          path: "before-dashboard",
          namespace: "prior",
        }));
        b.onLoad({ filter: /.*/, namespace: "prior" }, () => ({
          contents: execFileSync(
            "git",
            [
              "show",
              "fd162088105d02c73398b7ba761fed334dc1f5ab:src/components/public-owner-dashboard.tsx",
            ],
            { encoding: "utf8" },
          ),
          resolveDir: path.resolve("src/components"),
          loader: "tsx",
        }));

        b.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          resolveDir: process.cwd(),
          loader: "tsx",
          contents:
            args.path === "next/link"
              ? `import React from'react';import{navigate}from'next/navigation';export default function Link({href,children,onClick,prefetch,...rest}){return <a href={href} {...rest} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){e.preventDefault();navigate(href)}}}>{children}</a>}`
              : `import{useSyncExternalStore}from'react';let path=location.pathname;const listeners=new Set();const emit=()=>{path=location.pathname;for(const cb of listeners)cb()};addEventListener('popstate',emit);export function navigate(to){history.pushState(null,'',to);emit()}export function usePathname(){return useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>path)}export function useRouter(){return{push:navigate,replace:navigate,refresh:()=>{}}}export function useSearchParams(){return new URLSearchParams(location.search)}`,
        }));
        b.onResolve(
          {
            filter:
              /^\.\/(public-gameplay|nba-beta-screen|sport-beta-commerce)$/,
          },
          (args) => ({ path: args.path, namespace: "forbidden" }),
        );
        b.onLoad({ filter: /.*/, namespace: "forbidden" }, () => ({
          contents:
            "export function PublicGameplay(){throw Error('Forbidden gameplay mount')}export const NbaBetaScreen=PublicGameplay;export const SportBetaCommerce=PublicGameplay;",
        }));
      },
    },
  ],
});
const bundle = result.outputFiles[0].contents;
const css = [
  "brand-theme.css",
  "globals.css",
  "owner-reference.css",
  "commercial-dashboard.css",
  "startup-loading.css",
]
  .map((f) => fs.readFileSync("src/app/" + f, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle);
  } else if (url.pathname === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else if (url.pathname.startsWith("/brand/")) {
    const file = path.resolve("public", "." + url.pathname),
      root = path.resolve("public") + path.sep;
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".webp") ? "image/webp" : "image/png",
    );
    res.end(fs.readFileSync(file));
  } else if (url.pathname.startsWith("/api/")) {
    res.statusCode = 403;
    res.end("No API available in isolated fixture");
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    for (const variant of ["before", "after"]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 960 },
      });
      page.on("pageerror", (e) => console.error(e.message));
      await page.route("**/*", (route) =>
        new URL(route.request().url()).hostname === "127.0.0.1"
          ? route.continue()
          : route.abort(),
      );
      await page.goto(
        "http://127.0.0.1:" + port + "/admin/operations?" + variant,
      );
      await page
        .getByRole("heading", { name: "Commercial operations" })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (variant === "after") {
        await page
          .getByRole("heading", { name: "Gross Google credit sales" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "View as Customer", exact: true })
            .first()
            .locator("..")
            .getAttribute("action"),
          "/api/owner-view?mode=customer",
        );
        await page.locator(".admin-account summary").click();
        await page
          .getByRole("button", { name: "Log out", exact: true })
          .waitFor();
        await page.locator(".admin-account summary").click();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          "Page overflows viewport",
        );
      }
      await page.screenshot({
        path: path.join(out, variant + "-" + width + ".png"),
        fullPage: true,
      });
      await page.close();
    }
  }
  console.log(
    "PASS desktop and mobile comparison, Owner account menu, customer switch and viewport widths; synthetic read-only data.",
  );
} finally {
  await browser.close();
  server.close();
}
