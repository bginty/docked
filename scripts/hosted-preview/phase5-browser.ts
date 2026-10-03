// Real HTTPS sessions and MFA. No route mocks, cookie dumps, trace, video or auth screenshots.
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, createHash } from "node:crypto";

const origin = "https://docked-preview-s24-briant-ginty.vercel.app",
  project = "bckkllmndoxzpzdqrevb";
const output = "docs/qa/phase5/hosted";
const rendered = "private-data/phase5/hosted-rendered";
const scannedAssets = new Set<string>();
const checks: { check: string; status: "PASS" }[] = [];
let stage = "scope";
function check(value: unknown, label: string): asserts value {
  stage = label;
  if (!value) throw Error("Acceptance assertion failed");
  checks.push({ check: label, status: "PASS" });
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")]
    .map((c) => {
      const n = alphabet.indexOf(c);
      if (n < 0) throw Error("Factor encoding");
      return n.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return ((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function post(context: BrowserContext, path: string, body: unknown) {
  return context.request.post(origin + path, {
    data: body,
    headers: { Origin: origin },
    maxRedirects: 0,
  });
}
async function capture(page: Page, path: string, name: string, width: number) {
  stage = `screen-${name}-${width}`;
  await page.setViewportSize({ width, height: width < 600 ? 915 : 900 });
  const response = await page.goto(origin + path, {
    waitUntil: "domcontentloaded",
  });
  check(response?.status() === 200, `${name}-${width}-http`);
  await page.locator("h1").first().waitFor();
  const expected: Record<string, string> = {
    "/admin/edge-scanner": "Edge Scanner",
    "/admin/candidate-edges": "Candidate Edges",
    "/admin/daily": "Daily operations",
    "/admin/data-health": "Know what the feed can support.",
  };
  if (expected[path])
    check(
      await page
        .getByRole("heading", { level: 1, name: expected[path], exact: true })
        .isVisible(),
      `${name}-${width}-real-dashboard`,
    );
  await page.evaluate(() => document.fonts.ready);
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}-${width}-no-overflow`,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(axe.violations.length === 0, `${name}-${width}-accessibility`);
  await page.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: true,
  });
  await writeFile(`${rendered}/${name}-${width}.html`, await page.content());
  const assets = await page
    .locator("script[src]")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLScriptElement).src),
    );
  for (const src of assets) {
    const url = new URL(src);
    if (
      url.origin !== origin ||
      !url.pathname.startsWith("/_next/static/") ||
      scannedAssets.has(src)
    )
      continue;
    const asset = await page.context().request.get(src);
    check(asset.status() === 200, `${name}-public-asset`);
    await writeFile(
      `${rendered}/${createHash("sha256").update(src).digest("hex")}.js`,
      await asset.body(),
    );
    scannedAssets.add(src);
  }
}
async function main() {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    check(
      process.argv[2] === "--run" &&
        process.argv[3] === `--confirm-project=${project}` &&
        process.argv.length === 4,
      "explicit-preview-scope",
    );
    const fixture = JSON.parse(
      await readFile("private-data/phase5/acceptance.json", "utf8"),
    );
    check(
      fixture.projectRef === project &&
        fixture.organizationId === "ernfnkcbalhyqpsrzdwa" &&
        fixture.state === "ready" &&
        fixture.qaFixture === true &&
        fixture.accounts.length === 5,
      "private-disposable-roster",
    );
    await mkdir(output, { recursive: true });
    await mkdir(rendered, { recursive: true });
    browser = await chromium.launch();
    const contexts: BrowserContext[] = [];
    const errors: {
      role: string;
      pageErrors: number;
      consoleErrors: number;
    }[] = [];
    const anonymous = await browser.newContext();
    contexts.push(anonymous);
    for (const path of [
      "/api/admin/scanner",
      "/api/admin/scanner?view=candidates",
      "/api/admin/scanner?view=daily",
      "/api/admin/market-data-editorial",
    ]) {
      const r = await anonymous.request.get(origin + path);
      check(r.status() === 403, `anonymous-denied-${path}`);
    }
    check(
      (await post(anonymous, "/api/internal/edge-scanner", {})).status() ===
        401,
      "anonymous-worker-denied",
    );
    const publicPage = await anonymous.newPage();
    const publicErrors = { role: "anonymous", pageErrors: 0, consoleErrors: 0 };
    errors.push(publicErrors);
    publicPage.on("pageerror", () => publicErrors.pageErrors++);
    publicPage.on("console", (m) => {
      if (m.type() === "error") publicErrors.consoleErrors++;
    });
    await capture(publicPage, "/edges", "anonymous-edges", 412);
    check(
      publicErrors.pageErrors === 0 && publicErrors.consoleErrors === 0,
      "anonymous-no-browser-errors",
    );
    for (const account of fixture.accounts) {
      const role = String(account.role);
      check(
        account.email ===
          `docked-phase5-${role}-${fixture.runId}@example.invalid` &&
          account.id &&
          !fixture.baselineIds.includes(account.id),
        `scope-${role}`,
      );
      const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
      });
      contexts.push(context);
      const page = await context.newPage();
      const diagnostic = { role, pageErrors: 0, consoleErrors: 0 };
      errors.push(diagnostic);
      page.on("pageerror", () => diagnostic.pageErrors++);
      page.on("console", (m) => {
        if (m.type() === "error") diagnostic.consoleErrors++;
      });
      stage = `login-${role}`;
      const login = await post(context, "/api/auth", {
        action: "login",
        email: account.email,
        password: account.password,
        app: true,
      });
      check(
        login.status() === 200 && (await login.json()).ok === true,
        `genuine-login-${role}`,
      );
      const own = await context.request.get(origin + "/api/member");
      check(
        own.status() === 200 && (await own.json()).profile.id === account.id,
        `actual-user-${role}`,
      );
      const cookie = (await context.cookies()).filter((c) =>
        c.name.startsWith(`sb-${project}-auth-token`),
      );
      check(
        cookie.length > 0 &&
          cookie.every((c) => c.httpOnly && c.secure && c.sameSite === "Lax"),
        `secure-cookies-${role}`,
      );
      check(
        (await context.request.get(origin + "/api/admin/scanner")).status() ===
          403,
        `aal1-staff-denied-${role}`,
      );
      if (role !== "member") {
        // Exact logged-in QA email scopes the existing endpoint's request limiter.
        const enroll = await post(context, "/api/auth", {
          action: "mfa_enroll",
          email: account.email,
        });
        const factor = await enroll.json();
        check(
          enroll.status() === 200 && factor.factorId && factor.secret,
          `genuine-mfa-enrolled-${role}`,
        );
        const verified = await post(context, "/api/auth", {
          action: "mfa_verify",
          email: account.email,
          factorId: factor.factorId,
          code: totp(factor.secret),
        });
        check(
          verified.status() === 200 && (await verified.json()).ok,
          `genuine-mfa-verified-${role}`,
        );
      }
      const staff = ["admin", "analyst", "auditor"].includes(role);
      const editorial = await context.request.get(
        origin + "/api/admin/market-data-editorial?window=weekend",
      );
      const mayDraft = ["admin", "editor"].includes(role);
      check(
        editorial.status() === (mayDraft ? 200 : 403),
        `${role}-editorial-permission`,
      );
      if (mayDraft) {
        const payload = await editorial.json();
        check(
          payload.status === "NOT_CONFIGURED" && payload.draft === null,
          `${role}-no-invented-editorial-draft`,
        );
      }
      if (["member", "editor", "auditor"].includes(role))
        check(
          (
            await post(context, "/api/admin/community-recognition", {
              action: "snapshot",
            })
          ).status() === 403,
          `${role}-recognition-mutation-denied`,
        );
      for (const view of ["dashboard", "candidates", "daily"]) {
        const response = await context.request.get(
          `${origin}/api/admin/scanner?view=${view}`,
        );
        check(
          response.status() === (staff ? 200 : 403),
          `${role}-${view}-permission`,
        );
        check(
          response.headers()["cache-control"]?.includes("no-store"),
          `${role}-${view}-private-cache`,
        );
      }
      const forbidden = await context.request.post(
        origin + "/api/admin/scanner",
        {
          data: { action: "pause", reason: "Phase 5 closed-gate acceptance" },
          headers: { Origin: "https://untrusted.invalid" },
        },
      );
      check(forbidden.status() === 403, `${role}-cross-origin-denied`);
      const approval = await post(context, "/api/admin/scanner", {
        action: "approve",
        id: "00000000-0000-4000-8000-000000000005",
        reason: "QA nonexistent candidate must never publish",
      });
      check(approval.status() === 403, `${role}-nonexistent-candidate-denied`);
      if (!["admin", "analyst"].includes(role))
        check(
          (
            await post(context, "/api/admin/scanner", {
              action: "pause",
              reason: "QA unauthorized scanner pause",
            })
          ).status() === 403,
          `${role}-mutation-denied`,
        );
      if (role === "member") {
        const monitored = await context.request.get(
          origin + "/api/market-data?window=weekend",
        );
        const marketData = await monitored.json();
        check(
          monitored.status() === 200 &&
            marketData.status === "NOT_CONFIGURED" &&
            marketData.events.length === 0,
          "member-market-data-honest-empty",
        );
        check(
          monitored.headers()["cache-control"]?.includes("no-store"),
          "member-market-data-private-cache",
        );
        check(
          (
            await post(context, "/api/market-data", { action: "ingest" })
          ).status() === 405,
          "member-cannot-invoke-provider-ingestion",
        );
        for (const [path, label] of [
          ["/edges", "edges"],
          ["/feed", "feed"],
          ["/following", "following"],
          ["/points", "points"],
          ["/my-edge", "my-edge"],
        ]) {
          await capture(page, path, label, 412);
          check(
            await page
              .getByRole("navigation", { name: "Mobile app navigation" })
              .isVisible(),
            `${label}-persistent-tabs`,
          );
          await page.reload({ waitUntil: "domcontentloaded" });
          await page
            .getByRole("navigation", { name: "Mobile app navigation" })
            .waitFor();
          check(
            (await context.request.get(origin + "/api/member")).status() ===
              200,
            `${label}-session-refresh`,
          );
        }
        await capture(page, "/edges", "edges", 1366);
      }
      if (role === "admin")
        for (const [path, label] of [
          ["/admin/edge-scanner", "edge-scanner"],
          ["/admin/candidate-edges", "candidate-edges"],
          ["/admin/daily", "daily-operations"],
          ["/admin/data-health", "data-health"],
        ]) {
          await capture(page, path, label, 412);
          await capture(page, path, label, 1366);
        }
      check(diagnostic.pageErrors === 0, `${role}-no-page-errors`);
      check(diagnostic.consoleErrors === 0, `${role}-no-console-errors`);
      const logout = await post(context, "/api/auth", {
        action: "logout",
        email: account.email,
        app: true,
      });
      check(logout.status() === 200, "logout-" + role);
      check(
        (await context.request.get(origin + "/api/member")).status() === 401,
        "logout-revoked-" + role,
      );
    }
    await writeFile(
      `${output}/acceptance.json`,
      JSON.stringify(
        {
          projectRef: project,
          origin,
          checkedAt: new Date().toISOString(),
          status: "PASS",
          genuineSessions: true,
          genuineStaffMfa: true,
          mockedData: false,
          checks,
          diagnostics: errors,
          limits: [
            "No provider credentials or genuine sporting data; populated sporting states use isolated local tests only.",
            "S24-sized browser viewport is not a physical device test.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    for (const context of contexts) await context.close();
    console.log(
      `Hosted Phase 5 acceptance PASS (${checks.length} assertions); no credentials or raw browser messages retained.`,
    );
  } catch {
    await mkdir(output, { recursive: true });
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        {
          status: "FAIL",
          checkpoint: stage,
          completedChecks: checks.length,
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.error(
      `Hosted Phase 5 acceptance stopped at ${stage}; private diagnostics withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
void main();
