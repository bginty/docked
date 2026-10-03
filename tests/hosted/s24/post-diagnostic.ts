import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  accounts,
  executionGuard,
  ORIGIN,
  publicEvidence,
  check,
} from "./guard";
import { api, guardBrowser, login } from "./helpers";

async function run() {
  executionGuard();
  const member = accounts().memberA;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 390, height: 844 },
    timezoneId: "Australia/Sydney",
  });
  const origins = await guardBrowser(context);
  const page = await context.newPage();
  const errors: Array<{
    type: string;
    reactCode: string | null;
    phase: string;
  }> = [];
  let phase = "login",
    postId: string | undefined;
  const record = (type: string, text: string) =>
    errors.push({
      type,
      reactCode: text.match(/Minified React error #(\d+)/)?.[1] ?? null,
      phase,
    });
  page.on("console", (message) => {
    if (message.type() === "error") record("console", message.text());
  });
  page.on("pageerror", (error) => record("pageerror", error.message));
  try {
    await login(page, member);
    phase = "create-qa-discussion";
    const response = await api(page.request, "/api/community", {
      action: "post",
      kind: "discussion",
      body: `HTTPS PREVIEW timestamp hydration diagnostic ${randomUUID()}. Disposable QA discussion only; no sports or performance claim.`,
      mediaIds: [],
      promotional: false,
      idempotencyKey: randomUUID(),
    });
    const value = await response.json();
    check(
      response.status() === 200 && typeof value.id === "string",
      "diagnostic-post-created",
    );
    postId = value.id;
    phase = "real-social-post-detail";
    await page.goto(`/community/posts/${postId}`, { waitUntil: "load" });
    await page.locator("time").first().waitFor({ state: "visible" });
    await page.waitForTimeout(1000);
    origins();
  } finally {
    phase = "cleanup";
    if (postId) {
      const removed = await api(page.request, "/api/community", {
        action: "delete_post",
        postId,
      });
      check(removed.status() === 200, "diagnostic-post-removed");
    }
    await writeFile(
      path.join(publicEvidence, `post-hydration-diagnostic-${Date.now()}.json`),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin: ORIGIN,
          timezone: "Australia/Sydney",
          genuineDisposablePost: !!postId,
          errors,
        },
        null,
        2,
      ),
    );
    await browser.close();
  }
  process.stdout.write(
    JSON.stringify({
      status: errors.length ? "BROWSER_ERRORS" : "PASS",
      errors,
    }) + "\n",
  );
}
run().catch(() => {
  process.stderr.write("SAFE_POST_DIAGNOSTIC_FAILED\n");
  process.exitCode = 1;
});
