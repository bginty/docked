/** Exact disposable external mailbox and existing free Preview only. No Production writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au",
  dir = "private-data/restored-public-preview";
const ref = "bckkllmndoxzpzdqrevb",
  origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const file = dir + "/external-ui.private.json",
  mode = process.argv[2];
assert(["prepare", "open", "close", "inspect"].includes(mode));
const c = JSON.parse(
  readFileSync(main + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, ref);
assert.equal(new URL(c.databaseUrl).username, "postgres." + ref);
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const save = (s: unknown) =>
  writeFileSync(file, JSON.stringify(s, null, 2), { mode: 0o600 });
const manage = (mode: string, input?: string) =>
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-File",
      main + "/private-data/private-preview-release/manage-preview.ps1",
      "-Mode",
      mode,
      ...(input ? ["-InputFile", path.resolve(input)] : []),
    ],
    { windowsHide: true, stdio: "pipe" },
  );
async function run() {
  try {
    if (mode === "prepare") {
      assert(
        !existsSync(file),
        "Reconcile existing external UI acceptance before restarting",
      );
      manage("auth");
      const auth = JSON.parse(
        readFileSync(
          main +
            "/private-data/private-preview-release/restored-auth.private.json",
          "utf8",
        ).replace(/^\uFEFF/, ""),
      );
      assert.equal(auth.disable_signup, true);
      assert.equal(auth.mailer_autoconfirm, false);
      const email = "briantg_21+docked-ui-" + Date.now() + "@hotmail.com";
      const state = {
        projectRef: ref,
        origin,
        email,
        password: randomBytes(30).toString("base64url"),
        nextPassword: randomBytes(30).toString("base64url"),
        createdAt: new Date().toISOString(),
        until: new Date(Date.now() + 6 * 3600000).toISOString(),
        closed: false,
        hookSecret: "v1,whsec_" + randomBytes(32).toString("base64"),
        auth,
        functions: [] as { name: string; definition: string }[],
        constraint: "",
      };
      for (const name of [
        "public_acceptance_signup",
        "hosted_recipient_allowed",
      ]) {
        const signature =
          name === "public_acceptance_signup" ? "(jsonb)" : "(text)";
        const [f] =
          await sql`select pg_get_functiondef(${"preview_auth." + name + signature}::regprocedure) definition`;
        state.functions.push({ name, definition: f.definition });
      }
      const [constraint] =
        await sql`select pg_get_expr(conbin,conrelid) expression from pg_constraint where conrelid='preview_auth.allowed_recipients'::regclass and conname='allowed_recipients_email_check'`;
      state.constraint = constraint.expression;
      assert.equal(
        (
          await sql`select count(*)::int n from auth.users where email=${email}`
        )[0].n,
        0,
      );
      save(state);
      await sql.begin(async (t) => {
        await t.unsafe(
          "alter table preview_auth.allowed_recipients drop constraint allowed_recipients_email_check",
        );
        await t.unsafe(
          `alter table preview_auth.allowed_recipients add constraint allowed_recipients_email_check check((${state.constraint}) or email='${email}')`,
        );
        await t`insert into preview_auth.allowed_recipients(email,expires_at) values(${email},${state.until})`;
        for (const f of state.functions) {
          // Only the signed before-user-created function needs a new exact recipient.
          if (f.name !== "public_acceptance_signup") continue;
          const marker =
            "a.email like 'docked-preview-public-%@example.invalid'";
          assert.equal(f.definition.split(marker).length, 2);
          await t.unsafe(
            f.definition.replace(marker, `(${marker} or a.email='${email}')`),
          );
        }
      });
      const identity = JSON.parse(
        readFileSync(
          main +
            "/private-data/production/microsoft365/application-identity.json",
          "utf8",
        ),
      );
      const secrets = {
        SEND_EMAIL_HOOK_SECRET: state.hookSecret,
        DOCKED_GRAPH_MAIL_ENABLED: "true",
        DOCKED_ISOLATED_EMAIL_ENABLED: "true",
        DOCKED_ISOLATED_EMAIL_ORIGIN: origin,
        DOCKED_ISOLATED_EMAIL_RECIPIENT: email,
        DOCKED_ISOLATED_EMAIL_UNTIL: state.until,
        GRAPH_TENANT_ID: identity.tenantId,
        GRAPH_CLIENT_ID: identity.clientId,
        GRAPH_PRIVATE_KEY_PEM: readFileSync(
          main + "/private-data/production/microsoft365/graph-private-key.pem",
          "utf8",
        ),
        GRAPH_CERTIFICATE_PEM: readFileSync(
          main +
            "/private-data/production/microsoft365/docked-graph-public.cer",
          "utf8",
        ),
      };
      assert.equal(
        secrets.GRAPH_TENANT_ID,
        "b34880d6-d28e-40c2-b389-232506c69650",
      );
      writeFileSync(
        dir + "/external-hook-secrets.private.json",
        JSON.stringify(secrets),
        { mode: 0o600 },
      );
      console.log(
        "Exact external test recipient prepared; signup remains closed; credentials private.",
      );
    } else {
      const s = JSON.parse(readFileSync(file, "utf8"));
      assert.equal(s.projectRef, ref);
      if (mode === "open") {
        assert(!s.closed && Date.parse(s.until) > Date.now());
        const config = {
          disable_signup: false,
          mailer_autoconfirm: false,
          site_url: origin,
          uri_allow_list: origin + "/auth/callback**",
          hook_send_email_enabled: true,
          hook_send_email_uri: `https://${ref}.supabase.co/functions/v1/docked-preview-email`,
          hook_send_email_secrets: s.hookSecret,
        };
        const p = dir + "/external-ui-auth.private.json";
        writeFileSync(p, JSON.stringify(config), { mode: 0o600 });
        manage("auth-config", p);
        s.opened = true;
        save(s);
        console.log(
          "Preview uses automatic signed Auth email hook; one recipient only.",
        );
      } else if (mode === "close") {
        const fields = [
          "disable_signup",
          "mailer_autoconfirm",
          "site_url",
          "uri_allow_list",
          "hook_send_email_enabled",
          "hook_send_email_uri",
          "hook_send_email_secrets",
        ];
        const restored = Object.fromEntries(fields.map((k) => [k, s.auth[k]]));
        restored.disable_signup = true;
        const p = dir + "/external-ui-restore.private.json";
        writeFileSync(p, JSON.stringify(restored), { mode: 0o600 });
        manage("auth-config", p);
        await sql.begin(async (t) => {
          for (const f of s.functions) await t.unsafe(f.definition);
          await t`delete from preview_auth.allowed_recipients where email=${s.email}`;
          await t.unsafe(
            "alter table preview_auth.allowed_recipients drop constraint allowed_recipients_email_check",
          );
          await t.unsafe(
            "alter table preview_auth.allowed_recipients add constraint allowed_recipients_email_check check(" +
              s.constraint +
              ")",
          );
        });
        s.closed = true;
        save(s);
        console.log(
          "Preview signup closed and original hooks restored; only disposable admission removed.",
        );
      } else {
        const [r] =
          await sql`select u.id,u.email_confirmed_at is not null confirmed,p.id is not null profile,preview_auth.hosted_recipient_allowed(${s.email}) admitted from auth.users u left join public.profiles p on p.id=u.id where u.email=${s.email}`;
        console.log(
          JSON.stringify({
            closed: s.closed,
            admissionUntil: s.until,
            identity: r ?? null,
          }),
        );
      }
    }
  } finally {
    await sql.end({ timeout: 3 });
  }
}
void run().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Preview acceptance failed",
  );
  process.exitCode = 1;
});
