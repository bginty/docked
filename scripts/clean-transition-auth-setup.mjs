/** Disposable Auth v2.198, empty database and SMTP sink on an INTERNAL network.
 * No Production credentials/data loaded, no external email/SMS possible. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const dir = "private-data/clean-transition-20261117";
mkdirSync(dir, { recursive: true });
assert(
  !existsSync(dir + "/auth-local.private.json"),
  "Disposable setup already exists; inspect it, do not restart",
);
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
const password = randomBytes(24).toString("hex"),
  jwt = randomBytes(40).toString("hex");
const settings = {
  url: "http://127.0.0.1:54339",
  mail: "http://127.0.0.1:54340",
  password,
  jwt,
  network: "docked-clean-auth-20261117",
  db: "docked-clean-auth-db-20261117",
  auth: "docked-clean-auth-20261117",
  sink: "docked-clean-mail-20261117",
};
writeFileSync(dir + "/auth-local.private.json", JSON.stringify(settings), {
  mode: 0o600,
});
writeFileSync(
  dir + "/auth-db.env",
  `POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=postgres\n`,
  { mode: 0o600 },
);
writeFileSync(
  dir + "/auth.env",
  Object.entries({
    GOTRUE_API_HOST: "0.0.0.0",
    GOTRUE_API_PORT: "9999",
    API_EXTERNAL_URL: settings.url,
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: `postgres://postgres:${password}@${settings.db}:5432/postgres?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: "auth",
    GOTRUE_DB_MAX_POOL_SIZE: "5",
    GOTRUE_DB_MAX_IDLE_POOL_SIZE: "2",
    GOTRUE_SITE_URL: "http://127.0.0.1:54339",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_JWT_SECRET: jwt,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "false",
    GOTRUE_SMTP_HOST: settings.sink,
    GOTRUE_SMTP_PORT: "1025",
    GOTRUE_SMTP_ADMIN_EMAIL: "noreply@isolated.invalid",
    GOTRUE_SMTP_SENDER_NAME: "ISOLATED ONLY",
    GOTRUE_SMTP_MAX_FREQUENCY: "0s",
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_EXTERNAL_PHONE_ENABLED: "true",
    GOTRUE_SMS_AUTOCONFIRM: "false",
    GOTRUE_SMS_PROVIDER: "twilio",
    GOTRUE_SMS_TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
    GOTRUE_SMS_TWILIO_AUTH_TOKEN: "synthetic-no-provider-access",
    GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID: "MG00000000000000000000000000000000",
    GOTRUE_SMS_TEST_OTP:
      "61400000001:123456,61400000002:123456,61400000003:123456,61400000004:123456",
    GOTRUE_SMS_MAX_FREQUENCY: "0s",
    GOTRUE_RATE_LIMIT_SMS_SENT: "1000",
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
    GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
    GOTRUE_LOG_LEVEL: "warn",
  })
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
docker(["network", "create", "--internal", settings.network]);
docker([
  "run",
  "-d",
  "--name",
  settings.db,
  "--network",
  settings.network,
  "--tmpfs",
  "/var/lib/postgresql/data:rw,size=512m",
  "--env-file",
  dir + "/auth-db.env",
  "postgres:17.11",
]);
docker([
  "run",
  "-d",
  "--name",
  settings.sink,
  "--network",
  settings.network,
  "public.ecr.aws/supabase/mailpit:v1.31.3",
]);
await new Promise((r) => setTimeout(r, 3000));
docker([
  "exec",
  settings.db,
  "psql",
  "-U",
  "postgres",
  "-c",
  "create schema auth;alter role postgres set search_path=auth,public;",
]);
docker([
  "run",
  "-d",
  "--name",
  settings.auth,
  "--network",
  settings.network,
  "--env-file",
  dir + "/auth.env",
  "public.ecr.aws/supabase/gotrue:v2.198.0",
]);
for (let i = 0; i < 30; i++) {
  try {
    const health = JSON.parse(
      docker([
        "exec",
        settings.auth,
        "wget",
        "-q",
        "-O",
        "-",
        "http://127.0.0.1:9999/health",
      ]),
    );
    if (health.version === "v2.198.0") {
      console.log(
        JSON.stringify({
          health,
          externalNetwork: false,
          productionData: false,
        }),
      );
      process.exit(0);
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
throw Error("Isolated Auth did not become healthy; inspect local private logs");
