import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../../tests/fixtures/bundle-community";
async function main() {
  const out = "docs/qa/overnight-audit-20261115/weekly-panel";
  fs.mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "scripts/audit/weekly-panel.fixture.tsx",
  );
  const css = [
    ...fs
      .readFileSync("src/app/layout.tsx", "utf8")
      .matchAll(/import "\.\/(.+\.css)"/g),
  ]
    .map((x) => fs.readFileSync("src/app/" + x[1], "utf8"))
    .join("\n");
  const states = new Map<string, any>();
  let failRead = false;
  const requests: any[] = [];
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://localhost");
    const json = (v: unknown, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(v));
    };
    if (u.pathname === "/api/weekly-core") {
      const sport = u.searchParams.get("sport")!;
      const state = states.get(sport);
      if (req.method === "POST") {
        let raw = "";
        for await (const c of req) raw += c;
        requests.push({ sport, ...JSON.parse(raw) });
        return json(
          {
            error:
              "Isolated transport failure before issue. Retry using the saved request.",
          },
          503,
        );
      }
      return failRead
        ? json({ error: "Isolated provider unavailable" }, 503)
        : json({ state });
    }
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (u.pathname.startsWith("/images/") || u.pathname.startsWith("/brand/")) {
      const file = path.resolve("public", "." + u.pathname);
      assert(file.startsWith(path.resolve("public") + path.sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(fs.readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated weekly panel</title><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const results: any[] = [];
  try {
    for (const sport of ["nfl", "afl", "nrl"]) {
      states.set(sport, {
        enabled: true,
        member: "audit-member",
        sport,
        policy: "audit-only",
        serverTime: Date.now(),
        nextIssueAt: new Date(Date.now() + 86400000).toISOString(),
        packs: [
          {
            id: "audit-" + sport,
            issuedAt: new Date().toISOString(),
            dueAt: new Date().toISOString(),
            openedAt: null,
            receipt: null,
          },
        ],
      });
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(origin + "/?sport=" + sport);
      await expect(
        page.getByText("1 unopened pack", { exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: out + "/" + sport + "-ready.png" });
      const buttons = await page.getByRole("button").allTextContents();
      const axe = await new AxeBuilder({ page }).analyze();
      failRead = true;
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Retry pack check", exact: true }),
      ).toBeVisible();
      failRead = false;
      await page
        .getByRole("button", { name: "Retry pack check", exact: true })
        .click();
      await expect(
        page.getByText("1 unopened pack", { exact: true }),
      ).toBeVisible();
      results.push({
        sport,
        ready: true,
        readFailureRecovered: true,
        buttons,
        axe: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map((n) => n.target),
        })),
      });
      fs.writeFileSync(
        out + "/results.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            scope:
              "Current WeeklyCorePanel, synthetic three-sport HTTP transport. No cards issued; no hosted or Android acceptance.",
            results,
          },
          null,
          2,
        ),
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
