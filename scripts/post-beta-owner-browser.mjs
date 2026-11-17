/** Actual client components in an isolated loopback browser harness. No Auth/DB. */
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const out = "docs/qa/post-beta-owner-login-20261117";
fs.mkdirSync(out, { recursive: true });
const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import{AdminShell}from'./src/components/admin-shell';
import{StartupBoundary}from'./src/components/startup-loading';
import{OwnerNavigationProvider}from'./src/components/owner-navigation-context';
import{SportProvider}from'./src/components/sport-context';
import{EnvironmentProvider}from'./src/components/environment-context';
import{navigate}from'next/navigation';
const env={production:true,liveBeta:true,registrationAvailable:false,emailAvailable:false,invitationAllowed:false,policyVersions:null,accountConfigured:true,reason:'closed',publicCustomer:false};
function App(){React.useEffect(()=>{navigate('/admin/incidents')},[]);return <EnvironmentProvider value={env}><SportProvider><StartupBoundary><OwnerNavigationProvider retiredBeta={true}><AdminShell role="owner" displayName={new URLSearchParams(location.search).get('who')==='barry'?'Barry fixture':'Founder fixture'}><h1>Operational incidents</h1><p>Isolated navigation fixture; no operational action is available.</p></AdminShell></OwnerNavigationProvider></StartupBoundary></SportProvider></EnvironmentProvider>}
createRoot(document.getElementById('root')).render(<App/>);`;
const result = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "owner-browser-fixture.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "isolated-navigation",
      setup(b) {
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
const cases = [];
try {
  for (const [who, width] of [
    ["founder", 360],
    ["barry", 412],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      calls = [],
      errors = [];
    await page.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        calls.push(new URL(request.url()).pathname);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/app?who=${who}`);
    await page
      .getByRole("heading", { name: "Operational incidents" })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.locator("[inert]").count(),
      0,
      "Startup overlay must release admin content",
    );
    await page
      .getByRole("button", { name: "Open administration navigation" })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Close administration navigation" })
        .getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    await page.locator(".admin-account summary").click();
    assert.equal(
      await page
        .getByRole("link", { name: "Owner access", exact: true })
        .getAttribute("href"),
      "/app",
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Security & MFA" })
        .getAttribute("href"),
      "/mfa?next=%2Fadmin%2Fincidents",
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Operational incidents", exact: true })
        .getAttribute("href"),
      "/admin/incidents",
    );
    assert.equal(await page.locator('a[href^="/fantasy/"]').count(), 0);
    await page
      .getByRole("link", { name: "Operational incidents", exact: true })
      .click();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("docked-app-resume"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.deepEqual(calls, []);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `${out}/owner-${who}-${width}.png`,
      fullPage: true,
    });
    cases.push({
      who: `${who} synthetic presentation`,
      width,
      startupReleased: true,
      menuAndAccountLinksPassed: true,
      betaApiRequests: calls.length,
      javascriptErrors: errors.length,
    });
    await context.close();
  }
  fs.writeFileSync(
    `${out}/mobile-component-tests.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        type: "Actual client components; isolated loopback navigation harness, mocked Next routing, no Auth/provider/DB",
        cases,
        physicalAndroidAcceptance: "not performed",
        productionWrites: 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: cases.length,
      productionWrites: 0,
      betaApiRequests: 0,
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
