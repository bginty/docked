/** Isolated UI transport tests. Real provider authentication remains a separate live check. */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out = `docs/qa/focused-cleanup/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture(
    "tests/fixtures/member-access-recovery.tsx",
  );
  const css = ["brand-theme", "globals", "app-auth", "startup-loading"]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const u = new URL(req.url!, "http://local");
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (u.pathname.startsWith("/brand/")) {
      const p = resolve("public", "." + u.pathname);
      if (!p.startsWith(resolve("public") + sep)) {
        res.statusCode = 403;
        return res.end();
      }
      try {
        return res.end(readFileSync(p));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><title>Local recovery QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><main id="fixture-root"></main><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    browser = await chromium.launch({ channel: "msedge" }),
    checks = [];
  try {
    for (const width of [1440, 412, 360]) {
      const context = await browser.newContext({
          viewport: { width, height: 915 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      await page.goto(origin + "/fantasy/play?failure=auth&mode=OPEN");
      await page.evaluate(() =>
        localStorage.setItem("isolated-draft", "saved lineup"),
      );
      await expect(page.getByRole("alert")).toHaveText("Please sign in again.");
      await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
      await page.screenshot({ path: `${out}/expired-${width}.png` });
      const href = await page
        .getByRole("link", { name: "Sign in", exact: true })
        .getAttribute("href");
      assert.equal(
        new URL(href!, origin).searchParams.get("next"),
        "/fantasy/play?failure=auth&mode=OPEN",
      );
      const actions: string[] = [];
      await page.route("**/api/auth", async (route) => {
        const b = route.request().postDataJSON();
        actions.push(b.action);
        assert.match(b.next, /^\/fantasy\/play/);
        await route.fulfill({
          json:
            b.action === "login"
              ? { redirect: "/mfa?next=" + encodeURIComponent(b.next) }
              : b.action === "mfa_status"
                ? { mode: "challenge" }
                : { redirect: b.next },
        });
      });
      await page.getByRole("link", { name: "Sign in", exact: true }).click();
      await page
        .getByLabel("Email", { exact: true })
        .fill("isolated@example.invalid");
      await page
        .getByLabel("Password", { exact: true })
        .fill("isolated-not-a-real-password");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => (window as any).demoNavigation))
        .toMatch(/^\/mfa\?next=/);
      const mfa = await page.evaluate(() => (window as any).demoNavigation);
      await page.goto(origin + mfa);
      await page.getByLabel("Authenticator code").fill("123456");
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await expect
        .poll(() => page.evaluate(() => (window as any).demoNavigation))
        .toBe("/fantasy/play?failure=auth&mode=OPEN");
      assert.deepEqual(actions, ["login", "mfa_status", "mfa_verify"]);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("isolated-draft")),
        "saved lineup",
      );
      for (const kind of ["mfa", "permission", "network"]) {
        await page.goto(origin + `/fantasy/play?failure=${kind}&mode=OPEN`);
        await expect(page.getByRole("alert")).toContainText(
          kind === "mfa"
            ? "Verify your identity"
            : kind === "permission"
              ? "don’t have access"
              : "couldn’t load",
        );
        await expect(
          page.getByRole("link", { name: "Sign in", exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(
          kind === "network" ? 1 : 0,
        );
        if (kind === "mfa")
          await expect(
            page.getByRole("link", { name: "Verify authenticator" }),
          ).toHaveAttribute("href", /\/mfa\?next=/);
        if (kind === "network") {
          await page.getByRole("button", { name: "Retry" }).click();
          await expect(page.getByRole("alert")).toContainText("couldn’t load");
        }
        await page.screenshot({ path: `${out}/${kind}-${width}.png` });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const violations = (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations.filter((v) =>
          ["critical", "serious"].includes(v.impact ?? ""),
        );
        assert.equal(violations.length, 0, JSON.stringify(violations));
      }
      checks.push({
        width,
        expiredSession: true,
        mfa: true,
        permission: true,
        networkRetry: true,
        safeReturn: true,
        draftRetained: true,
        seriousAccessibilityViolations: 0,
      });
      await context.close();
    }
    writeFileSync(
      out + "/checks.json",
      JSON.stringify(
        {
          scope: "Local UI and controlled transport; not real account login",
          checks,
        },
        null,
        2,
      ),
    );
    console.log({ out, checks });
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
