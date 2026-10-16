import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import type {
  ModerationCase,
  ModerationCaseView,
} from "../src/core/moderation-cases";
import type { RetentionRecord } from "../src/core/moderation-retention";
async function run() {
  const script = await bundleCommunityFixture(
    "tests/fixtures/moderation-workflow.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.*?\.css)"/g,
    ),
  ]
    .map((m) => readFileSync("src/app/" + m[1], "utf8"))
    .join("\n");
  const actor = "10000000-0000-4000-8000-000000000002",
    report = "10000000-0000-4000-8000-000000000001";
  let caseRow: ModerationCase | null = null,
    fail = true,
    retentionRequests = 0;
  let held: RetentionRecord | null = {
    target_type: "post",
    target_id: "10000000-0000-4000-8000-000000000003",
    state: "held",
    version: 1,
    reason: "Synthetic removed post retained for review",
    actor,
    review_due_at: new Date(Date.now() + 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    policy_version: "2026-10-11-beta-rc3",
  };
  const receipts = new Map<string, RetentionRecord>();
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/api/admin/")) {
      res.setHeader("Content-Type", "application/json");
      if (req.url.includes("moderation-cases")) {
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) body += String(chunk);
          const p = JSON.parse(body);
          caseRow = {
            report_id: report,
            assignee: p.assignee,
            severity: p.severity,
            status: p.status,
            resolution: p.resolution,
            version: (caseRow?.version ?? 0) + 1,
            content_hold:
              p.action === "hide"
                ? true
                : p.action === "restore"
                  ? false
                  : (caseRow?.content_hold ?? false),
            review_due_at:
              p.action === "hide" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };
          res.end(JSON.stringify(caseRow));
          return;
        }
        const view: ModerationCaseView = {
          case: caseRow,
          actor,
          canWrite: true,
          canAssign: true,
          staff: [{ id: actor, name: "Fixture reviewer" }],
          events: [],
          targetType: "post",
          targetStatus: caseRow?.content_hold ? "removed" : "visible",
          reportStatus: "open",
        };
        res.end(JSON.stringify(view));
        return;
      }
      if (req.method === "GET") {
        res.end(
          JSON.stringify({
            records: held ? [held] : [],
            page: 1,
            hasMore: false,
            canManage: true,
          }),
        );
        return;
      }
      let body = "";
      for await (const chunk of req) body += String(chunk);
      const p = JSON.parse(body);
      retentionRequests++;
      let receipt = receipts.get(p.requestId);
      if (!receipt) {
        if (!held) throw Error("Missing fixture");
        receipt = {
          ...held,
          version: held.version + 1,
          state:
            p.action === "restore"
              ? "restored"
              : p.action === "erase"
                ? "erased"
                : "held",
        };
        receipts.set(p.requestId, receipt);
        held = receipt.state === "held" ? receipt : null;
      }
      if (fail) {
        fail = false;
        res.statusCode = 503;
        res.end(
          JSON.stringify({
            error: "Synthetic lost response. Retry same review.",
          }),
        );
        return;
      }
      res.end(JSON.stringify(receipt));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moderation acceptance</title><style>${css}body{background:#020d1b;color:#eaf2ff}.app-shell{max-width:1050px;margin:auto;padding:20px}.app-panel{margin:16px 0}.form-stack{--ink:#eaf2ff;--surface:#06182b;--muted:#b5c5d9;--line:#305170;--surface-hover:#102b45}fieldset{min-width:0}ul{padding-left:20px}.button{white-space:normal}</style></head><body><div id="root"></div><script>${script}</script></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No server");
  const browser = await chromium.launch({ channel: "msedge", headless: true }),
    out = "docs/qa/moderation-workflow";
  mkdirSync(out, { recursive: true });
  try {
    const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByRole("button", { name: "Open case workflow" }).click();
    await page.getByLabel("Assigned reviewer").selectOption(actor);
    await page
      .getByRole("combobox", { name: "Severity", exact: true })
      .selectOption("high");
    await page
      .getByRole("combobox", { name: "Case status", exact: true })
      .selectOption("investigating");
    await page
      .getByLabel("Audited case reason")
      .fill("Review a synthetic report");
    await page.getByRole("button", { name: "Save case review" }).click();
    await page
      .getByLabel("Audited case reason")
      .fill("Hide evidence while investigating");
    await page.getByRole("button", { name: "Hide while under review" }).click();
    await page
      .getByRole("button", { name: "Discard changes and reload case" })
      .click();
    await page
      .getByLabel("Audited case reason")
      .fill("Release operational hold without restoring removed content");
    await expect(
      page.getByRole("button", { name: "Release this content hold" }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Release this content hold" })
      .click();
    await page.getByRole("button", { name: "Open retention queue" }).click();
    await page.getByRole("button", { name: /post · 10000000/ }).click();
    await page
      .getByRole("textbox", { name: "Evidence review reason" })
      .fill("Review synthetic incident under approved policy");
    await expect(
      page.getByRole("button", { name: "Confirm evidence erasure" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Continue hold · review in 90 days" })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry same review" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Evidence review reason" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Retry same review" }).click();
    await expect(
      page.getByText("Audited evidence review saved."),
    ).toBeVisible();
    assert.equal(retentionRequests, 2);
    assert.equal(receipts.size, 1);
    await page.getByRole("button", { name: /post · 10000000/ }).click();
    const checks = [];
    for (const width of [360, 412, 1024, 1440]) {
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
        path: `${out}/moderation-${width}.png`,
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
          retentionRequests,
          uniqueReceipts: receipts.size,
          errors,
          journeys: [
            "assign severity and review",
            "hide evidence",
            "release hold after source removal",
            "retention reason required",
            "erasure typed confirmation required",
            "uncertain review retries same request",
            "responsive keyboard-accessible controls",
          ],
        },
        null,
        2,
      ),
    );
    console.log("Moderation browser acceptance passed");
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
void run();
