import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assertPhase5cAccount,
  assertPhase5cConnection,
  phase5cProject,
  phase5cOrganization,
  type Phase5cJournal,
} from "../../scripts/hosted-preview/phase5c-scope";
test("Phase5C acceptance cannot target a preserved account, real address, duplicate roster or erased identity", () => {
  const runId = randomUUID();
  const j: Phase5cJournal = {
    runId,
    createdAt: new Date().toISOString(),
    baselineIds: Array.from({ length: 4 }, () => randomUUID()),
    baselineHash: "a".repeat(64),
    email: `docked-phase5c-operator-${runId}@example.invalid`,
    password: "fixture",
    id: randomUUID(),
  };
  assert.doesNotThrow(() => assertPhase5cAccount(j));
  for (const invalid of [
    { ...j, id: j.baselineIds[0] },
    { ...j, email: "person@example.com" },
    { ...j, baselineIds: [...j.baselineIds.slice(0, 3), j.baselineIds[0]] },
    { ...j, erased: true },
    { ...j, id: undefined },
  ])
    assert.throws(() => assertPhase5cAccount(invalid));
});
test("Phase5C transport binds exact Preview project, org, host and session pooler user", () => {
  const c = {
    projectRef: phase5cProject,
    organizationId: phase5cOrganization,
    supabaseUrl: `https://${phase5cProject}.supabase.co`,
    databaseUrl: `postgresql://${"postgres." + phase5cProject}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  };
  assert.doesNotThrow(() => assertPhase5cConnection(c));
  for (const invalid of [
    { ...c, projectRef: "other" },
    { ...c, organizationId: "other" },
    { ...c, databaseUrl: c.databaseUrl.replace(":5432", ":6543") },
    {
      ...c,
      databaseUrl: c.databaseUrl.replace(
        `postgres.${phase5cProject}`,
        "postgres.other",
      ),
    },
    { ...c, supabaseUrl: "https://example.com" },
  ])
    assert.throws(() => assertPhase5cConnection(invalid));
});
