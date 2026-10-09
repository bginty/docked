// Opt-in real Preview acceptance. No provider token/permit submission, route mocks,
// trace, video, auth screenshots, cookie dumps or credential logging.
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, createHash } from "node:crypto";
import manifest from "../../config/hosted-preview.json";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "../audit-preview-secrets.mjs";

const output = "docs/qa/phase5a/hosted";
const rendered = "private-data/phase5a/hosted-rendered";
const checks: { check: string; status: "PASS" }[] = [];
const assets = new Set<string>();
let stage = "explicit-preview-scope";
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
  origin: string,
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
      name:
        route === "/admin/data-health"
          ? "Know what the feed can support."
          : "Edge Scanner",
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
  if (route === "/admin/data-health") {
    await page
      .getByRole("heading", {
        name: "The Odds API · controlled Preview trial",
        exact: true,
      })
      .waitFor();
    check(
      await page
        .getByText("APPROVED_FOR_PREVIEW_TRIAL", { exact: true })
        .isVisible(),
      `${label}-${width}-preview-rights-only`,
    );
    check(
      await page
        .getByRole("heading", {
          name: "Canonical trial fixtures · staff only",
          exact: true,
        })
        .isVisible(),
      `${label}-${width}-staff-fixture-evidence`,
    );
    check(
      !(await page
        .getByText(
          "No retained canonical trial fixtures are available to inspect.",
        )
        .count()),
      `${label}-${width}-genuine-fixtures-present`,
    );
    const field = async (name: string) =>
      (
        await page
          .getByText(name, { exact: true })
          .locator("..")
          .locator("dd")
          .innerText()
      ).trim();
    check(
      (await field("Account access status")) === "NOT_INCLUDED",
      `${label}-${width}-actual-history-not-included`,
    );
    const successes = Number(await field("Successful HTTP responses"));
    const attempts = Number(await field("Recorded attempts"));
    check(
      Number.isInteger(successes) &&
        successes > 0 &&
        Number.isInteger(attempts) &&
        attempts > successes,
      `${label}-${width}-successful-retry-and-failed-attempt-retained`,
    );
    check(
      (await field("Last error code")) === "TRIAL_REQUEST_FAILED" &&
        Number.isFinite(Date.parse(await field("Last failed fetch (UTC)"))) &&
        Number.isFinite(Date.parse(await field("Last successful fetch (UTC)"))),
      `${label}-${width}-original-sanitized-failure-preserved`,
    );
    check(
      (await field("Trial charges reported by provider")) === "Unknown",
      `${label}-${width}-unreported-failure-charge-remains-unknown`,
    );
    const references = page.locator(
      'section[aria-labelledby="trial-health-title"] > details.card',
    );
    let unconfiguredReferences = 0;
    for (let index = 0; index < (await references.count()); index++) {
      const reference = references.nth(index);
      const referenceField = async (name: string) =>
        (
          (await reference
            .getByText(name, { exact: true })
            .locator("..")
            .locator("dd")
            .textContent()) ?? ""
        ).trim();
      if ((await referenceField("Status")) !== "NOT_CONFIGURED") continue;
      if (unconfiguredReferences === 0)
        await reference.locator("summary").click();
      unconfiguredReferences++;
      for (const metric of [
        "Availability reference",
        "Availability sources",
        "Pricing sources",
        "Eligible observations",
        "Excluded observations",
        "Stale observations",
        "Outliers",
        "Source age at evaluation (seconds)",
      ])
        check(
          (await referenceField(metric)) === "Unknown",
          `${label}-${width}-unconfigured-reference-${index}-${metric.toLowerCase().replaceAll(" ", "-")}-unmeasured`,
        );
    }
    check(
      unconfiguredReferences > 0,
      `${label}-${width}-actual-unconfigured-reference-evidence`,
    );
  } else {
    check(
      await page.getByText(/MODEL_PROBABILITY_UNAVAILABLE/).isVisible(),
      `${label}-${width}-no-approved-model`,
    );
    check(
      await page.getByText(/MARKET_DATA_READY/).isVisible(),
      `${label}-${width}-actual-data-only-run`,
    );
  }
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label}-${width}-no-overflow`,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(axe.violations.length === 0, `${label}-${width}-accessibility`);
  await page.screenshot({
    path: `${output}/${label}-${width}.png`,
    fullPage: true,
  });
  await writeFile(`${rendered}/${label}-${width}.html`, await page.content());
  for (const src of await page
    .locator("script[src]")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLScriptElement).src),
    )) {
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
  try {
    const origin = process.env.PHASE5A_PREVIEW_ORIGIN;
    check(
      process.argv.length === 4 &&
        process.argv[2] === "--run" &&
        process.argv[3] ===
          `--confirm-project=${manifest.supabaseProjectRef}` &&
        origin === manifest.origin &&
        new URL(origin).protocol === "https:" &&
        manifest.target === "preview",
      "explicit-preview-scope",
    );
    const account = JSON.parse(
      await readFile("private-data/phase5a/operator.json", "utf8"),
    );
    check(
      account.erased !== true &&
        account.email ===
          `docked-phase5a-operator-${account.runId}@example.invalid` &&
        /^[0-9a-f-]{36}$/i.test(account.id) &&
        Array.isArray(account.baselineIds) &&
        !account.baselineIds.includes(account.id) &&
        [account.password, account.factorId, account.totpSecret].every(
          (value) => typeof value === "string" && value.length > 0,
        ),
      "private-disposable-operator",
    );
    await mkdir(output, { recursive: true });
    await mkdir(rendered, { recursive: true });
    browser = await chromium.launch();
    const anonymous = await browser.newContext();
    const post = (context: BrowserContext, path: string, body: unknown) =>
      context.request.post(origin + path, {
        data: body,
        headers: { Origin: origin },
        maxRedirects: 0,
      });
    for (const path of [
      "/api/internal/provider-trial",
      "/api/internal/edge-scanner",
    ])
      check(
        (await post(anonymous, path, {})).status() === 401,
        `anonymous-no-token-${path}`,
      );
    check(
      (await anonymous.request.get(origin + "/api/admin/scanner")).status() ===
        403,
      "anonymous-staff-denied",
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
      "genuine-app-login",
    );
    const own = await context.request.get(origin + "/api/member");
    check(
      own.status() === 200 && (await own.json()).profile.id === account.id,
      "actual-operator-identity",
    );
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith(`sb-${manifest.supabaseProjectRef}-auth-token`),
    );
    check(
      cookies.length > 0 &&
        cookies.every(
          (cookie) =>
            cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax",
        ),
      "secure-app-cookies",
    );
    check(
      (await context.request.get(origin + "/api/admin/scanner")).status() ===
        403,
      "aal1-staff-denied",
    );
    const verified = await post(context, "/api/auth", {
      action: "mfa_verify",
      email: account.email,
      factorId: account.factorId,
      code: totp(account.totpSecret),
    });
    check(
      verified.status() === 200 && (await verified.json()).ok === true,
      "genuine-existing-factor-mfa",
    );
    const scanner = await context.request.get(origin + "/api/admin/scanner");
    check(
      scanner.status() === 200 &&
        scanner.headers()["cache-control"]?.includes("no-store"),
      "aal2-private-scanner-read",
    );
    const scannerData = await scanner.json();
    check(
      scannerData.dataOnly?.modelStatus === "MODEL_PROBABILITY_UNAVAILABLE" &&
        scannerData.dataOnly?.status === "MARKET_DATA_READY",
      "actual-data-only-no-model",
    );
    check(scannerData.status === "PAUSED", "scheduled-scanner-remains-paused");
    for (const window of ["today", "upcoming", "weekend"]) {
      const response = await context.request.get(
        `${origin}/api/market-data?window=${window}`,
      );
      const data = await response.json();
      check(
        response.status() === 200 &&
          data.status === "DISABLED" &&
          Array.isArray(data.events) &&
          data.events.length === 0,
        `ordinary-member-region-denied-${window}`,
      );
      check(
        response.headers()["cache-control"]?.includes("no-store"),
        `ordinary-member-private-cache-${window}`,
      );
    }
    const options = await context.request.get(
      origin + "/api/community-edges?view=options",
    );
    const optionData = await options.json();
    check(
      options.status() === 200 &&
        optionData.status === "NOT_CONFIGURED" &&
        Array.isArray(optionData.options) &&
        optionData.options.length === 0,
      "community-reference-unconfigured-no-benchmark",
    );
    const page = await context.newPage();
    let pageErrors = 0,
      consoleErrors = 0;
    page.on("pageerror", () => pageErrors++);
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors++;
    });
    for (const width of [412, 1366]) {
      await capture(page, origin, "/admin/data-health", "data-health", width);
      await capture(page, origin, "/admin/edge-scanner", "scanner", width);
    }
    check(
      pageErrors === 0 && consoleErrors === 0,
      "rendered-no-browser-errors",
    );
    const known = await loadKnownSecrets();
    const additional = [
      account.password,
      account.operatorToken,
      account.totpSecret,
      account.accessToken,
    ].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    const audit = await auditPreviewTargets(
      [rendered],
      [...known.values, ...additional],
    );
    await writeFile(
      `${output}/client-secret-audit.json`,
      JSON.stringify(
        {
          ...audit,
          scope:
            "rendered staff HTML and same-origin public client scripts; known local and temporary operator secrets, no values emitted",
        },
        null,
        2,
      ) + "\n",
    );
    check(audit.status === "PASS", "rendered-client-secret-audit");
    await writeFile(
      `${output}/acceptance.json`,
      JSON.stringify(
        {
          status: "PASS",
          origin,
          projectRef: manifest.supabaseProjectRef,
          checkedAt: new Date().toISOString(),
          genuineSession: true,
          genuineMfa: true,
          providerRequests: 0,
          trialPermitsSubmitted: 0,
          mockedData: false,
          checks,
          pageErrors,
          consoleErrors,
          clientAssets: assets.size,
          operatorCleanupRequired: true,
          limits: [
            "Staff fixture evidence does not authorize member market display.",
            "Browser widths are not physical Android device acceptance.",
            "Operator session is closed locally; root performs final revocation and account erasure.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    await context.close();
    await anonymous.close();
    console.log(
      `Phase 5A hosted acceptance PASS (${checks.length} assertions). No credentials printed.`,
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
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    console.error(
      `Phase 5A hosted acceptance stopped at ${stage}; private details withheld.`,
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
void main();
