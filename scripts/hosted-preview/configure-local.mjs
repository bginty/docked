// Provision only the explicitly approved Docked Preview; never print credentials.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRef = "bckkllmndoxzpzdqrevb";
const organizationId = "ernfnkcbalhyqpsrzdwa";
const bootstrap = JSON.parse(
  await readFile("private-data/hosted-preview-bootstrap.json", "utf8"),
);
if (
  bootstrap.projectRef !== projectRef ||
  bootstrap.organizationId !== organizationId ||
  bootstrap.projectName !== "Docked Preview"
)
  throw new Error("Dedicated Docked Preview identity mismatch");
const linkedRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
const connection = new URL(
  (await readFile("supabase/.temp/pooler-url", "utf8")).trim(),
);
if (
  linkedRef !== projectRef ||
  !connection.hostname.endsWith(".pooler.supabase.com") ||
  connection.port !== "5432" ||
  connection.username !== `postgres.${projectRef}`
)
  throw new Error("Expected the verified Docked session pooler on port 5432");
connection.password = bootstrap.databasePassword;
const keys = JSON.parse(
  await readFile("private-data/hosted-preview-api-keys.json", "utf8"),
);
const publishableKey = keys.find((key) => key.type === "publishable")?.api_key;
const secretKey = keys.find((key) => key.type === "secret")?.api_key;
if (
  !publishableKey?.startsWith("sb_publishable_") ||
  !secretKey?.startsWith("sb_secret_")
)
  throw new Error("Modern project-specific API keys required");
try {
  await access(".env.local");
  throw new Error("Existing .env.local must be reviewed before replacement");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const values = {
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DOCKED_CODE_COMMIT: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SECRET_KEY: secretKey,
  DATABASE_URL: connection.toString(),
  DATABASE_CONNECTION_MODE: "session",
  DATABASE_SSL_CA_FILE: path
    .resolve("certs/supabase-prod-ca-2021.crt")
    .replaceAll("\\", "/"),
};
let envFile = await readFile(".env.example", "utf8");
for (const [name, value] of Object.entries(values)) {
  if (/[\r\n]/.test(value))
    throw new Error("Invalid multiline configuration value");
  envFile = envFile.replace(
    new RegExp(`^${name}=.*$`, "m"),
    `${name}=${value}`,
  );
}
await mkdir("private-data/hosted-preview", { recursive: true });
await writeFile(
  "private-data/hosted-preview/connection.json",
  JSON.stringify(
    {
      projectRef,
      organizationId,
      databaseUrl: connection.toString(),
      caFile: values.DATABASE_SSL_CA_FILE,
      supabaseUrl: values.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey,
      secretKey,
    },
    null,
    2,
  ),
);
await writeFile(".env.local", envFile);
console.log(
  JSON.stringify({
    projectRef,
    organizationId,
    poolerHost: connection.hostname,
    poolerPort: connection.port,
    mode: "session",
    registration: false,
    externalSending: false,
    publication: false,
  }),
);
