import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hash, strategyV1 } from "../src/core/pricing";
import {
  replay,
  type HistoricalEvent,
  type Manifest,
} from "../src/research/replay";
import { ledger, type LedgerRow } from "../src/core/ledger";
import { sensitivity } from "../src/research/sensitivity";
const [command, input, manifestFile, output = "research-output/report.json"] =
  process.argv.slice(2);
async function main() {
  if (command === "freeze") {
    await mkdir("research-output", { recursive: true });
    await writeFile(
      "research-output/freeze.json",
      JSON.stringify(
        {
          config: strategyV1,
          configHash: hash(strategyV1),
          frozenAt: new Date().toISOString(),
          codeCommit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      "Wrote research-output/freeze.json. This records a rule freeze, not validation approval.",
    );
    return;
  }
  if (command === "demo") {
    if (process.env.APP_ENV === "production")
      throw new Error("Demo prohibited in production");
    const odds = ["2.00", "1.90", "2.20", "1.80", "2.00"],
      outcomes = ["won", "lost", "won", "lost", "lost"] as const;
    const rows: LedgerRow[] = odds.map((o, i) => ({
      id: `fictional-${i}`,
      eventId: `fictional-${i}`,
      publishedAt: `2026-01-0${i + 1}T00:00:00Z`,
      odds: o,
      stake: "1",
      evidence: "demo",
      result: outcomes[i],
      sport: "fictional",
      strategy: "arithmetic-only",
    }));
    console.log(
      JSON.stringify(
        {
          label: "FICTIONAL ARITHMETIC ONLY — NOT DOCKED PERFORMANCE",
          ...ledger(rows, "demo"),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (
    command === "import" ||
    command === "replay" ||
    command === "sensitivity"
  ) {
    if (!input || !manifestFile)
      throw new Error(
        "Usage: npm run research -- replay data.json manifest.json [output.json]",
      );
    const events = JSON.parse(
      await readFile(input, "utf8"),
    ) as HistoricalEvent[];
    const manifest = JSON.parse(
      await readFile(manifestFile, "utf8"),
    ) as Manifest;
    if (process.env.APP_ENV === "production" && manifest.evidence === "demo")
      throw new Error("Production demo import prohibited");
    const report =
      command === "sensitivity"
        ? sensitivity(events, manifest)
        : replay(events, manifest);
    const dest = path.resolve(output);
    const allowed = path.resolve("research-output");
    if (!dest.startsWith(allowed + path.sep))
      throw new Error("Output must be inside research-output");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(report, null, 2));
    console.log(
      `Processed dataset ${manifest.datasetId}; report saved: ${dest}. Licence and source provenance require independent review.`,
    );
    return;
  }
  console.log(
    "Commands: freeze | demo | import data.json manifest.json research-output/report.json | replay data.json manifest.json research-output/report.json",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
