import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  assertHostedPreview,
  hostedPreviewDisabledFlags,
} from "../src/core/hosted-preview.ts";

const destination = JSON.parse(
  await readFile("config/hosted-preview.json", "utf8"),
);
const connection = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
if (
  destination.projectName !== "docked-preview" ||
  destination.projectId !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
  destination.teamId !== "team_tf6xweKKyVCj9bTppUKttJ4l" ||
  destination.target !== "preview" ||
  connection.projectRef !== "bckkllmndoxzpzdqrevb" ||
  connection.organizationId !== "ernfnkcbalhyqpsrzdwa"
)
  throw new Error("Dedicated preview identity required");
const env = {
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DOCKED_HOSTED_PREVIEW: "true",
  SITE_URL: destination.origin,
  DATABASE_RUNTIME: "serverless",
  DATABASE_CONNECTION_MODE: "session",
  DATABASE_URL: connection.databaseUrl,
  SUPABASE_SECRET_KEY: connection.secretKey,
  NEXT_PUBLIC_SUPABASE_URL: connection.supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: connection.publishableKey,
  ODDS_PROVIDER_STATUS: "NOT_CONFIGURED",
  RESULTS_PROVIDER_STATUS: "NOT_CONFIGURED",
  ODDS_MONTHLY_CREDIT_LIMIT: "0",
  ...Object.fromEntries(
    hostedPreviewDisabledFlags.map((key) => [key, "false"]),
  ),
};
assertHostedPreview(env);
if (!env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"))
  throw new Error("Dedicated server-side Auth erasure credential required");
const variables = Object.entries(env).map(([key, value]) => ({
  key,
  value,
  target: ["preview"],
  type: ["DATABASE_URL", "SUPABASE_SECRET_KEY"].includes(key)
    ? "sensitive"
    : "encrypted",
}));
await mkdir("private-data/hosted-deploy", { recursive: true });
await writeFile(
  "private-data/hosted-deploy/environment-payload.json",
  JSON.stringify(variables),
);
console.log(
  JSON.stringify({
    projectId: destination.projectId,
    target: "preview",
    count: variables.length,
    keys: Object.keys(env),
    sourceFilesUploaded: 0,
  }),
);
