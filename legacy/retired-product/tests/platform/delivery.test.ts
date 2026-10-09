import { test } from "node:test";
import assert from "node:assert/strict";
import { unsubscribeToken, retryIsSafe } from "../../src/core/delivery";
import { ResendEmail } from "../../src/providers/email";
import { dispatchDecision } from "../../src/core/notifications";
import { LocalMailSink } from "../../src/providers/local-mail";
import { mkdtemp, readdir, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("retry unsubscribe payload is stable for provider idempotency and distinct across recipients", () => {
  const secret = "s".repeat(32);
  assert.equal(
    unsubscribeToken("one", "user", secret),
    unsubscribeToken("one", "user", secret),
  );
  assert.notEqual(
    unsubscribeToken("one", "user", secret),
    unsubscribeToken("one", "other", secret),
  );
  assert.throws(() => unsubscribeToken("one", "user", "weak"));
  assert.equal(
    retryIsSafe("2026-10-02T00:00:00Z", new Date("2026-10-03T00:00:00Z")),
    false,
  );
});
test("preview email adapter makes zero external calls even if sending flag is true", async () => {
  let calls = 0;
  const old = process.env.APP_ENV;
  process.env.APP_ENV = "preview";
  try {
    const mail = new ResendEmail(async () => {
      calls++;
      return new Response("{}");
    });
    await assert.rejects(() =>
      mail.send({
        to: "fixture@example.test",
        subject: "Test",
        text: "Test",
        unsubscribeUrl: "http://localhost/unsubscribe",
        idempotencyKey: "fixture",
      }),
    );
    assert.equal(calls, 0);
  } finally {
    if (old === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = old;
  }
});
test("malformed event start and unknown budget cannot dispatch", () => {
  const input = {
    now: "2026-10-02T02:00:00Z",
    environment: "production",
    sendingEnabled: true,
    consent: true,
    preferences: {
      timezone: "Australia/Melbourne",
      paused: false,
      digest: "weekly" as const,
      edgeAlerts: true,
      education: false,
      quietStart: 21,
      quietEnd: 8,
    },
    kind: "edge" as const,
    eligible: true,
    fresh: true,
    startAt: "invalid",
    expiresAt: "2026-10-02T02:03:00Z",
    sentToday: 0,
    globalBudgetRemaining: 100,
  };
  assert.equal(dispatchDecision(input), "edge_invalid");
  assert.equal(
    dispatchDecision({
      ...input,
      startAt: "2026-10-02T12:00:00Z",
      globalBudgetRemaining: NaN,
    }),
    "budget_unknown",
  );
});

test("local mail sink never sends, rejects real recipients and enforces idempotent bodies", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "docked-mail-test-"));
  const sink = new LocalMailSink(directory),
    message = {
      to: "fixture@example.test",
      subject: "Fixture",
      text: "Never sent",
      unsubscribeUrl: "http://localhost/unsubscribe",
      idempotencyKey: "test-only",
    };
  try {
    const first = await sink.send(message);
    assert.equal((await sink.send(message)).id, first.id);
    await assert.rejects(
      () => sink.send({ ...message, text: "Changed body" }),
      /mismatch/,
    );
    await assert.rejects(
      () => sink.send({ ...message, to: "someone@example.com" }),
      /reserved/,
    );
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.match(
      await readFile(path.join(directory, files[0]), "utf8"),
      /NEVER SENT/,
    );
  } finally {
    for (const file of await readdir(directory))
      await unlink(path.join(directory, file));
    await rmdir(directory);
  }
});
