import { chromium, expect } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";

// Attach only to a local design-review tab that the owner has opened on Android.
// No app launch, authentication, production requests or purchase submission.
const run = promisify(execFile);
const adb = process.env.DOCKED_ADB;
if (!adb) throw Error("Set DOCKED_ADB to the authorised Android SDK adb.exe");
const origin = "http://127.0.0.1:4189";
const out = "docs/qa/foil-pack-rollout-20261107";
const remoteVideo = `/sdcard/Download/docked-foil-review-${Date.now()}.mp4`;
await mkdir(out, { recursive: true });
const adbRun = (...args) =>
  run(adb, args, { windowsHide: true, maxBuffer: 16000000 });
const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().startsWith(origin + "/"));
if (!page)
  throw Error("Owner must first open the isolated design preview in Chrome");
page.setDefaultTimeout(20000);
const requests = [],
  errors = [],
  checks = [];
page.on("request", (r) => {
  if (r.method() !== "GET" || !r.url().startsWith(origin))
    requests.push({ method: r.method(), url: r.url() });
});
page.on("pageerror", (e) => errors.push(e.message));
const model = (
  await adbRun("shell", "getprop", "ro.product.model")
).stdout.trim();
const android = (
  await adbRun("shell", "getprop", "ro.build.version.release")
).stdout.trim();
const result = {
  status: "running",
  model,
  android,
  startedAt: new Date().toISOString(),
  browser: await page.evaluate(() => navigator.userAgent),
  viewport: await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
  })),
  environment:
    "Physical Samsung Chrome via USB; isolated synthetic local fixture; not installed Docked WebView",
  checks,
  errors,
  requests,
};
const recorder = spawn(
  adb,
  [
    "shell",
    "screenrecord",
    "--time-limit",
    "180",
    "--size",
    "720x1560",
    "--bit-rate",
    "4000000",
    remoteVideo,
  ],
  { windowsHide: true, stdio: "ignore" },
);
const recordingDone = new Promise((resolve) => recorder.once("exit", resolve));
async function capture(name) {
  const { stdout } = await run(adb, ["exec-out", "screencap", "-p"], {
    windowsHide: true,
    encoding: "buffer",
    maxBuffer: 16000000,
  });
  await writeFile(`${out}/samsung-physical-${name}.png`, stdout);
}
async function withinPreview() {
  expect(new URL(page.url()).origin).toBe(origin);
  const focus = (await adbRun("shell", "dumpsys", "window")).stdout.toString();
  if (!/mCurrentFocus=.*com\.android\.chrome/.test(focus))
    throw Error("Phone left Chrome; stop to avoid interrupting the owner");
}
try {
  await withinPreview();
  await page
    .getByRole("link", { name: "View the mobile store", exact: true })
    .click();
  for (const sport of ["nfl", "afl", "nrl"]) {
    await withinPreview();
    const selector = page.getByRole("navigation", {
      name: "Sport",
      exact: true,
    });
    await selector
      .getByRole("button", { name: sport.toUpperCase(), exact: true })
      .click();
    await expect(
      page.locator(`.pack-product [data-foil-variant*=':${sport}:']`),
    ).toHaveCount(6);
    await expect(
      selector.getByRole("button", { name: "NBA", exact: true }),
    ).toHaveCount(0);
    for (const tier of ["STANDARD", "PREMIUM"]) {
      const family = page.locator(`[data-family="${tier}"]`);
      for (const tile of await family.locator(".pack-product").all()) {
        await tile.scrollIntoViewIfNeeded();
        await tile.locator("img").evaluate((el) => el.decode());
        const art = await tile.locator(".foil-pack-art").boundingBox();
        expect(art.width).toBeLessThanOrEqual(117);
        const key = await tile
          .locator(".foil-pack-art")
          .getAttribute("data-foil-variant");
        checks.push({
          kind: "store-artwork",
          key,
          width: art.width,
          height: art.height,
        });
        await page.waitForTimeout(650); // Recorded viewing time, not a readiness test.
      }
      await family.evaluate((el) =>
        scrollTo(0, el.getBoundingClientRect().top + scrollY - 80),
      );
      await page.waitForTimeout(350);
      await capture(`${sport}-${tier.toLowerCase()}-store`);
    }
    const starter = page.locator(`[data-foil-variant="STARTER:${sport}:4"]`);
    await starter.scrollIntoViewIfNeeded();
    await starter.locator("img").evaluate((el) => el.decode());
    await capture(`${sport}-starter`);
    checks.push({ kind: "starter-artwork", key: `STARTER:${sport}:4` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Preview the real purchase-confirmation UI, then cancel without fulfilling.
    const buy = page
      .locator(`[data-foil-variant="PREMIUM:${sport}:9"]`)
      .locator("..")
      .getByRole("button", { name: /Buy/ });
    await buy.click();
    await expect(
      page.locator(".pack-purchase-review .foil-pack-art"),
    ).toHaveAttribute("data-foil-variant", `PREMIUM:${sport}:9`);
    await capture(`${sport}-confirmation`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    checks.push({ kind: "confirmation-and-cancel", sport });
  }
  await page.getByRole("link", { name: "All 21 designs", exact: true }).click();
  for (const [tier, sport, count] of [
    ["STANDARD", "nfl", 1],
    ["STANDARD", "afl", 3],
    ["PREMIUM", "nrl", 9],
  ]) {
    await withinPreview();
    const key = `${tier}:${sport}:${count}`;
    const tile = page
      .locator(".foil-gallery article")
      .filter({ has: page.locator(`[data-foil-variant="${key}"]`) });
    await tile
      .getByRole("button", { name: "Preview opening", exact: true })
      .click();
    await expect(page.locator(".branded-seal .foil-pack-art")).toHaveAttribute(
      "data-foil-variant",
      key,
    );
    await page.locator(".branded-seal img").evaluate((el) => el.decode());
    await capture(`${sport}-${count}-opening`);
    await page.getByRole("button", { name: "Open pack", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal All", exact: true }).click();
    await expect(page.locator(".pack-summary > li")).toHaveCount(count);
    await capture(`${sport}-${count}-summary`);
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .first()
      .click();
    checks.push({ kind: "synthetic-opening-and-summary", key, cards: count });
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  result.status = "passed";
} catch (error) {
  result.status = "failed";
  result.failure = String(error);
  await capture("failure");
} finally {
  // Interrupt only this test's recorder, identified by its unique output path.
  const processes = (
    await adbRun("shell", "ps", "-A", "-o", "PID,ARGS")
  ).stdout.toString();
  const recorderLine = processes
    .split("\n")
    .find((l) => l.includes("screenrecord") && l.includes(remoteVideo));
  const pid = recorderLine?.match(/^\s*(\d+)\s/)?.[1];
  if (pid) await adbRun("shell", "kill", "-2", pid);
  await recordingDone;
  await adbRun("pull", remoteVideo, `${out}/samsung-physical-walkthrough.mp4`);
  result.finishedAt = new Date().toISOString();
  result.video = "samsung-physical-walkthrough.mp4";
  await writeFile(
    `${out}/physical-android.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
  // Disconnect the test driver without closing the owner's browser or tabs.
  process.exit(result.status === "passed" ? 0 : 1);
}
