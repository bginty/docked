import { test } from "node:test";
import assert from "node:assert/strict";
import {
  healthOrigin,
  applyHealthObservations,
  type HealthObservation,
} from "../../src/core/owner-health";
test("health probes cannot choose third-party, credentialed or arbitrary hosted origins", () => {
  assert.equal(
    healthOrigin("https://docked.com.au", true),
    "https://docked.com.au",
  );
  assert.equal(
    healthOrigin("http://127.0.0.1:3023", false),
    "http://127.0.0.1:3023",
  );
  for (const value of [
    "https://example.com",
    "https://docked.com.au.evil.test",
    "https://x:d@docked.com.au",
    "https://docked.com.au/path",
    "https://docked.com.au/?x=y",
    "http://169.254.169.254",
    "http://127.0.0.1:3023",
  ])
    assert.throws(() => healthOrigin(value, true));
});
test("health evidence expires, rejects future timestamps and never upgrades unobserved services", () => {
  const at = Date.parse("2026-10-17T00:00:00Z");
  const items = [
    {
      id: "api" as const,
      label: "API",
      status: "unknown" as const,
      checkedAt: null,
      detail: "Unverified",
      href: "/admin",
    },
    {
      id: "android" as const,
      label: "Android",
      status: "unknown" as const,
      checkedAt: null,
      detail: "Unverified",
      href: "/admin",
    },
  ];
  const row: HealthObservation = {
    service: "api",
    status: "passed",
    code: "matched",
    statusCode: 200,
    durationMs: 30,
    checkedAt: new Date(at).toISOString(),
    expiresAt: new Date(at + 300000).toISOString(),
  };
  assert.equal(
    applyHealthObservations(items, [row], at + 1)[0].status,
    "passed",
  );
  assert.equal(
    applyHealthObservations(items, [row], at + 1)[1].status,
    "unknown",
  );
  assert.equal(
    applyHealthObservations(items, [row], at - 1)[0].status,
    "unknown",
  );
  assert.equal(
    applyHealthObservations(items, [row], at + 300000)[0].status,
    "unknown",
  );
  assert.equal(
    applyHealthObservations(
      items,
      [{ ...row, expiresAt: "invalid" }],
      at + 1,
    )[0].status,
    "unknown",
  );
  assert.equal(
    applyHealthObservations(items, [{ ...row, status: "failed" }], at + 1)[0]
      .status,
    "failed",
  );
});
