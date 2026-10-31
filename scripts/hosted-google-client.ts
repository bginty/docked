import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const secretDir = join(process.env.USERPROFILE!, ".docked-secrets");
export async function hostedGoogleCall(body: Record<string, unknown>) {
  const config = JSON.parse(
    await readFile(join(secretDir, "hosted-google-acceptance.json"), "utf8"),
  );
  if (config.expiresAt < Date.now()) throw Error("Acceptance expired");
  const d = JSON.parse(
    await readFile(
      "docs/qa/public-play-readiness-20261031/hosted-acceptance-deployment.json",
      "utf8",
    ),
  );
  if (
    d.project !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
    !/^docked-preview-[a-z0-9]+-briant-s-projects\.vercel\.app$/.test(d.url)
  )
    throw Error("Unexpected test destination");
  const directory = join(secretDir, "hosted-google-client");
  await mkdir(join(directory, ".vercel"), { recursive: true });
  await writeFile(
    join(directory, ".vercel/project.json"),
    JSON.stringify({ projectId: d.project, orgId: d.team }),
  );
  const file = join(directory, randomBytes(12).toString("hex") + ".curl");
  const quote = (s: string) =>
    '"' +
    s
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r") +
    '"';
  await writeFile(
    file,
    `request = "POST"\nheader = ${quote("Content-Type: application/json")}\nheader = ${quote("Authorization: Bearer " + config.secret)}\ndata = ${quote(JSON.stringify(body))}\nsilent\nshow-error\nmax-time = 65\n`,
  );
  try {
    const auth = JSON.parse(
      await readFile(
        "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
        "utf8",
      ),
    );
    const result = await promisify(execFile)(
      process.execPath,
      [
        "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
        "curl",
        "--deployment",
        "https://" + d.url,
        "/api/acceptance",
        "--",
        "--config",
        file,
      ],
      {
        cwd: directory,
        env: { ...process.env, VERCEL_TOKEN: auth.token },
        windowsHide: true,
        maxBuffer: 128000,
        timeout: 90000,
      },
    );
    await writeFile(
      join(directory, "last-response.private.json"),
      result.stdout,
    );
    const value = JSON.parse(result.stdout);
    if (value.mode !== "isolated-google-license-test") {
      console.error("Unexpected hosted response", Object.keys(value));
      throw Error();
    }
    return value;
  } catch (e) {
    if (e && typeof e === "object" && "stderr" in e) {
      let message = String(e.stderr);
      for (const value of Object.values(config))
        if (typeof value === "string")
          message = message.replaceAll(value, "[redacted]");
      await writeFile(join(directory, "last-cli-error.private.txt"), message);
      console.error("Protected client failed; inspect private CLI diagnostic");
    }
    throw Error("Hosted acceptance request failed; credentials redacted");
  } finally {
    await unlink(file);
  }
}
if (process.argv[1]?.endsWith("hosted-google-client.ts")) {
  void hostedGoogleCall({ operation: "status" })
    .then(async (s) => {
      const evidence = {
        at: new Date().toISOString(),
        source: "protected Vercel preview and isolated Supabase schema",
        balance: s.balance,
        receipts: s.receipts.map((r: { state: string }) => r.state),
        customerWallet: false,
      };
      await writeFile(
        "docs/qa/public-play-readiness-20261031/hosted-status.json",
        JSON.stringify(evidence, null, 2),
      );
      console.log(JSON.stringify(evidence));
    })
    .catch(() => {
      console.error("Hosted status not confirmed; no secrets logged.");
      process.exitCode = 1;
    });
}
