import test from "node:test";
import assert from "node:assert/strict";
import { runGoogleReconciliationServices } from "../../src/server/google-reconciliation-services";

test("closed billing services do not connect or run jobs", async () => {
  let calls = 0;
  const run = async () => {
    calls++;
    return { attentionRequired: false };
  };
  await assert.rejects(
    runGoogleReconciliationServices({}, { legacy: run, commercial: run }),
    /disabled/,
  );
  assert.equal(calls, 0);
});

test("existing legacy scheduler keeps dormant commercial jobs closed", async () => {
  let commercialCalls = 0;
  const health = await runGoogleReconciliationServices(
    {
      DOCKED_GOOGLE_RECONCILIATION_ENABLED: "true",
      DOCKED_COMMERCIAL_SERVICE: "false",
    },
    {
      legacy: async () => ({ attentionRequired: false, completed: 2 }),
      commercial: async () => {
        commercialCalls++;
        return { attentionRequired: false };
      },
    },
  );
  assert.equal(commercialCalls, 0);
  assert.equal(health.services.legacy.completed, 2);
  assert.equal(health.completed, 2);
  assert.equal(health.attentionRequired, false);
});

test("commercial refund recovery continues with checkout disabled", async () => {
  let legacyCalls = 0;
  const health = await runGoogleReconciliationServices(
    { DOCKED_COMMERCIAL_SERVICE: "true", DOCKED_COMMERCIAL_CHECKOUT: "false" },
    {
      legacy: async () => {
        legacyCalls++;
        return { attentionRequired: false };
      },
      commercial: async () => ({ attentionRequired: true, overdue: 1 }),
    },
  );
  assert.equal(legacyCalls, 0);
  assert.equal(health.services.commercial.overdue, 1);
  assert.equal(health.attentionRequired, true);
});

test("one queue outage does not prevent the other queue from recovering", async () => {
  let recovered = false;
  await assert.rejects(
    runGoogleReconciliationServices(
      {
        DOCKED_GOOGLE_RECONCILIATION_ENABLED: "true",
        DOCKED_COMMERCIAL_SERVICE: "true",
      },
      {
        legacy: async () => {
          throw Error("private provider error");
        },
        commercial: async () => {
          recovered = true;
          return { attentionRequired: false, completed: 1 };
        },
      },
    ),
    /deferred; durable jobs retained/,
  );
  assert.equal(recovered, true);
});
