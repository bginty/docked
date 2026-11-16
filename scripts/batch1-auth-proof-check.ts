/** Exercise observed refresh evidence and reject security-relevant alterations. */
import assert from "node:assert/strict";
import { json, priv, docs, save } from "./lib/batch1-production-execution.mjs";
import { verifyFounderReadActivity } from "./lib/batch1-founder-auth-evidence";
const before = json(priv + "/founder-auth-before.private.json"),
  after = json(priv + "/founder-auth-after.private.json");
verifyFounderReadActivity(before, after);
const mutations = [
  (v: any) => {
    v.tables.users[0].encrypted_password_hash = "changed";
  },
  (v: any) => {
    v.tables.mfa_factors[0].status = "unverified";
  },
  (v: any) => {
    v.tables.sessions.push({ ...v.tables.sessions[0], id: "unexpected" });
  },
  (v: any) => {
    v.tables.refresh_tokens.find(
      (r: any) => String(r.id) === "730",
    ).parent_hash = "wrong-chain";
  },
  (v: any) => {
    v.tables.sessions.find(
      (r: any) => r.id === "70c2da32-821d-4d35-ba17-10a863e4d95f",
    ).aal = "aal1";
  },
  (v: any) => {
    v.rates.push({
      key: "unrelated:member",
      count: 1,
      reset_at: new Date().toISOString(),
    });
  },
];
for (const mutation of mutations) {
  const altered = structuredClone(after);
  mutation(altered);
  assert.throws(() => verifyFounderReadActivity(before, altered));
}
save(docs + "/founder-session-validation.json", {
  at: new Date().toISOString(),
  observedRefreshPassed: true,
  securityMutationCasesRejected: mutations.length,
  productionWrites: 0,
});
console.log(
  JSON.stringify({
    observedRefreshPassed: true,
    securityMutationCasesRejected: mutations.length,
    productionWrites: 0,
  }),
);
