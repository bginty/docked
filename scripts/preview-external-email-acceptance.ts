/** Owner-authorised external email acceptance on the existing isolated Preview.
 * Normal hosted Auth API, exact recipient, expiring admission, existing Graph
 * sender. Never operates Production Auth or installs a provider credential in Preview.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
import { graphAssertion } from "../supabase/functions/docked-auth-email/mail.mjs";
const root = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const dir = "private-data/restored-public-preview";
const c = JSON.parse(
  readFileSync(root + "/private-data/hosted-preview/connection.json", "utf8"),
);
const ref = "bckkllmndoxzpzdqrevb",
  origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const recipient = "briantg_21+docked-preview-20261102@hotmail.com"; // Owner's already authorised test mailbox.
assert.equal(c.projectRef, ref);
assert.equal(new URL(c.databaseUrl).username, "postgres." + ref);
const mode = process.argv[2];
assert(
  [
    "prepare",
    "signup",
    "send-signup",
    "confirm-signup",
    "recovery",
    "send-recovery",
    "confirm-recovery",
    "close",
  ].includes(mode),
);
const file = dir + "/external-email.private.json";
const s = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const save = (state: unknown) =>
  writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
const evidence = (state: any) =>
  writeFileSync(
    "docs/qa/launch-convergence-20261102/external-email.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        project: ref,
        transport: "Existing Microsoft Graph support mailbox",
        scope:
          "Normal hosted Auth signup/recovery API and actual external inbox; not full public application onboarding",
        operatorRelay: true,
        passwordChanged: false,
        signup: state.signup,
        signupMail: state.signupMail,
        recovery: state.recovery,
        recoveryMail: state.recoveryMail,
        confirmed: state.confirmed,
        closed: state.closed,
        productionWrites: 0,
        providerCredentialsAdded: 0,
      },
      null,
      2,
    ),
  );
async function main() {
  if (mode === "prepare") {
    assert(!existsSync(file), "Existing acceptance must be reconciled");
    assert.equal(
      (
        await s`select count(*)::int n from auth.users where email=${recipient}`
      )[0].n,
      0,
      "Do not alter an existing identity",
    );
    const saved: any = {
      createdAt: new Date().toISOString(),
      email: recipient,
      password: randomBytes(30).toString("base64url"),
      functions: [],
      policy: null,
    };
    for (const name of [
      "public_acceptance_signup",
      "capture_hosted_public_email",
    ]) {
      const [r] =
        await s`select pg_get_functiondef(${"preview_auth." + name + "(jsonb)"}::regprocedure) definition`;
      saved.functions.push({ name, definition: r.definition });
    }
    saved.policy = (
      await s`select with_check from pg_policies where schemaname='preview_auth' and tablename='hosted_mail' and policyname='hosted_capture'`
    )[0].with_check;
    saved.constraint = (
      await s`select pg_get_expr(conbin,conrelid) as expression from pg_constraint where conrelid='preview_auth.allowed_recipients'::regclass and conname='allowed_recipients_email_check'`
    )[0].expression;
    assert.equal(
      (
        await s`select count(*)::int n from preview_auth.allowed_recipients where email=${recipient}`
      )[0].n,
      0,
    );
    save(saved); // Recovery copy before a change.
    await s.begin(async (t) => {
      // One exact subaddress of the owner's authorised mailbox, not arbitrary
      // external recipients. Original constraint is restored during close.
      await t.unsafe(
        "alter table preview_auth.allowed_recipients drop constraint allowed_recipients_email_check",
      );
      await t.unsafe(
        `alter table preview_auth.allowed_recipients add constraint allowed_recipients_email_check check((${saved.constraint}) or email='${recipient}')`,
      );
      await t`insert into preview_auth.allowed_recipients(email,expires_at) values(${recipient},clock_timestamp()+interval '30 minutes')`;
      for (const f of saved.functions) {
        const marker =
          f.name === "public_acceptance_signup"
            ? "a.email like 'docked-preview-public-%@example.invalid'"
            : "email like 'docked-preview-public-%@example.invalid'";
        assert.equal(
          f.definition.split(marker).length,
          2,
          "Expected exact existing admission clause",
        );
        const col = f.name === "public_acceptance_signup" ? "a.email" : "email";
        await t.unsafe(
          f.definition.replace(marker, `(${marker} or ${col}='${recipient}')`),
        );
      }
      await t.unsafe(
        `alter policy hosted_capture on preview_auth.hosted_mail with check((email like 'docked-preview-public-%@example.invalid' or email='${recipient}') and exists(select 1 from preview_auth.allowed_recipients a where a.email=hosted_mail.email and a.revoked_at is null and a.expires_at>clock_timestamp() and hosted_mail.expires_at<=a.expires_at))`,
      );
      assert.equal(
        (
          await t`select has_table_privilege('anon','preview_auth.hosted_mail','select') or has_table_privilege('authenticated','preview_auth.hosted_mail','select') leaked`
        )[0].leaked,
        false,
      );
    });
    saved.prepared = true;
    save(saved);
    console.log(
      "One owner-authorised external test recipient admitted for 30 minutes in Preview only.",
    );
    return;
  }
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.email, recipient);
  if (mode === "close") {
    const restoreFile = dir + "/external-auth-restore.private.json";
    if (existsSync(restoreFile)) {
      const restore = JSON.parse(
        readFileSync(restoreFile, "utf8").replace(/^\uFEFF/, ""),
      );
      assert.equal(restore.disable_signup, true);
      assert.deepEqual(Object.keys(restore), ["disable_signup"]);
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-File",
          root + "/private-data/private-preview-release/manage-preview.ps1",
          "-Mode",
          "auth-config",
          "-InputFile",
          path.resolve(restoreFile),
        ],
        { windowsHide: true, stdio: "pipe" },
      );
    }
    await s.begin(async (t) => {
      for (const f of state.functions) await t.unsafe(f.definition);
      await t.unsafe(
        "alter policy hosted_capture on preview_auth.hosted_mail with check(" +
          state.policy +
          ")",
      );
      await t`update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=${recipient}`;
      if (state.prepared && state.constraint) {
        // Only this newly-created disposable test admission and one-time codes.
        // Never deletes an Auth identity, member record or financial record.
        await t`delete from preview_auth.hosted_mail where email=${recipient}`;
        await t`delete from preview_auth.allowed_recipients where email=${recipient}`;
        await t.unsafe(
          "alter table preview_auth.allowed_recipients drop constraint allowed_recipients_email_check",
        );
        await t.unsafe(
          "alter table preview_auth.allowed_recipients add constraint allowed_recipients_email_check check(" +
            state.constraint +
            ")",
        );
      }
    });
    state.closed = true;
    save(state);
    evidence(state);
    console.log(
      "Original Preview hooks restored; external test admission revoked.",
    );
    return;
  }
  assert(
    !state.closed && Date.now() - Date.parse(state.createdAt) < 30 * 60 * 1000,
    "Test admission expired",
  );
  const api = async (path: string, body: unknown) => {
    const r = await fetch("https://" + ref + ".supabase.co/auth/v1/" + path, {
      method: "POST",
      redirect: "error",
      headers: { apikey: c.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    if (!r.ok)
      writeFileSync(
        dir + "/external-auth-error.private.json",
        JSON.stringify(data),
        { mode: 0o600 },
      );
    if (!r.ok)
      throw Error(
        "Hosted Auth returned " +
          r.status +
          " " +
          (data.code ?? data.error_code ?? "unavailable"),
      );
    return data;
  };
  if (mode === "signup") {
    assert(!state.signup);
    const d = await api(
      "signup?redirect_to=" +
        encodeURIComponent(origin + "/auth/callback?next=/app/verified"),
      { email: recipient, password: state.password },
    );
    assert(d.id && !d.email_confirmed_at && !d.access_token);
    state.userId = d.id;
    state.signup = true;
  } else if (mode === "recovery") {
    assert(state.confirmed?.signup && !state.recovery);
    await api(
      "recover?redirect_to=" + encodeURIComponent(origin + "/auth/callback"),
      { email: recipient },
    );
    state.recovery = true;
  } else if (mode.startsWith("send-")) {
    const action = mode.slice(5);
    assert(!state[action + "Mail"], "Do not repeat an uncertain email send");
    const [mail] =
      await s`select token_hash,expires_at from preview_auth.hosted_mail where email=${recipient} and auth_user_id=${state.userId} and action=${action} and expires_at>clock_timestamp() order by received_at desc limit 1`;
    assert(mail, "Fresh Auth-generated message required");
    const id = JSON.parse(
      readFileSync(
        root +
          "/private-data/production/microsoft365/application-identity.json",
        "utf8",
      ),
    );
    assert.equal(id.mailbox, "support@docked.com.au");
    const { endpoint, assertion } = await graphAssertion({
      GRAPH_TENANT_ID: id.tenantId,
      GRAPH_CLIENT_ID: id.clientId,
      GRAPH_PRIVATE_KEY_PEM: readFileSync(
        root + "/private-data/production/microsoft365/graph-private-key.pem",
        "utf8",
      ),
      GRAPH_CERTIFICATE_PEM: readFileSync(
        root + "/private-data/production/microsoft365/docked-graph-public.cer",
        "utf8",
      ),
    });
    const r = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id.clientId,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(r.status, 200);
    const token = await r.json();
    // This diagnostic is a genuine Auth message sent to the identity's own inbox.
    // Send a non-clickable one-time code so link scanners cannot consume it.
    // Acceptance reads the external inbox then calls the normal Auth API,
    // never admin autoconfirm. This checks delivery, not the full signup UI.
    const subject =
      "Docked protected Preview " + action + " delivery check 20261102";
    state[action + "Mail"] = {
      intentAt: new Date().toISOString(),
      submitted: false,
      inboxVerified: false,
    };
    save(state);
    const sent = await fetch(
      "https://graph.microsoft.com/v1.0/users/support%40docked.com.au/sendMail",
      {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + token.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            toRecipients: [{ emailAddress: { address: recipient } }],
            body: {
              contentType: "Text",
              content:
                "Authorised isolated Docked email test. This does not change your Production account or password. The testing agent will verify delivery; no action is required from you.\n\nOne-time Preview Auth code (do not forward):\n" +
                mail.token_hash +
                "\n\nSupport: support@docked.com.au",
            },
          },
          saveToSentItems: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    assert.equal(sent.status, 202);
    state[action + "Mail"].submitted = true;
  } else if (mode.startsWith("confirm-")) {
    const action = mode.slice(8),
      inbox = JSON.parse(
        readFileSync(
          dir + "/external-" + action + "-inbox.private.json",
          "utf8",
        ),
      );
    assert.equal(inbox.sender, "support@docked.com.au");
    assert.equal(inbox.recipient, recipient);
    assert(/^[a-f0-9]{40,128}$/i.test(inbox.code));
    const d = await api("verify", { token_hash: inbox.code, type: action });
    assert.equal(d.user.id, state.userId);
    assert.equal(d.user.email, recipient);
    assert(d.user.email_confirmed_at && d.access_token);
    state.confirmed ??= {};
    state.confirmed[action] = true;
    state[action + "Mail"].inboxVerified = true;
    state[action + "Mail"].receivedAt = inbox.receivedAt;
    state[action + "Mail"].messageIdHash = createHash("sha256")
      .update(inbox.messageId)
      .digest("hex");
  }
  save(state);
  evidence(state);
  console.log("Preview external-email step passed: " + mode);
}
main()
  .finally(() => s.end())
  .catch((error) => {
    writeFileSync(
      dir + "/external-error.private.json",
      JSON.stringify({
        code: error.code,
        message: error.message,
        stack: error.stack,
      }),
      { mode: 0o600 },
    );
    console.error(
      "External email acceptance stopped; reconcile private state without repeating sends.",
    );
    process.exitCode = 1;
  });
