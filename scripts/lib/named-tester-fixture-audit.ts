import assert from "node:assert/strict";
import { checksumQuery } from "./reviewed-inventory";

/** Account for one explicit, disconnected fixture activation, preserving every prior event. */
export function verifyNamedTesterFixtureAudit(
  values: (sql: string) => any[],
  baseline: any[],
) {
  const events = values(
    "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from beta_packs.events t",
  )[0];
  assert.equal(
    events.length,
    2,
    "Only original adoption and local control activation permitted",
  );
  const event = events[1];
  assert.equal(event.id, 2);
  assert.equal(event.action, "control-change");
  assert.equal(event.actor, null);
  assert.deepEqual(event.details, {
    schema: "beta_packs",
    before: {
      id: true,
      enabled: false,
      grants_enabled: false,
      authority_reference: "Prepared only; no activation authority installed",
    },
    after: {
      id: true,
      enabled: true,
      grants_enabled: true,
      authority_reference:
        "Disconnected replay of existing approved private pack controls",
    },
  });
  const originalEvents = values(
    checksumQuery("beta_packs.events").replace(
      "from beta_packs.events t)q",
      "from beta_packs.events t where id<>2)q",
    ),
  )[0];
  assert.deepEqual(
    originalEvents,
    baseline.find((r) => r.table === "beta_packs.events"),
  );
  const priorControl = values(
    "select jsonb_build_object('table','beta_packs.control','count',1,'hash',md5(md5((details->'before')::text))) from beta_packs.events where id=2",
  )[0];
  assert.deepEqual(
    priorControl,
    baseline.find((r) => r.table === "beta_packs.control"),
  );
  assert.deepEqual(
    values("select to_jsonb(t) from beta_packs.control t")[0],
    event.details.after,
  );
  return {
    exactFixtureEvent: 2,
    originalEventsUnchanged: true,
    controlMatchesExactFixture: true,
  };
}
