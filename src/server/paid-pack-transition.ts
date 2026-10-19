import assert from "node:assert/strict";
import { paidPackCatalogueUpgrade } from "../core/card-economy";
import { paidCatalogueVersion } from "../core/paid-pack-catalogue";
import { validateCredits, type CreditsState } from "../core/credits-sandbox";
import { digest } from "../core/scoring-engine";

type Query = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, any>[] }>;
/** Must run within the caller's operator transaction. Never runs on member reads. */
export async function applyPaidPackTransition(query: Query) {
  await query("select pg_advisory_xact_lock(71820342)");
  const {
    rows: [row],
  } = await query(
    "select revision,document from credits_sandbox.state where id for update",
  );
  if (!row) throw Error("Existing economy required");
  const before = row.document as CreditsState,
    state = structuredClone(before);
  if (!state.economy) throw Error("Existing pack economy required");
  const {
    rows: [clock],
  } = await query(
    "select (extract(epoch from clock_timestamp())*1000)::bigint now",
  );
  const products = paidPackCatalogueUpgrade(state.economy, Number(clock.now));
  validateCredits(state);
  const protectedState = (s: CreditsState) => ({
    ...s,
    economy: {
      ...s.economy,
      products: undefined,
      activeProductVersions: undefined,
    },
  });
  assert.equal(
    digest(protectedState(state)),
    digest(protectedState(before)),
    "Balances, holdings and purchased terms must not change",
  );
  for (const p of products) {
    await query(
      "insert into credits_sandbox.pack_configuration(version,document) values($1,$2) on conflict do nothing",
      [p.version, p],
    );
    const {
      rows: [saved],
    } = await query(
      "select document from credits_sandbox.pack_configuration where version=$1",
      [p.version],
    );
    assert.deepEqual(
      saved.document,
      p,
      "Registered configuration is immutable",
    );
  }
  const changed = digest(state) !== digest(before),
    revision = Number(row.revision) + Number(changed);
  if (changed) {
    await query(
      "insert into credits_sandbox.history(revision,actor,request,document) values($1,$2,$3,$4)",
      [revision, "operator-paid-catalogue", paidCatalogueVersion, state],
    );
    await query(
      "update credits_sandbox.state set revision=$1,document=$2 where id",
      [revision, state],
    );
  }
  return {
    changed,
    revision,
    products: products.map((p) => ({
      id: p.id,
      cards: p.cards,
      price: p.priceCredits,
    })),
    protectedStateUnchanged: true,
  };
}
