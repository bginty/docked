// Real GoTrue sessions against the existing disposable loopback acceptance app.
// Never loads .env or hosted identities. Optional review writes stay in local fixtures.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  request,
  chromium,
  expect,
  type APIRequestContext,
} from "@playwright/test";

async function main() {
  const origin = "http://127.0.0.1:3033";
  const local = JSON.parse(
    await readFile("tmp/marketplace-auth/status.private.json", "utf8"),
  );
  assert.equal(local.API_URL, "http://127.0.0.1:55321");
  const database = new URL(local.DB_URL);
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55322");
  const qa = JSON.parse(
    await readFile("tmp/marketplace-auth/fixtures.private.json", "utf8"),
  );
  assert.ok(
    qa.users.every((user: { email: string }) =>
      user.email.endsWith("@example.invalid"),
    ),
  );
  function totp(secret: string) {
    const bits = [...secret.toUpperCase().replace(/=+$/, "")]
      .map((c) =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
          .indexOf(c)
          .toString(2)
          .padStart(5, "0"),
      )
      .join("");
    const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = createHmac("sha1", key).update(counter).digest();
    return String(
      (digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000,
    ).padStart(6, "0");
  }
  const sessions: APIRequestContext[] = [];
  const sql = postgres(local.DB_URL, { max: 1 });
  const creditReview = process.argv.includes("--credit-review");
  const announcementReview = process.argv.includes("--announcement-review");
  const moderationReview = process.argv.includes("--moderation-review");
  const staffRole = process.argv.includes("--staff-role");
  const checks: string[] = [];
  let failure: string | undefined;
  try {
    for (const index of [1, 3]) {
      const session = await request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
        timeout: 120000,
      });
      sessions.push(session);
      const login = await session.post("/api/auth", {
        data: {
          action: "login",
          email: qa.users[index].email,
          password: qa.password,
          app: true,
        },
      });
      assert.equal(login.status(), 200, "Real local fixture login failed");
    }
    const [report] =
      await sql`select id from beta_private.social_reports order by created_at desc limit 1`;
    const paths = [
      "/api/admin/operations?scope=beta",
      "/api/admin/search?q=local&category=members",
      "/api/admin/announcements",
      "/api/admin/credit-requests",
      "/api/admin/moderation-retention",
      "/api/admin/record?category=members&record=" +
        encodeURIComponent(qa.users[1].id),
      ...(report
        ? ["/api/admin/moderation-cases?id=" + encodeURIComponent(report.id)]
        : []),
    ];
    for (const path of paths) {
      for (const session of sessions) {
        const denied = await session.get(path);
        assert.equal(denied.status(), 403, `Member/owner AAL1 denied: ${path}`);
      }
    }
    checks.push(
      "Ordinary member and owner AAL1 denied at every tested administrative HTTP projection",
    );
    const mfa = await sessions[1].post("/api/auth", {
      data: {
        action: "mfa_verify",
        code: totp(qa.totp.secret),
        next: "/admin/operations",
      },
    });
    assert.equal(
      mfa.status(),
      200,
      "Real GoTrue owner MFA verification failed",
    );
    for (const path of paths) {
      const response = await sessions[1].get(path);
      assert.equal(
        response.status(),
        200,
        `Owner AAL2 read: ${path}: ${await response.text()}`,
      );
      assert.match(response.headers()["cache-control"], /no-store/);
      const body = await response.json();
      if (path.includes("/operations"))
        assert.ok(
          body.data?.reference,
          "Authoritative dashboard data required",
        );
      if (path.includes("/record")) {
        assert.equal(body.record.id, qa.users[1].id);
        assert.equal(
          JSON.stringify(body).includes(qa.users[1].email),
          false,
          "Member email must not leak through record projection",
        );
      }
      if (path.includes("/credit-requests"))
        assert.equal(
          body.executionEnabled,
          false,
          "Credit review must not enable issuance",
        );
    }
    checks.push(
      "Real GoTrue owner MFA enables reporting/search/record/announcements/credit-request projections, no-store headers, no member email disclosure, credit execution disabled",
    );
    if (staffRole) {
      assert.equal(
        process.argv.includes("--screenshots"),
        false,
        "Keep role-revocation and copied-browser-session campaigns separate",
      );
      const [original] =
        await sql`select role from beta_private.roles where user_id=${qa.users[3].id}`;
      assert.equal(
        original?.role,
        "owner",
        "Only the existing isolated QA owner role may be temporarily changed",
      );
      try {
        const changed =
          await sql`update beta_private.roles set role='auditor' where user_id=${qa.users[3].id} and role='owner' returning role`;
        assert.equal(changed.length, 1);
        const [admission] =
          await sql`select beta_private.admitted(${qa.users[3].id}::uuid) allowed`;
        assert.equal(
          admission.allowed,
          false,
          "Current friends-beta policy deliberately excludes non-owner privileged roles",
        );
        for (const path of paths) {
          const denied = await sessions[1].get(path);
          assert.equal(
            denied.status(),
            403,
            `Current owner-only beta rejects role-revoked AAL2 identity: ${path}`,
          );
        }
        for (const [path, data] of [
          [
            "/api/admin/announcements",
            {
              requestId: randomUUID(),
              id: randomUUID(),
              action: "create",
              version: 0,
              title: "Denied fixture draft",
              body: "This must never be saved",
              audience: "admitted",
              reason: "Role revocation acceptance",
            },
          ],
          [
            "/api/admin/credit-requests",
            {
              action: "request",
              requestId: randomUUID(),
              recipient: qa.users[1].id,
              amount: 100,
              reason: "Denied role revocation fixture",
              confirmed: true,
            },
          ],
        ] as const) {
          const denied = await sessions[1].post(path, { data });
          assert.equal(
            denied.status(),
            403,
            `Revoked owner mutation denied: ${path}`,
          );
        }
        checks.push(
          "Actual GoTrue AAL2 same-identity role change owner->auditor is immediately denied by current owner-only friends-beta admission, including previously permitted reads and announcement/credit mutations; this is role-revocation acceptance, not positive staff access",
        );
      } finally {
        await sql`update beta_private.roles set role=${original.role} where user_id=${qa.users[3].id}`;
        const [restored] =
          await sql`select role,beta_private.admitted(user_id) allowed from beta_private.roles where user_id=${qa.users[3].id}`;
        assert.equal(restored.role, "owner");
        assert.equal(restored.allowed, true);
      }
      const restored = await sessions[1].get("/api/admin/announcements");
      assert.equal(
        restored.status(),
        200,
        "Original fixture owner access restored without replacing its real AAL2 session",
      );
      checks.push(
        "Local QA role and admission restored in finally; the original real AAL2 session regains authorized read access",
      );
    }
    if (process.argv.includes("--screenshots")) {
      const root = `docs/qa/auth-recovery-20261017/owner-${Date.now()}`;
      await mkdir(root, { recursive: true });
      const browser = await chromium.launch({ channel: "msedge" });
      try {
        const context = await browser.newContext({
          storageState: await sessions[1].storageState(),
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        for (const viewport of [
          { width: 1536, height: 1024 },
          { width: 412, height: 915 },
        ]) {
          await page.setViewportSize(viewport);
          await page.goto(origin + "/admin/operations?scope=beta", {
            waitUntil: "domcontentloaded",
            timeout: 120000,
          });
          await expect(page.locator(".owner-reference-dashboard")).toBeVisible({
            timeout: 60000,
          });
          await expect(
            page.getByText("Total Users", { exact: true }),
          ).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.screenshot({
            path: `${root}/owner-${viewport.width}.png`,
            fullPage: true,
          });
        }
        await context.close();
        checks.push(
          `Real owner AAL2 dashboard rendered against native PostgreSQL at1536/412, no horizontal overflow: ${root}`,
        );
      } finally {
        await browser.close();
      }
      // The browser owns a copied refresh-token jar. Do not reuse its rotated API jar.
      assert.equal(
        creditReview,
        false,
        "Run screenshot and mutation campaigns separately",
      );
    }
    if (announcementReview) {
      const payload = {
        requestId: randomUUID(),
        id: randomUUID(),
        action: "create",
        version: 0,
        title: "Local QA draft only",
        body: "Isolated review fixture. Never send external communications.",
        audience: "admitted",
        reason: "Verify local owner review",
      };
      const denied = await sessions[0].post("/api/admin/announcements", {
        data: payload,
      });
      assert.equal(denied.status(), 403);
      const create = await sessions[1].post("/api/admin/announcements", {
        data: payload,
      });
      assert.equal(
        create.status(),
        200,
        "Announcement create: " + (await create.text()),
      );
      let draft = await create.json();
      const duplicate = await sessions[1].post("/api/admin/announcements", {
        data: payload,
      });
      assert.equal(duplicate.status(), 200);
      assert.deepEqual(await duplicate.json(), draft);
      for (const action of ["submit", "approve"]) {
        const response = await sessions[1].post("/api/admin/announcements", {
          data: {
            ...payload,
            requestId: randomUUID(),
            action,
            version: draft.version,
          },
        });
        assert.equal(
          response.status(),
          200,
          `Announcement ${action}: ${await response.text()}`,
        );
        draft = await response.json();
      }
      assert.equal(draft.status, "approved");
      const history = await sessions[1].get(
        `/api/admin/announcements?id=${draft.id}`,
      );
      assert.equal(history.status(), 200);
      assert.equal((await history.json()).length, 3);
      checks.push(
        "Native announcement draft create/exact retry/submit/owner approval and three-event history; member mutation denied; no delivery action invoked",
      );
      const health = { request: randomUUID() };
      const deniedHealth = await sessions[0].post("/api/admin/health", {
        data: health,
      });
      assert.equal(deniedHealth.status(), 403);
      for (let retry = 0; retry < 2; retry++) {
        const result = await sessions[1].post("/api/admin/health", {
          data: health,
        });
        assert.equal(
          result.status(),
          200,
          `Health record: ${await result.text()}`,
        );
        assert.equal((await result.json()).recorded, true);
      }
      checks.push(
        "Real owner MFA health observation POST and identical-key retry recorded; member denied; health values remain actual pass/fail observations",
      );
    }
    if (moderationReview) {
      const post = await sessions[0].post("/api/community", {
        data: {
          action: "post",
          kind: "discussion",
          sport: "nfl",
          body: "Isolated native moderation recovery fixture",
          cardIds: [],
          mediaIds: [],
          idempotencyKey: randomUUID(),
        },
      });
      assert.equal(post.status(), 200, "Fixture post: " + (await post.text()));
      const postId = (await post.json()).id;
      assert.ok(postId);
      const reportResponse = await sessions[0].post("/api/community", {
        data: {
          action: "report",
          postId,
          reason: "other",
          details: "Isolated local moderation acceptance fixture",
        },
      });
      assert.equal(reportResponse.status(), 200);
      const [reported] =
        await sql`select id from beta_private.social_reports where target_id=${postId} and target_type='post'`;
      assert.ok(reported);
      const casePath = `/api/admin/moderation-cases?id=${reported.id}`;
      assert.equal((await sessions[0].get(casePath)).status(), 403);
      const record = await sessions[1].get(casePath);
      assert.equal(record.status(), 200, await record.text());
      let version = 0;
      for (const action of ["update", "hide", "restore"]) {
        const result = await sessions[1].post("/api/admin/moderation-cases", {
          data: {
            requestId: randomUUID(),
            reportId: reported.id,
            version,
            action,
            assignee: null,
            severity: "low",
            status: "investigating",
            resolution: "pending",
            reason: "Isolated native case review and reversible hold",
          },
        });
        assert.equal(
          result.status(),
          200,
          `Case ${action}: ${await result.text()}`,
        );
        version = (await result.json()).version;
      }
      const remove = await sessions[1].post("/api/community", {
        data: {
          action: "moderate",
          reportId: reported.id,
          targetType: "post",
          targetId: postId,
          decision: "remove",
          reason: "Isolated native evidence preservation verification",
        },
      });
      assert.equal(
        remove.status(),
        200,
        "Moderation removal: " + (await remove.text()),
      );
      const retained = await sessions[1].get("/api/admin/moderation-retention");
      assert.equal(retained.status(), 200);
      let evidence = (await retained.json()).records.find(
        (row: { target_id: string }) => row.target_id === postId,
      );
      assert.equal(evidence?.state, "held");
      for (const action of ["review", "restore"]) {
        const result = await sessions[1].post(
          "/api/admin/moderation-retention",
          {
            data: {
              requestId: randomUUID(),
              targetType: "post",
              targetId: postId,
              version: evidence.version,
              action,
              reason: "Isolated native retained evidence review and restore",
              confirmation: "",
            },
          },
        );
        assert.equal(
          result.status(),
          200,
          `Retention ${action}: ${await result.text()}`,
        );
        evidence = await result.json();
      }
      assert.equal(evidence.state, "restored");
      checks.push(
        "Native member report -> owner case update/hide/restore -> audited moderation removal retains evidence -> retention review/restore; ordinary member case API denied",
      );
    }
    if (creditReview) {
      const [before] =
        await sql`select md5(document::text) hash from credits_sandbox.state where id`;
      const data = {
        action: "request",
        requestId: randomUUID(),
        recipient: qa.users[1].id,
        amount: 100,
        reason: "Isolated QA request review only",
        confirmed: true,
      };
      const denied = await sessions[0].post("/api/admin/credit-requests", {
        data,
      });
      assert.equal(denied.status(), 403);
      const [created, duplicate] = await Promise.all(
        [0, 1].map(() =>
          sessions[1].post("/api/admin/credit-requests", { data }),
        ),
      );
      assert.equal(created.status(), 200, "Create: " + (await created.text()));
      assert.equal(
        duplicate.status(),
        200,
        "Concurrent duplicate: " + (await duplicate.text()),
      );
      const saved = await created.json();
      assert.deepEqual(await duplicate.json(), saved);
      assert.equal(saved.status, "requested");
      const retry = await sessions[1].post("/api/admin/credit-requests", {
        data,
      });
      assert.equal(retry.status(), 200, "Retry: " + (await retry.text()));
      assert.deepEqual(await retry.json(), saved);
      const approvals = await Promise.all(
        [0, 1].map(() =>
          sessions[1].post("/api/admin/credit-requests", {
            data: {
              action: "approve",
              requestId: randomUUID(),
              id: saved.id,
              revision: saved.revision,
              reason: "Isolated QA approves review without issuance",
              confirmed: true,
            },
          }),
        ),
      );
      assert.deepEqual(
        approvals.map((response) => response.status()).sort(),
        [200, 409],
        "Concurrent same-revision reviews: one succeeds, one conflicts",
      );
      const approve = approvals.find((response) => response.status() === 200)!;
      assert.equal(approve.status(), 200, "Approve: " + (await approve.text()));
      assert.equal((await approve.json()).status, "approved");
      const [after] =
        await sql`select md5(document::text) hash from credits_sandbox.state where id`;
      assert.equal(
        after.hash,
        before.hash,
        "Review must not change credits/commerce document",
      );
      checks.push(
        "Real owner MFA concurrent duplicate request creates one result; exact retry matches; concurrent same-revision approvals yield200/409; member mutation denied; entire credits/commerce document unchanged; no issuance",
      );
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Acceptance failed";
    process.exitCode = 1;
  } finally {
    await Promise.all(sessions.map((session) => session.dispose()));
    await sql.end();
    const result = {
      at: new Date().toISOString(),
      passed: !failure,
      scope:
        "Real local GoTrue -> Next HTTP -> restricted Postgres, isolated QA users",
      checks,
      error: failure,
      hosted: false,
      applicationMutations:
        creditReview || announcementReview || moderationReview
          ? "Isolated local social, review and health records only; no ledger issuance"
          : staffRole
            ? "Isolated QA owner role temporarily changed to auditor and restored in finally"
            : false,
      positiveNonOwnerStaffAccess: staffRole
        ? "Blocked by deliberate owner-only privileged friends-beta admission; activation/policy decision required"
        : undefined,
    };
    await writeFile(
      staffRole
        ? "docs/qa/auth-recovery-20261017/admin-staff-role.json"
        : "docs/qa/auth-recovery-20261017/admin-authenticated.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Local acceptance failed",
  );
  process.exitCode = 1;
});
