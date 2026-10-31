// Connector create_deployment omits per-deployment secret env. Use authenticated
// API with local private files, never tool arguments or project-wide secrets.
import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const secretDir = path.join(process.env.USERPROFILE, ".docked-secrets");
const memberMode = process.env.DOCKED_HOSTED_MEMBER_ACCEPTANCE === "true";
const team = "team_tf6xweKKyVCj9bTppUKttJ4l",
  project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR";
try {
  const config = JSON.parse(
    await fs.readFile(
      path.join(secretDir, memberMode ? "hosted-member-acceptance.json" : "hosted-google-acceptance.json"),
      "utf8",
    ),
  );
  if (config.expiresAt < Date.now()) throw Error();
  const auth = JSON.parse(
    await fs.readFile(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
      "utf8",
    ),
  );
  const key = await fs.readFile(
    path.join(secretDir, "google-play-test-verifier.json"),
    "utf8",
  );
  const result = await build({
    stdin: {
      contents: `import { hostedGoogleAcceptance } from './src/server/hosted-google-acceptance';
 import { googleLabOAuth } from './scripts/google-play-lab-oauth';
 export default hostedGoogleAcceptance(JSON.parse(process.env.DOCKED_ACCEPTANCE_CONFIG), googleLabOAuth(process.env.DOCKED_TEST_GOOGLE_CREDENTIAL));`,
      resolveDir: process.cwd(),
      sourcefile: "hosted-acceptance-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
  const files = [
    { file: "api/acceptance.mjs", data: result.outputFiles[0].text },
    {
      file: "package.json",
      data: JSON.stringify({
        name: "docked-private-billing-acceptance",
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: {
          build:
            "node -e \"console.log('Private acceptance bundle prepared')\"",
        },
      }),
    },
    {
      file: "package-lock.json",
      data: JSON.stringify({
        name: "docked-private-billing-acceptance",
        version: "1.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": { name: "docked-private-billing-acceptance", version: "1.0.0" },
        },
      }),
    },
    {
      file: "public/index.html",
      data: "<!doctype html><title>Private acceptance</title>Authenticated operator testing only.",
    },
    {
      file: "vercel.json",
      data: JSON.stringify({
        version: 2,
        framework: null,
        buildCommand: "npm run build",
        outputDirectory: "public",
        functions: { "api/acceptance.mjs": { maxDuration: 60 } },
        regions: ["syd1"],
      }),
    },
  ];
  const response = await fetch(
    `https://api.vercel.com/v13/deployments?teamId=${team}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "docked-preview",
        project,
        files,
        target: "staging",
        projectSettings: {
          framework: null,
          buildCommand: null,
          installCommand: null,
          outputDirectory: null,
          nodeVersion: "22.x",
        },
        env: {
          DOCKED_ACCEPTANCE_CONFIG: JSON.stringify(config),
          DOCKED_TEST_GOOGLE_CREDENTIAL: key,
        },
        meta: { purpose: "private-google-test-only", payments: "disabled" },
      }),
    },
  );
  const body = await response.json();
  if (!response.ok || !body.id || !body.url) {
    console.error(
      JSON.stringify({
        http: response.status,
        code:
          typeof body.error?.code === "string"
            ? body.error.code.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60)
            : "missing-deployment",
      }),
    );
    let safe = String(body.error?.message ?? "");
    for (const value of [
      ...Object.values(config),
      auth.token,
      key,
      ...Object.values(JSON.parse(key)),
    ])
      if (typeof value === "string")
        safe = safe.replaceAll(value, "[redacted]");
    console.error(safe.slice(0, 600));
    throw Error();
  }
  const receipt = {
    id: body.id,
    url: body.url,
    project,
    team,
    production: false,
    customerWallet: false,
  };
  await fs.writeFile(
    memberMode ? "docs/qa/hosted-member-20261101/deployment.json" : "docs/qa/public-play-readiness-20261031/hosted-acceptance-deployment.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} catch {
  console.error(
    "Private acceptance deployment not confirmed; no credentials logged.",
  );
  process.exitCode = 1;
}
