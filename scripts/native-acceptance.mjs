// Genuine Android WebView acceptance only. No forged sessions, route interception,
// auth screenshots, tracing, cookies, callback URLs or credentials are logged.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const sdk = process.env.ANDROID_HOME;
const serial = process.env.DOCKED_ANDROID_SERIAL || "emulator-5554";
const mode = process.argv.includes("--member-b-authorised")
  ? "member"
  : "public";
const project = "bckkllmndoxzpzdqrevb",
  origin = "http://localhost:3000",
  pkg = "au.com.docked.app.preview";
const checks = [];
let checkpoint = "prerequisites",
  browser,
  page;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function check(ok, code) {
  checkpoint = code;
  if (!ok) {
    checkpoint = code;
    throw new Error("Native check failed");
  }
  checks.push({ check: code, status: "PASS" });
}
function adb(...args) {
  return execFileSync(
    path.join(sdk, "platform-tools", "adb.exe"),
    ["-s", serial, ...args],
    { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}
async function connect() {
  const pid = adb("shell", "pidof", pkg).split(/\s+/)[0];
  check(/^\d+$/.test(pid), "native-process");
  adb("forward", "tcp:9223", `localabstract:webview_devtools_remote_${pid}`);
  checkpoint = "native-cdp-attach";
  for (let i = 0; i < 20; i++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9223", {
        timeout: 3000,
        // Android WebView does not support browser-context download overrides.
        noDefaults: true,
      });
      page = browser.contexts()[0]?.pages()[0];
      if (page) {
        page.setDefaultTimeout(30000);
        return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error("WebView inspection unavailable");
}
async function restart() {
  checkpoint = "native-restart-disconnect";
  await browser?.close().catch(() => {});
  checkpoint = "native-restart-stop";
  adb("shell", "am", "force-stop", pkg);
  checkpoint = "native-restart-start";
  adb(
    "shell",
    "am",
    "start",
    "-W",
    "-n",
    `${pkg}/au.com.docked.app.MainActivity`,
  );
  await delay(1200);
  await connect();
}
async function memberIdentity() {
  return page.evaluate(async () => {
    const r = await fetch("/api/member", { cache: "no-store" });
    const data = r.ok ? await r.json() : null;
    return {
      status: r.status,
      id: data?.profile?.id,
      private: r.headers.get("cache-control")?.includes("no-store"),
    };
  });
}
try {
  check(!!sdk && /^emulator-\d+$/.test(serial), "designated-emulator");
  const packagePath = adb("shell", "pm", "path", pkg).replace(/^package:/, "");
  check(
    /^\/data\/app\/[A-Za-z0-9_.~\-/=]+\/base\.apk$/.test(packagePath) &&
      !packagePath.includes("/../"),
    "designated-installed-package",
  );
  const expectedHash = createHash("sha256")
    .update(readFileSync("private-data/android/docked-inspection-only.apk"))
    .digest("hex");
  check(
    adb("shell", "sha256sum", packagePath).split(/\s+/)[0] === expectedHash,
    "designated-inspection-apk",
  );
  adb("reverse", "tcp:3000", "tcp:3000");
  await connect();
  await page.goto(origin + "/methodology", { waitUntil: "domcontentloaded" });
  await page.locator("html.docked-native").waitFor();
  check(
    await page.evaluate(() => !!window.Capacitor?.isNativePlatform?.()),
    "real-capacitor-webview",
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "native-public-no-horizontal-overflow",
  );
  check(
    await page.getByLabel("Android development status").isVisible(),
    "native-status-visible",
  );
  if (mode === "public") {
    check(
      (await memberIdentity()).status === 401,
      "native-public-screenshot-is-anonymous",
    );
    mkdirSync("docs/qa/android", { recursive: true });
    // This is anonymous methodology, before any credentials are entered.
    const png = execFileSync(
      path.join(sdk, "platform-tools", "adb.exe"),
      ["-s", serial, "exec-out", "screencap", "-p"],
      { timeout: 30000, maxBuffer: 8000000, stdio: ["ignore", "pipe", "pipe"] },
    );
    writeFileSync("docs/qa/android/anonymous-methodology.png", png);
    checkpoint = "native-landscape-layout";
    adb("shell", "settings", "put", "system", "accelerometer_rotation", "0");
    adb("shell", "settings", "put", "system", "user_rotation", "1");
    await delay(800);
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "native-landscape-no-horizontal-overflow",
    );
    adb("shell", "settings", "put", "system", "user_rotation", "0");
    checkpoint = "native-content-deep-link";
    adb(
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "docked://results",
      pkg,
    );
    await page.waitForURL(origin + "/results");
    await page.waitForLoadState("networkidle");
    check(true, "native-content-deep-link");
    checkpoint = "native-back-navigation";
    adb("shell", "input", "keyevent", "4");
    await page.waitForURL(origin + "/methodology");
    check(true, "native-back-navigation");
    adb("reverse", "--remove", "tcp:3000");
    checkpoint = "native-offline-error-screen";
    await restart();
    await page
      .getByRole("heading", { name: "Connection unavailable" })
      .waitFor();
    check(true, "native-offline-error-screen");
    writeFileSync(
      "docs/qa/android/anonymous-offline.png",
      execFileSync(
        path.join(sdk, "platform-tools", "adb.exe"),
        ["-s", serial, "exec-out", "screencap", "-p"],
        {
          timeout: 30000,
          maxBuffer: 8000000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
    adb("reverse", "tcp:3000", "tcp:3000");
    await page.getByRole("button", { name: "Retry local preview" }).click();
    await page.waitForURL(origin + "/home");
    check(true, "native-reconnect-retry");
  } else {
    const config = JSON.parse(
      readFileSync("private-data/hosted-preview/acceptance.json", "utf8"),
    );
    const state = JSON.parse(
      readFileSync("private-data/hosted-preview/state.json", "utf8"),
    );
    const account = config.accounts?.memberB,
      saved = state.accounts?.memberB;
    check(
      config.projectRef === project &&
        config.siteOrigin === origin &&
        account?.email === "docked-preview-memberb-20261003@example.invalid" &&
        !!saved?.id,
      "reserved-real-account",
    );
    checkpoint = "native-login";
    await page.goto(origin + "/login");
    await page.locator('[name="email"]').fill(account.email);
    await page
      .locator('[name="password"]')
      .fill(
        saved.passwordVersion === "recovered"
          ? account.recoveryPassword
          : account.password,
      );
    const response = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/auth" && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const login = await response;
    check(login.status() !== 429, "native-auth-rate-limit-not-hit");
    check(login.status() === 200, "native-genuine-login");
    await page.waitForURL(origin + "/dashboard");
    let identity = await memberIdentity();
    check(
      identity.status === 200 && identity.id === saved.id && identity.private,
      "native-private-member-export",
    );
    await page.goto(origin + "/home");
    check(
      await page.locator('[data-authenticated="true"]').isVisible(),
      "native-authenticated-app-shell",
    );
    for (const route of [
      "/edges",
      "/community",
      "/notifications",
      "/top-docked",
      "/membership",
      "/dashboard",
    ]) {
      checkpoint = `native-screen-${route.slice(1)}`;
      const response = await page.goto(origin + route, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("html.docked-native").waitFor();
      check(
        response?.status() === 200 &&
          (await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          )),
        checkpoint,
      );
    }
    checkpoint = "native-session-persists-process-restart";
    await restart();
    await page.goto(origin + "/dashboard");
    identity = await memberIdentity();
    check(
      identity.status === 200 && identity.id === saved.id,
      "native-session-persists-process-restart",
    );
    await page.goto(origin + "/profile");
    checkpoint = "native-system-share-sheet";
    await page.getByRole("button", { name: "Share link", exact: true }).click();
    await delay(1000);
    const foreground = adb("shell", "dumpsys", "window", "windows");
    check(
      /ChooserActivity|ResolverActivity|Sharesheet/i.test(foreground),
      "native-system-share-sheet",
    );
    adb("shell", "input", "keyevent", "4");
    await page.goto(origin + "/compose");
    checkpoint = "native-photo-picker-opened";
    await page
      .getByRole("button", { name: "Create post", exact: true })
      .click();
    const photo = page.getByRole("button", {
      name: "Choose photo",
      exact: true,
    });
    if (await photo.count()) {
      await photo.click();
      await delay(1000);
      const pickerWindow = adb("shell", "dumpsys", "window", "windows");
      check(
        /PhotoPicker|photopicker|DocumentsActivity/i.test(pickerWindow),
        "native-photo-picker-opened",
      );
      adb("shell", "input", "keyevent", "4");
      await page
        .getByText(
          "Image selection was cancelled, denied or unavailable. You can still use the file chooser.",
          { exact: true },
        )
        .waitFor();
      check(true, "native-photo-picker-cancellation");
      await page
        .getByRole("button", { name: "Take photo", exact: true })
        .click();
      await delay(1000);
      const cameraWindow = adb("shell", "dumpsys", "window", "windows");
      if (/camera|permissioncontroller/i.test(cameraWindow)) {
        adb("shell", "input", "keyevent", "4");
        await page
          .getByText(
            "Image selection was cancelled, denied or unavailable. You can still use the file chooser.",
            { exact: true },
          )
          .waitFor();
        check(true, "native-camera-cancellation-or-permission-denial");
      } else
        checks.push({
          check: "native-camera-launch",
          status: "BLOCKED",
          detailCode: "camera-activity-unavailable-on-emulator",
        });
    } else
      checks.push({
        check: "native-photo-picker-cancellation",
        status: "BLOCKED",
        detailCode: "composer-upload-not-available-under-current-policy",
      });
    await page.goto(origin + "/dashboard");
    checkpoint = "native-logout";
    const signedOut = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/auth" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Log out all sessions", exact: true })
      .click();
    check((await signedOut).status() === 200, "native-logout");
    await page.waitForURL(origin + "/");
    check(
      (await memberIdentity()).status === 401,
      "native-old-session-denied-after-logout",
    );
  }
} catch {
  checks.push({
    check: checkpoint,
    status: "FAIL",
    detailCode: "redacted-see-local-checkpoint",
  });
  process.exitCode = 1;
} finally {
  // Leave network forwarding restored even after the offline check fails.
  try {
    if (sdk) {
      adb("reverse", "tcp:3000", "tcp:3000");
      adb("shell", "settings", "put", "system", "user_rotation", "0");
    }
  } catch {}
  await browser?.close().catch(() => {});
  const result = {
    recordedAt: new Date().toISOString(),
    buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
    platform: "Android36 emulator / actual Capacitor WebView",
    mode,
    checks,
    externalEmailSent: false,
    pushSent: false,
  };
  mkdirSync("docs/qa/android", { recursive: true });
  writeFileSync(
    `docs/qa/android/${mode}-acceptance.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      mode,
      passed: checks.filter((c) => c.status === "PASS").length,
      failed: checks.filter((c) => c.status === "FAIL").length,
      blocked: checks.filter((c) => c.status === "BLOCKED").length,
      checkpoint: checks.some((c) => c.status === "FAIL") ? checkpoint : null,
    }),
  );
}
