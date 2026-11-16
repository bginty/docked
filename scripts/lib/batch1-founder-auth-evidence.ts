/** Complete row comparison for the observed founder read-only browser session. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const founderAuthTables = [
  "users",
  "sessions",
  "refresh_tokens",
  "mfa_amr_claims",
  "mfa_challenges",
  "audit_log_entries",
  "mfa_factors",
  "identities",
];
export const evidenceHash = (v: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(v) ?? "null")
    .digest("hex");
export function redactAuthRows(rows: any[]) {
  return rows.map((value) => {
    const r = { ...value };
    for (const key of Object.keys(r)) {
      if (
        /password|token|secret|email|phone|address|payload|ip|user_agent|identity_data|raw_.*meta|code|challenge|^parent$/i.test(
          key,
        ) &&
        !["refresh_token_counter", "token_type", "ip"].includes(key)
      ) {
        r[key + "_hash"] = evidenceHash(r[key]);
        delete r[key];
      }
      if (key === "ip") {
        r.ip_hash = evidenceHash(r.ip);
        delete r.ip;
      }
    }
    return r;
  });
}
export async function readAuthEvidence(read: (q: string) => Promise<any>) {
  const tables: Record<string, any[]> = {};
  for (const table of founderAuthTables)
    tables[table] = redactAuthRows(
      await read(
        `select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from auth.${table} t`,
      ),
    );
  const rates = await read(
    "select coalesce(jsonb_agg(to_jsonb(t) order by key),'[]') value from beta_private.rate_limits t",
  );
  return { tables, rates };
}
export function compareAuthEvidence(a: any, b: any) {
  for (const t of founderAuthTables)
    assert.deepEqual(
      [...a.tables[t]].sort((x, y) => String(x.id).localeCompare(String(y.id))),
      [...b.tables[t]].sort((x, y) => String(x.id).localeCompare(String(y.id))),
      t,
    );
  assert.deepEqual(a.rates, b.rates);
}
export function verifyFounderReadActivity(before: any, after: any) {
  const owner = before.owner,
    session = "70c2da32-821d-4d35-ba17-10a863e4d95f";
  assert.equal(
    evidenceHash(owner),
    "f0ebb58f5db0391f39d3d5eca611fa218327c5a8663f1e4050d8727f81417827",
  );
  const begin = Date.parse(before.at),
    end = Date.now() + 60000;
  // Supabase sessions.refreshed_at is UTC timestamp without time zone; do not
  // interpret it in the operator laptop's Australia/Sydney timezone.
  const stamp = (v: any) =>
    v === null
      ? 0
      : Date.parse(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(v)
            ? v + "Z"
            : v,
        );
  const inWindow = (v: any) =>
    assert(
      stamp(v) >= begin && stamp(v) <= end,
      "Activity outside observed session window",
    );
  const map = (rows: any[]) => new Map(rows.map((r) => [String(r.id), r]));
  const differences: any[] = [];
  const originalTokens = map(before.tables.refresh_tokens),
    currentTokens = map(after.tables.refresh_tokens);
  assert.equal(
    currentTokens.size,
    originalTokens.size + 2,
    "Only the two observed refreshes are accepted",
  );
  const added = currentTokens.get("730"),
    parent = originalTokens.get("728");
  assert(added && parent && !originalTokens.has("730"));
  assert.equal(added.user_id, owner);
  assert.equal(added.session_id, session);
  assert.equal(added.parent_hash, parent.token_hash);
  assert.equal(added.revoked, true);
  assert.equal(added.instance_id, parent.instance_id);
  inWindow(added.created_at);
  inWindow(added.updated_at);
  const next = currentTokens.get("731");
  assert(next && !originalTokens.has("731"));
  assert.equal(next.user_id, owner);
  assert.equal(next.session_id, session);
  assert.equal(next.parent_hash, added.token_hash);
  assert.equal(next.revoked, false);
  assert.equal(next.instance_id, parent.instance_id);
  inWindow(next.created_at);
  inWindow(next.updated_at);
  for (const table of founderAuthTables) {
    const old = map(before.tables[table]),
      now = map(after.tables[table]);
    assert.equal(
      now.size,
      old.size + (table === "refresh_tokens" ? 2 : 0),
      table + " row count changed",
    );
    for (const [id, row] of old) {
      const current = now.get(id);
      assert(current, table + " row removed");
      if (evidenceHash(current) === evidenceHash(row)) continue;
      let allowed: string[] = [];
      if (table === "users" && id === owner) allowed = ["updated_at"];
      if (table === "sessions" && id === session) {
        assert.equal(current.user_id, owner);
        assert.equal(current.aal, "aal2");
        allowed = ["updated_at", "refreshed_at", "ip_hash"];
      }
      if (table === "refresh_tokens" && id === "728") {
        assert.equal(row.user_id, owner);
        assert.equal(row.session_id, session);
        assert.equal(row.revoked, false);
        assert.equal(current.revoked, true);
        allowed = ["revoked", "updated_at"];
      }
      assert(allowed.length, "Unrelated Auth row changed");
      const restored = { ...current };
      for (const key of allowed) restored[key] = row[key];
      assert.deepEqual(
        restored,
        row,
        "Auth authority or unapproved field changed",
      );
      for (const key of allowed.filter((k) => k.endsWith("_at")))
        if (current[key] !== row[key]) {
          inWindow(current[key]);
          assert(stamp(current[key]) >= stamp(row[key]));
        }
      differences.push({
        table,
        id,
        fields: allowed.filter((k) => current[k] !== row[k]),
      });
    }
  }
  const rates = new Map(after.rates.map((r: any) => [r.key, r]));
  assert.equal(rates.size, before.rates.length);
  let rateChanges = 0;
  for (const old of before.rates) {
    const now: any = rates.get(old.key);
    assert(now);
    if (evidenceHash(now) === evidenceHash(old)) continue;
    assert.equal(old.key, "collection:" + owner);
    assert.deepEqual({ ...now, count: old.count, reset_at: old.reset_at }, old);
    assert(Number.isInteger(now.count) && now.count >= 1 && now.count <= 120);
    inWindow(now.reset_at);
    rateChanges++;
  }
  return {
    founderSessionOnly: true,
    unchangedCredentialsMfaAndAuthority: true,
    refreshRotations: 2,
    collectionRateRows: rateChanges,
    differences,
  };
}
