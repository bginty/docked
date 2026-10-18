// Actual HTTP/Auth checks, exclusively called by the pinned loopback harness.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { APIRequestContext } from "@playwright/test";
export async function verifyBetaTradingAuth(
  sql: Sql,
  contexts: APIRequestContext[],
  members: string[],
) {
  const owner = contexts[3],
    member = contexts[0];
  const report = await owner.get("/api/admin/marketplace");
  assert.equal(report.status(), 200, await report.text());
  const initial = await report.json();
  assert.equal((await member.get("/api/admin/marketplace")).status(), 403);
  const command = {
    action: "pause",
    paused: true,
    revision: Number(initial.control.revision),
    request: randomUUID(),
    reason: "LOCAL authenticated acceptance pause",
  };
  const denied = await member.post("/api/admin/marketplace", { data: command });
  assert.equal(denied.status(), 400);
  assert.equal(
    (
      await owner.post("/api/admin/marketplace", {
        data: command,
        headers: { Origin: "https://untrusted.invalid" },
      })
    ).status(),
    403,
  );
  const [before] =
    await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
  const paused = await owner.post("/api/admin/marketplace", { data: command });
  assert.equal(paused.status(), 200, await paused.text());
  const p = await paused.json();
  assert.equal(p.control.paused, true);
  assert.equal(
    (await (await member.get("/api/marketplace")).json()).state.tradingEnabled,
    false,
  );
  const attempt = await member.post("/api/marketplace", {
    data: {
      request: randomUUID(),
      command: { kind: "list", card: "local-paused-probe", price: 100 },
    },
  });
  assert.equal(attempt.status(), 400);
  const privateAttempt = await member.post("/api/community", {
    data: {
      action: "card_offer",
      request: randomUUID(),
      command: {
        kind: "private-offer",
        card: "local-paused-probe",
        price: 100,
      },
    },
  });
  assert.equal(privateAttempt.status(), 403);
  const resumed = await owner.post("/api/admin/marketplace", {
    data: {
      ...command,
      paused: false,
      revision: Number(p.control.revision),
      request: randomUUID(),
      reason: "LOCAL acceptance resume",
    },
  });
  assert.equal(resumed.status(), 200, await resumed.text());
  assert.equal(
    (await (await member.get("/api/marketplace")).json()).state.tradingEnabled,
    true,
  );
  await sql`update credits_sandbox.trading_members set enabled=false where user_id=${members[0]}::uuid`;
  try {
    assert.equal(
      (await (await member.get("/api/marketplace")).json()).state
        .tradingEnabled,
      false,
    );
  } finally {
    await sql`update credits_sandbox.trading_members set enabled=true where user_id=${members[0]}::uuid`;
  }
  const [after] =
    await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
  assert.deepEqual(after, before);
  return "Actual local Auth/HTTP: owner-MFA pause/resume; member and cross-origin control denial; public and private requests blocked while paused; trading allowlist enforced; controls preserve asset state";
}
