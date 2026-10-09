// Genuine hosted reads and intentionally denied writes only. No model/provider fixtures.
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, createHash } from "node:crypto";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "../audit-preview-secrets.mjs";
import {
  assertPhase5bAccount,
  phase5bProject as project,
  phase5bOrigin as origin,
  type Phase5bJournal,
} from "./phase5b-scope";
const output = "docs/qa/phase5b/hosted",
  rendered = "private-data/phase5b/hosted-rendered";
let stage = "scope",
  genuineSession = false,
  genuineMfa = false;
const checks: { check: string; status: "PASS" }[] = [];
const assets = new Set<string>();
function check(value: unknown, name: string): asserts value {
  stage = name;
  if (!value) throw Error("Acceptance assertion failed");
  checks.push({ check: name, status: "PASS" });
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")]
    .map((character) => {
      const index = alphabet.indexOf(character);
      if (index < 0) throw Error("Factor encoding");
      return index.toString(2).padStart(5, "0");
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
async function capture(
  page: Page,
  route: string,
  label: string,
  width: number,
) {
  stage = `screen-${label}-${width}`;
  await page.setViewportSize({ width, height: width < 600 ? 915 : 900 });
  const response = await page.goto(origin + route, {
    waitUntil: "domcontentloaded",
  });
  check(
    response?.status() === 200 && new URL(page.url()).origin === origin,
    `${label}-${width}-http`,
  );
  await page
    .getByRole("heading", {
      level: 1,
      ...(route.startsWith("/admin")
        ? {
            name:
              route === "/admin/daily" ? "Docked Today" : "Model Performance",
            exact: true,
          }
        : {}),
    })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
  if (route === "/results")
    check(
      await page
        .getByText("The record has not started yet.", { exact: true })
        .first()
        .isVisible(),
      `${label}-${width}-true-global-unstarted-record`,
    );
  if (route === "/admin/model-performance")
    check(
      await page.getByText("NOT CONFIGURED", { exact: true }).isVisible(),
      `${label}-${width}-no-invented-model`,
    );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label}-${width}-no-horizontal-overflow`,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(
    `${output}/${label}-${width}-axe.json`,
    JSON.stringify(
      {
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
        passes: axe.passes.length,
      },
      null,
      2,
    ) + "\n",
  );
  check(axe.violations.length === 0, `${label}-${width}-axe`);
  await page.screenshot({
    path: `${output}/${label}-${width}.png`,
    fullPage: true,
  });
  await writeFile(`${rendered}/${label}-${width}.html`, await page.content());
  for (const src of await page
    .locator("script[src]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).src))) {
    const url = new URL(src);
    if (
      url.origin !== origin ||
      !url.pathname.startsWith("/_next/static/") ||
      assets.has(src)
    )
      continue;
    const asset = await page.context().request.get(src, { maxRedirects: 0 });
    check(asset.status() === 200, `${label}-client-asset`);
    await writeFile(
      `${rendered}/${createHash("sha256").update(src).digest("hex")}.js`,
      await asset.body(),
    );
    assets.add(src);
  }
}
async function main() {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const member = process.argv[2] === "--member";
  try {
    check(
      ["--run", "--member"].includes(process.argv[2]) &&
        process.argv[3] === `--confirm-project=${project}` &&
        process.argv.length === 4 &&
        process.env.PHASE5B_PREVIEW_ORIGIN === origin,
      "explicit-preview-scope",
    );
    const account: Phase5bJournal = JSON.parse(
      await readFile("private-data/phase5b/operator.json", "utf8"),
    );
    assertPhase5bAccount(account);
    check(
      Boolean(account.password && account.factorId && account.totpSecret) &&
        Date.now() - Date.parse(account.createdAt) < 86400000 &&
        Date.parse(account.createdAt) <= Date.now() &&
        Boolean(account.memberOnly) === member,
      "fresh-disposable-session-scope",
    );
    await mkdir(output, { recursive: true });
    await mkdir(rendered, { recursive: true });
    browser = await chromium.launch();
    const anonymous = await browser.newContext();
    const post = (context: BrowserContext, path: string, data: unknown) =>
      context.request.post(origin + path, {
        data,
        headers: { Origin: origin },
        maxRedirects: 0,
      });
    check(
      (await anonymous.request.get(origin + "/api/admin/models")).status() ===
        403,
      "anonymous-model-read-denied",
    );
    check(
      (
        await post(anonymous, "/api/admin/models", {
          action: "create",
          configuration: {
            probabilities: { home: "0.5", draw: "0.25", away: "0.25" },
          },
          codeCommit: "a".repeat(40),
          reason: "Synthetic denied acceptance input",
        })
      ).status() === 403,
      "anonymous-model-write-denied",
    );
    const context = await browser.newContext({
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
    });
    const login = await post(context, "/api/auth", {
      action: "login",
      email: account.email,
      password: account.password,
      app: true,
    });
    check(
      login.status() === 200 && (await login.json()).ok === true,
      "genuine-password-login",
    );
    genuineSession = true;
    const identity = await context.request.get(origin + "/api/member");
    check(
      identity.status() === 200 &&
        (await identity.json()).profile.id === account.id,
      "exact-disposable-identity",
    );
    const cookies = (await context.cookies()).filter((c) =>
      c.name.startsWith(`sb-${project}-auth-token`),
    );
    check(
      cookies.length > 0 &&
        cookies.every((c) => c.secure && c.httpOnly && c.sameSite === "Lax"),
      "secure-session-cookies",
    );
    check(
      (await context.request.get(origin + "/api/admin/models")).status() ===
        403,
      "aal1-model-read-denied",
    );
    const verified = await post(context, "/api/auth", {
      action: "mfa_verify",
      email: account.email,
      factorId: account.factorId,
      code: totp(account.totpSecret!),
    });
    check(
      verified.status() === 200 && (await verified.json()).ok === true,
      "genuine-totp-mfa",
    );
    genuineMfa = true;
    if (member) {
      check(
        (await context.request.get(origin + "/api/admin/models")).status() ===
          403,
        "actual-member-with-mfa-model-read-denied",
      );
      check(
        (
          await post(context, "/api/admin/models", {
            action: "transition",
            id: "phase5b-nonexistent-model",
            to: "APPROVED_FOR_LIVE",
            reason: "Synthetic denied member operation",
            evidence: { probabilitySanity: true },
          })
        ).status() === 403,
        "actual-member-model-transition-denied",
      );
      check(
        (await context.request.get(origin + "/api/member")).status() === 200,
        "member-denial-is-not-logout",
      );
    } else {
      const models = await context.request.get(origin + "/api/admin/models");
      check(
        models.status() === 200 &&
          models.headers()["cache-control"]?.includes("no-store"),
        "actual-mfa-private-model-read",
      );
      const data = await models.json();
      check(
        data.status === "READY" &&
          data.implementationStatus === "NOT_CONFIGURED" &&
          data.versions.length === 0 &&
          data.attempts?.total === 0 &&
          data.calibration === null,
        "actual-empty-model-ledger-no-fabricated-probability",
      );
      check(
        (
          await context.request.post(origin + "/api/admin/models", {
            data: {},
            headers: { Origin: "https://example.invalid" },
            maxRedirects: 0,
          })
        ).status() === 403,
        "cross-origin-model-write-denied",
      );
      for (const [name, body] of [
        [
          "arbitrary-probability",
          {
            action: "create",
            configuration: {
              probabilities: { home: "0.5", draw: "0.25", away: "0.25" },
            },
            codeCommit: "a".repeat(40),
            reason: "Synthetic arbitrary probability denial",
          },
        ],
        [
          "top-level-probability",
          {
            action: "approve_policy",
            strategyId: "phase5b-nonexistent",
            probability: "0.8",
            reason: "Synthetic strict-schema denial",
          },
        ],
        [
          "no-model-live-transition",
          {
            action: "transition",
            id: "phase5b-nonexistent-model",
            to: "APPROVED_FOR_LIVE",
            reason: "Synthetic nonexistent-model denial",
            evidence: { probabilitySanity: true },
          },
        ],
        [
          "no-policy-activation",
          {
            action: "set_policy_active",
            strategyId: "phase5b-nonexistent-policy",
            active: true,
            reason: "Synthetic nonexistent-policy denial",
          },
        ],
      ] as const)
        check(
          (await post(context, "/api/admin/models", body)).status() === 403,
          `${name}-denied`,
        );
      const after = await (
        await context.request.get(origin + "/api/admin/models")
      ).json();
      check(
        after.status === "READY" &&
          after.versions.length === 0 &&
          after.attempts.total === 0,
        "denied-inputs-created-no-model-data",
      );
      // The genuine MFA session is used only in memory for the private-schema Data API denial.
      const connection = JSON.parse(
        await readFile("private-data/hosted-preview/connection.json", "utf8"),
      );
      check(
        connection.projectRef === project &&
          connection.supabaseUrl === `https://${project}.supabase.co`,
        "data-api-exact-preview",
      );
      const tokenOwner = await context.request.get(
        `${connection.supabaseUrl}/auth/v1/user`,
        {
          headers: {
            apikey: connection.publishableKey,
            Authorization: `Bearer ${account.accessToken}`,
          },
          maxRedirects: 0,
        },
      );
      check(
        tokenOwner.status() === 200 &&
          (await tokenOwner.json()).id === account.id,
        "data-api-genuine-current-token",
      );
      for (const table of [
        "football_model_versions",
        "football_model_attempts",
        "official_record_boundary",
      ]) {
        const r = await context.request.get(
          `${connection.supabaseUrl}/rest/v1/${table}?select=*`,
          {
            headers: {
              apikey: connection.publishableKey,
              Authorization: `Bearer ${account.accessToken}`,
              "Accept-Profile": "private",
            },
            maxRedirects: 0,
          },
        );
        check(
          [403, 404, 406].includes(r.status()),
          `private-data-api-${table}-denied`,
        );
      }
      let pageErrors = 0,
        consoleErrors = 0;
      const page = await context.newPage();
      const publicPage = await anonymous.newPage();
      for (const p of [page, publicPage]) {
        p.on("pageerror", () => pageErrors++);
        p.on("console", (m) => {
          if (m.type() === "error") consoleErrors++;
        });
      }
      for (const width of [412, 1366]) {
        await capture(
          page,
          "/admin/model-performance",
          "model-performance",
          width,
        );
        await capture(page, "/admin/daily", "daily", width);
        await capture(publicPage, "/results", "public-results", width);
      }
      check(
        pageErrors === 0 && consoleErrors === 0,
        "six-real-rendered-views-no-browser-errors",
      );
      const known = await loadKnownSecrets();
      // Browser password/MFA exchange creates a different token pair from the
      // operator's earlier session. Compare those real values in memory too.
      const liveCookieParts = (await context.cookies())
        .filter((c) => c.name.startsWith(`sb-${project}-auth-token`))
        .sort(
          (a, b) =>
            Number(a.name.split(".").at(-1) ?? 0) -
            Number(b.name.split(".").at(-1) ?? 0),
        );
      const liveCookie = liveCookieParts.map((c) => c.value).join("");
      check(
        liveCookie.startsWith("base64-"),
        "current-browser-session-encoding",
      );
      const liveSession = JSON.parse(
        Buffer.from(liveCookie.slice(7), "base64url").toString("utf8"),
      );
      check(
        typeof liveSession.access_token === "string" &&
          typeof liveSession.refresh_token === "string",
        "current-browser-session-secret-coverage",
      );
      const actual = [
        account.password,
        account.accessToken,
        account.totpSecret,
        ...liveCookieParts.map((c) => c.value),
        liveCookie,
        liveSession.access_token,
        liveSession.refresh_token,
      ].filter((s): s is string => typeof s === "string" && s.length > 0);
      const audit = await auditPreviewTargets(
        [rendered],
        [...known.values, ...actual],
      );
      await writeFile(
        `${output}/client-secret-audit.json`,
        JSON.stringify(audit, null, 2) + "\n",
      );
      check(audit.status === "PASS", "actual-rendered-secret-audit");
    }
    await context.close();
    await anonymous.close();
    await writeFile(
      `${output}/${member ? "member-denial" : "acceptance"}.json`,
      JSON.stringify(
        {
          status: "PASS",
          projectRef: project,
          origin,
          checkedAt: new Date().toISOString(),
          genuineSession,
          genuineMfa,
          providerRequests: 0,
          trialCalls: 0,
          modelDataSeeded: false,
          checks,
          clientAssets: assets.size,
          operatorCleanupRequired: true,
          limits: [
            "Viewport verification is not a physical-device test.",
            "No model estimator, sporting dataset or live publication was activated.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Phase5B ${member ? "member denial" : "hosted acceptance"} PASS (${checks.length} assertions).`,
    );
  } catch {
    await mkdir(output, { recursive: true });
    await writeFile(
      `${output}/failure-${new Date().toISOString().replaceAll(":", "-")}.json`,
      JSON.stringify(
        {
          status: "FAIL",
          checkpoint: stage,
          completedChecks: checks.length,
          genuineSession,
          genuineMfa,
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    console.error(
      `Phase5B acceptance stopped at ${stage}; sensitive details withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
void main();
