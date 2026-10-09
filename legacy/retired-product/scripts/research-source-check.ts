import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  parseOpenFootballDataset,
  openFootballQualityReport,
} from "../src/core/openfootball-dataset";

/** Offline inspection only: no network, credentials, database writes, model fitting or publication. */
async function main() {
  const args = process.argv.slice(2),
    options = new Map<string, string>();
  if (args.length === 0 || args.includes("--help")) {
    console.log(
      "npm run research:source-check -- --file <local-json> --observed-at <ISO-time> --revision <40-char-commit> [--out <new-report.json>]",
    );
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--file", "--observed-at", "--revision", "--out"].includes(args[i]) ||
      !args[i + 1] ||
      options.has(args[i])
    )
      throw Error("Unknown, duplicate or incomplete argument");
    options.set(args[i], args[i + 1]);
  }
  const file = options.get("--file"),
    observedAt = options.get("--observed-at"),
    revision = options.get("--revision");
  if (!file || !observedAt || !revision || !/^[a-f0-9]{40}$/.test(revision))
    throw Error(
      "File, actual observation time and pinned repository revision required",
    );
  if (Date.parse(observedAt) > Date.now())
    throw Error("Observation cannot be in the future");
  const bytes = await readFile(file);
  if (bytes.byteLength > 1_000_000)
    throw Error("Dataset exceeds reviewed size limit");
  const parsed = parseOpenFootballDataset(JSON.parse(bytes.toString("utf8")), {
    observedAt,
    sourceId: "openfootball-epl",
    sourceVersion: revision,
  });
  const report = {
    ...openFootballQualityReport(parsed),
    rawBytes: bytes.length,
    rawSha256: createHash("sha256").update(bytes).digest("hex"),
    sourceUrl: `https://raw.githubusercontent.com/openfootball/football.json/${revision}/${parsed.season.replace("/", "-")}/en.1.json`,
    rightsEvidence: `https://github.com/openfootball/football.json/blob/${revision}/LICENSE.md`,
    importedIntoApplication: false,
    historicalDockedPerformanceCreated: false,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`,
    target = options.get("--out");
  if (target) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, output, { flag: "wx" });
  }
  console.log(output);
  if (report.status === "SOURCE_ADAPTER_DEGRADED") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Source check failed");
  process.exitCode = 1;
});
