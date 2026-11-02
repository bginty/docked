/** Close only the temporary restored Preview signup window after acceptance. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
async function main() {
  assert(process.argv.includes("--close-isolated-preview"));
  const base = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
  const dir = "private-data/restored-public-preview";
  const c = JSON.parse(
    readFileSync(base + "/private-data/hosted-preview/connection.json", "utf8"),
  );
  const f = JSON.parse(readFileSync(dir + "/fixture.private.json", "utf8"));
  assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
  assert.equal(f.projectRef, c.projectRef);
  const patch = path.resolve(dir, "auth-close.private.json");
  writeFileSync(
    patch,
    JSON.stringify({ disable_signup: true, rate_limit_email_sent: 2 }),
    { mode: 0o600 },
  );
  const helper =
    base + "/private-data/private-preview-release/manage-preview.ps1";
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-File",
      helper,
      "-Mode",
      "auth-config",
      "-InputFile",
      patch,
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-File", helper, "-Mode", "auth"],
    { windowsHide: true, stdio: "pipe" },
  );
  const auth = JSON.parse(
    readFileSync(
      base + "/private-data/private-preview-release/restored-auth.private.json",
      "utf8",
    ).replace(/^\uFEFF/, ""),
  );
  assert.equal(auth.disable_signup, true);
  assert.equal(auth.mailer_autoconfirm, false);
  assert.equal(auth.rate_limit_email_sent, 2);
  const sql = postgres(c.databaseUrl, {
    max: 1,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
  });
  try {
    await sql.begin(async (tx) => {
      await tx`update private.feature_flags set enabled=false where key='registration'`;
      for (const a of f.accounts) {
        assert.match(
          a.email,
          /^docked-preview-public-(member|deletion)-[a-f0-9]+@example\.invalid$/,
        );
        await tx`update preview_auth.allowed_recipients set revoked_at=coalesce(revoked_at,clock_timestamp()) where email=${a.email}`;
      }
    });
    const [state] =
      await sql`select (select enabled from private.feature_flags where key='registration') registration,(select count(*)::int from commercial_billing.cards) commercial_cards,(select count(*)::int from commercial_billing.receipts) commercial_receipts,(select coalesce(sum(remaining),0)::text from commercial_billing.lots) commercial_funds,(select count(*)::int from public_gameplay.rounds where enabled) practice_rounds,(select sales_enabled or issuance_enabled or transfers_enabled from commercial_billing.control where id) commercial_enabled`;
    assert.equal(state.registration, false);
    assert.equal(state.commercial_cards, 0);
    assert.equal(state.commercial_receipts, 0);
    assert.equal(state.commercial_funds, "0");
    assert.equal(state.commercial_enabled, false);
    const evidence = {
      at: new Date().toISOString(),
      project: c.projectRef,
      authSignupDisabled: true,
      autoConfirm: false,
      emailRateRestored: 2,
      syntheticRecipientAdmissionsRevoked: true,
      state,
      productionWrites: 0,
      liveCustomerChanges: 0,
    };
    writeFileSync(
      "docs/qa/launch-resolution-20261102/preview-window-closed.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
