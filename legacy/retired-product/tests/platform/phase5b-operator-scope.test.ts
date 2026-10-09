import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assertPhase5bAccount,
  assertPhase5bConnection,
  phase5bProject,
  phase5bOrganization,
  type Phase5bJournal,
} from "../../scripts/hosted-preview/phase5b-scope";
test("Phase5B acceptance cannot target a preserved account, real address, duplicate roster or erased identity", () => {
  const runId = randomUUID();
  const j: Phase5bJournal = {
    runId,
    createdAt: new Date().toISOString(),
    baselineIds: Array.from({ length: 4 }, () => randomUUID()),
    baselineHash: "a".repeat(64),
    email: `docked-phase5b-operator-${runId}@example.invalid`,
    password: "fixture",
    id: randomUUID(),
  };
  assert.doesNotThrow(() => assertPhase5bAccount(j));
  for (const invalid of [
    { ...j, id: j.baselineIds[0] },
    { ...j, email: "person@example.com" },
    { ...j, baselineIds: [...j.baselineIds.slice(0, 3), j.baselineIds[0]] },
    { ...j, erased: true },
    { ...j, id: undefined },
  ])
    assert.throws(() => assertPhase5bAccount(invalid));
});
test("Phase5B transport binds exact Preview project, org, host and session pooler user", () => {
  const c = {
    projectRef: phase5bProject,
    organizationId: phase5bOrganization,
    supabaseUrl: `https://${phase5bProject}.supabase.co`,
    databaseUrl: `postgresql://${"postgres." + phase5bProject}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  };
  assert.doesNotThrow(() => assertPhase5bConnection(c));
  for (const invalid of [
    { ...c, projectRef: "other" },
    { ...c, organizationId: "other" },
    { ...c, databaseUrl: c.databaseUrl.replace(":5432", ":6543") },
    {
      ...c,
      databaseUrl: c.databaseUrl.replace(
        `postgres.${phase5bProject}`,
        "postgres.other",
      ),
    },
    { ...c, supabaseUrl: "https://example.com" },
  ])
    assert.throws(() => assertPhase5bConnection(invalid));
});
