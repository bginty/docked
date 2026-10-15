import assert from "node:assert/strict";
import { premiumUltraPackUpgrade } from "../core/card-economy";
import { validateCredits, type CreditsState } from "../core/credits-sandbox";
import { digest } from "../core/scoring-engine";

type Query = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, any>[] }>;
/** Call inside an operator transaction. No network connection or automatic activation here. */
export async function applyPremiumPackTransition(query: Query) {
  // Same lock as purchases, opening, and the existing configuration transition.
  await query("select pg_advisory_xact_lock(71820342)");
  const {
    rows: [row],
  } = await query(
    "select revision,document from credits_sandbox.state where id for update",
  );
  if (!row) throw Error("Existing test economy required");
  const before = row.document as CreditsState;
  const state = structuredClone(before);
  if (!state.economy) throw Error("Existing nine-card test economy required");
  const {
    rows: [clock],
  } = await query(
    "select (extract(epoch from clock_timestamp())*1000)::bigint now",
  );
  const product = premiumUltraPackUpgrade(state.economy, Number(clock.now));
  validateCredits(state);
  const protectedState = (s: CreditsState) => {
    const e = s.economy!;
    return {
      ...s,
      economy: { ...e, products: undefined, activeProductVersions: undefined },
    };
  };
  assert.equal(
    digest(protectedState(state)),
    digest(protectedState(before)),
    "Holdings, balances and receipts must not change",
  );
  await query(
    "insert into credits_sandbox.pack_configuration(version,document) values($1,$2) on conflict do nothing",
    [product.version, product],
  );
  const {
    rows: [registered],
  } = await query(
    "select document from credits_sandbox.pack_configuration where version=$1",
    [product.version],
  );
  assert.deepEqual(
    registered.document,
    product,
    "Registered configuration is immutable",
  );
  const changed = digest(state) !== digest(before);
  const revision = Number(row.revision) + Number(changed);
  if (changed) {
    await query(
      "insert into credits_sandbox.history(revision,actor,request,document) values($1,$2,$3,$4)",
      [
        revision,
        "operator-premium-configuration",
        product.version,
        state,
      ],
    );
    await query(
      "update credits_sandbox.state set revision=$1,document=$2 where id",
      [revision, state],
    );
  }
  return {
    changed,
    revision,
    configuration: product.version,
    configurationHash: digest(product),
    protectedStateUnchanged: true,
  };
}
