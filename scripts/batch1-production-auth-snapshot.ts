/** Read-only, redacted evidence for the founder's own staged login. */
import assert from "node:assert/strict";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { authority, priv, save } from "./lib/batch1-production-execution.mjs";
const phase = process.argv[2];
assert(["before", "after"].includes(phase));
authority();
async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [owner] =
          await tx`select user_id::text member from credits_sandbox.access where kind='owner' and enabled`;
        assert(owner?.member);
        const tables: Record<string, Record<string, any>[]> = {};
        for (const table of [
          "users",
          "sessions",
          "refresh_tokens",
          "mfa_amr_claims",
          "mfa_challenges",
          "audit_log_entries",
          "mfa_factors",
          "identities",
        ]) {
          const rows = await tx.unsafe(
            `select to_jsonb(t) value from auth.${table} t`,
          );
          tables[table] = rows.map(({ value: v }) => {
            // Never persist raw credentials, tokens, MFA secrets, email addresses or IPs.
            return v;
          });
        }
        const [rates] =
          await tx`select coalesce(jsonb_agg(to_jsonb(t) order by key),'[]') value from beta_private.rate_limits t`;
        return {
          at: new Date().toISOString(),
          owner: owner.member,
          tables,
          rates: rates.value,
        };
      },
    );
    const { createHash } = await import("node:crypto");
    const hash = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v) ?? "null")
        .digest("hex");
    for (const rows of Object.values(result.tables))
      for (const r of rows as any[]) {
        for (const key of Object.keys(r)) {
          if (
            /password|token|secret|email|phone|address|payload|ip|user_agent|identity_data|raw_.*meta|code|challenge|^parent$/i.test(
              key,
            ) &&
            !["refresh_token_counter", "token_type", "ip"].includes(key)
          ) {
            r[key + "_hash"] = hash(r[key]);
            delete r[key];
          }
          if (key === "ip") {
            r.ip_hash = hash(r.ip);
            delete r.ip;
          }
        }
      }
    save(priv + "/founder-auth-" + phase + ".private.json", result);
    console.log(
      JSON.stringify({
        phase,
        at: result.at,
        tables: Object.fromEntries(
          Object.entries(result.tables).map(([k, v]) => [
            k,
            (v as any[]).length,
          ]),
        ),
        readOnly: true,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  save(priv + "/auth-snapshot-error.private.json", {
    message: String(e),
    code: e.code,
  });
  console.error(
    "Read-only auth evidence capture stopped; private diagnostic saved",
  );
  process.exitCode = 1;
});
