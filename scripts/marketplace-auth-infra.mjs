// Isolated subset of Supabase's documented self-hosted Auth/Postgres/Kong setup.
// Uses already-installed pinned images; no pull, hosted project or outbound email.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import { resolve } from "node:path";
const integrated = process.argv.includes("--integrated");
const dir = resolve(
  integrated ? "tmp/marketplace-integrated-v2" : "tmp/marketplace-auth",
);
const volume = integrated
  ? "docked-market-integrated-data-v2"
  : "docked-market-http-data-v3";
await mkdir(dir, { recursive: true });
let secret;
try {
  secret = JSON.parse(
    await readFile(resolve(dir, "infra.private.json"), "utf8"),
  );
} catch {
  secret = {
    password: randomBytes(30).toString("hex"),
    jwt: randomBytes(48).toString("hex"),
  };
  await writeFile(resolve(dir, "infra.private.json"), JSON.stringify(secret));
}
const token = (role) => {
  const head = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        role,
        iss: "supabase",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      }),
    ).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", secret.jwt).update(`${head}.${body}`).digest("base64url")}`;
};
const anon = token("anon"),
  service = token("service_role");
await writeFile(
  resolve(dir, "status.private.json"),
  JSON.stringify({
    API_URL: "http://127.0.0.1:55321",
    DB_URL: `postgresql://postgres:${secret.password}@127.0.0.1:55322/postgres`,
    ANON_KEY: anon,
    SERVICE_ROLE_KEY: service,
  }),
);
await writeFile(
  resolve(dir, "init.private.sql"),
  `alter role postgres with password '${secret.password}';alter role supabase_auth_admin with password '${secret.password}';`,
);
await writeFile(
  resolve(dir, "kong.private.json"),
  JSON.stringify({
    _format_version: "2.1",
    consumers: [
      { username: "anon", keyauth_credentials: [{ key: anon }] },
      { username: "service", keyauth_credentials: [{ key: service }] },
    ],
    services: [
      {
        name: "auth",
        url: "http://auth:9999/",
        routes: [{ name: "auth", paths: ["/auth/v1/"], strip_path: true }],
        plugins: [{ name: "key-auth", config: { hide_credentials: false } }],
      },
    ],
  }),
);
await writeFile(
  resolve(dir, "compose.private.json"),
  JSON.stringify(
    {
      name: "docked-market-http",
      services: {
        db: {
          networks: ["default", "loopback"],
          image: "public.ecr.aws/supabase/postgres:17.6.1.166",
          pull_policy: "never",
          ports: ["127.0.0.1:55322:5432"],
          environment: {
            POSTGRES_PASSWORD: secret.password,
            POSTGRES_DB: "postgres",
          },
          volumes: [
            `${volume}:/var/lib/postgresql/data`,
            "./init.private.sql:/etc/postgresql.schema.sql:ro",
          ],
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"],
            interval: "2s",
            timeout: "5s",
            retries: 30,
          },
        },
        auth: {
          image: "public.ecr.aws/supabase/gotrue:v2.195.0",
          pull_policy: "never",
          depends_on: { db: { condition: "service_healthy" } },
          environment: {
            GOTRUE_API_HOST: "0.0.0.0",
            GOTRUE_API_PORT: "9999",
            API_EXTERNAL_URL: "http://127.0.0.1:55321/auth/v1",
            GOTRUE_DB_DRIVER: "postgres",
            GOTRUE_DB_DATABASE_URL: `postgresql://supabase_auth_admin:${secret.password}@db:5432/postgres`,
            GOTRUE_SITE_URL: "http://127.0.0.1:3033",
            GOTRUE_URI_ALLOW_LIST: "http://127.0.0.1:3033",
            GOTRUE_DISABLE_SIGNUP: "true",
            GOTRUE_JWT_ADMIN_ROLES: "service_role",
            GOTRUE_JWT_AUD: "authenticated",
            GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
            GOTRUE_JWT_EXP: "120",
            GOTRUE_JWT_SECRET: secret.jwt,
            GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
            GOTRUE_MAILER_AUTOCONFIRM: "false",
            GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
            GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
          },
          healthcheck: {
            test: ["CMD", "wget", "--spider", "http://127.0.0.1:9999/health"],
            interval: "2s",
            timeout: "5s",
            retries: 30,
          },
        },
        gateway: {
          networks: ["default", "loopback"],
          image: "public.ecr.aws/supabase/kong:2.8.1",
          pull_policy: "never",
          depends_on: { auth: { condition: "service_healthy" } },
          ports: ["127.0.0.1:55321:8000"],
          environment: {
            KONG_DATABASE: "off",
            KONG_DECLARATIVE_CONFIG: "/etc/kong/local.json",
            KONG_DNS_ORDER: "LAST,A,CNAME",
            KONG_PLUGINS: "key-auth",
            KONG_PROXY_LISTEN: "0.0.0.0:8000",
            KONG_ADMIN_LISTEN: "off",
          },
          volumes: ["./kong.private.json:/etc/kong/local.json:ro"],
        },
      },
      volumes: { [volume]: {} },
      networks: { default: { internal: true }, loopback: {} },
    },
    null,
    2,
  ),
);
console.log(
  "Prepared private local infrastructure configuration. Start with docker compose -f tmp/marketplace-auth/compose.private.json up -d; no hosted credentials or image pull.",
);
