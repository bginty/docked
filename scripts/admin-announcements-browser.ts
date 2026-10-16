import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import type {
  AnnouncementDraft,
  AnnouncementMutation,
} from "../src/core/admin-announcements";
async function run() {
  const script = await bundleCommunityFixture(
    "tests/fixtures/admin-announcements.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.*?\.css)"/g,
    ),
  ]
    .map((match) => readFileSync("src/app/" + match[1], "utf8"))
    .join("\n");
  const actor = randomUUID();
  const drafts: AnnouncementDraft[] = [];
  const receipts = new Map<string, AnnouncementDraft>();
  let requests = 0;
  let failAfterSave = true;
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith("/api/admin/announcements")) {
      response.setHeader("Content-Type", "application/json");
      if (request.method === "GET") {
        response.end(
          JSON.stringify(
            request.url.includes("?id=")
              ? []
              : {
                  drafts,
                  actor,
                  canWrite: true,
                  canReview: true,
                  canApproveOwn: true,
                  hasMore: false,
                  page: 1,
                },
          ),
        );
        return;
      }
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const input = JSON.parse(body) as AnnouncementMutation;
      requests++;
      let result = receipts.get(input.requestId);
      if (!result) {
        const index = drafts.findIndex((draft) => draft.id === input.id);
        result = {
          id: input.id,
          title: input.title,
          body: input.body,
          audience: "admitted",
          version: input.version + 1,
          created_by: actor,
          updated_by: actor,
          last_edited_by: actor,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status:
            input.action === "archive"
              ? "archived"
              : input.action === "submit"
                ? "in_review"
                : "draft",
        };
        if (index < 0) drafts.push(result);
        else drafts[index] = result;
        receipts.set(input.requestId, result);
      }
      if (failAfterSave) {
        failAfterSave = false;
        response.statusCode = 503;
        response.end(
          JSON.stringify({
            error: "Synthetic lost response after saved draft",
          }),
        );
        return;
      }
      response.end(JSON.stringify(result));
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated announcement acceptance</title><style>${css}body{background:#020d1b;color:white}.admin-workspace{max-width:1000px;margin:auto;padding:16px}fieldset{min-width:0;border:0;padding:0}</style></head><body><div id="root"></div><script>${script}</script></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No local server");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const out = "docs/qa/admin-announcements";
  mkdirSync(out, { recursive: true });
  const checks: unknown[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await expect(page.getByText("No saved drafts on this page.")).toBeVisible();
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Synthetic beta announcement");
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("An isolated fixture. No members receive this draft.");
    await page
      .getByLabel("Reason for this change")
      .fill("Prepare isolated test");
    await page
      .getByRole("button", { name: "Preview announcement", exact: true })
      .click();
    assert.equal(requests, 0, "preview does not persist or send");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Retry same save request" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Title", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Retry same save request" }).click();
    await expect(
      page.getByText("Saved securely. No announcement has been sent."),
    ).toBeVisible();
    assert.equal(drafts.length, 1);
    assert.equal(receipts.size, 1);
    assert.equal(requests, 2);
    await page.reload();
    await page
      .getByRole("button", { name: "Synthetic beta announcement", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toHaveValue("An isolated fixture. No members receive this draft.");
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Unsaved change");
    await expect(
      page.getByRole("button", { name: "New draft", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Discard unsaved changes" }).click();
    await expect(
      page.getByRole("textbox", { name: "Title", exact: true }),
    ).toHaveValue("Synthetic beta announcement");
    await page
      .getByLabel("Reason for this change")
      .fill("Ready for independent review");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(
      page.getByRole("button", { name: "Approve draft only" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve draft only" }),
    ).toBeDisabled();
    await page.getByLabel("Reason for this change").fill("Archive test draft");
    await page
      .getByRole("button", { name: "Archive draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Restore as draft", exact: true }),
    ).toBeVisible();
    for (const width of [412, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const axe = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        axe.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
        [],
      );
      await page.screenshot({
        path: `${out}/announcement-${width}.png`,
        fullPage: true,
      });
      checks.push({ width, overflow: false, seriousCriticalAxe: 0 });
    }
    assert.deepEqual(errors, []);
    writeFileSync(
      `${out}/acceptance.json`,
      JSON.stringify(
        {
          synthetic: true,
          hosted: false,
          checks,
          requests,
          uniqueReceipts: receipts.size,
          drafts: drafts.length,
          errors,
          journeys: [
            "preview without write",
            "uncertain save exact retry",
            "reload persistence",
            "discard unsaved edit",
            "submit staff review",
            "owner approval requires reason",
            "archive",
            "responsive accessibility",
          ],
        },
        null,
        2,
      ),
    );
    console.log("Announcement browser acceptance passed");
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
void run();
