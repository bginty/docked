import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hash, strategyV1, validateStrategy } from "../src/core/pricing";
import {
  replay,
  type HistoricalEvent,
  type Manifest,
} from "../src/research/replay";
import { ledger, type LedgerRow } from "../src/core/ledger";
import { sensitivity } from "../src/research/sensitivity";
import { validateDataset, defaultStudySplits } from "../src/research/dataset";
const [command, input, manifestFile, output = "research-output/report.json"] =
  process.argv.slice(2);
async function main() {
  if (command === "freeze" || command === "freeze-strategy") {
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    if (dirty)
      throw new Error(
        "Commit reviewed code before freezing: working tree is dirty",
      );
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
          studySplits: defaultStudySplits,
          status: "FROZEN_RULE_ARTIFACT_NOT_VALIDATION_APPROVAL",
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
  if (command === "report") {
    if (!input)
      throw new Error(
        "Usage: npm run research -- report research-output/replay.json [research-output/report.md]",
      );
    const report = JSON.parse(await readFile(input, "utf8"));
    if (
      !report.manifest ||
      !report.validation?.valid ||
      !report.rows ||
      !report.immediate
    )
      throw new Error("A validated replay artifact is required");
    const { artifactIntegrity, ...payload } = report;
    if (!artifactIntegrity || artifactIntegrity.payloadHash !== hash(payload))
      throw new Error("Report integrity mismatch");
    const dest = path.resolve(manifestFile ?? "research-output/report.md");
    if (!dest.startsWith(path.resolve("research-output") + path.sep))
      throw new Error("Output must be inside research-output");
    const lines = [
      `# Docked research — ${report.manifest.datasetId}`,
      "",
      report.label,
      "",
      `Strategy: ${report.strategy.version} (${report.strategy.configHash})`,
      `Code: ${report.manifest.codeCommit}`,
      `Period: ${report.manifest.from} to ${report.manifest.to} (exclusive)`,
      "",
      `Events: ${report.validation.coverage.events}; missing outcomes: ${report.validation.coverage.resultsMissing}.`,
      `Immediate: ${report.immediate.settled} settled; net ${report.immediate.net ?? "UNKNOWN"} units; ROI ${report.immediate.roi ?? "UNKNOWN"}%.`,
      `Delayed: ${report.delayed.settled} settled; net ${report.delayed.net ?? "UNKNOWN"} units; ROI ${report.delayed.roi ?? "UNKNOWN"}%.`,
      `Maximum drawdown: ${report.immediate.drawdown ?? "UNKNOWN"}; longest losing run: ${report.immediate.longestLosingRun ?? "UNKNOWN"}.`,
      `CLV mean: ${report.immediate.clv ?? "UNKNOWN"}; missing closing observations: ${report.closing.missing}.`,
      "",
      "## Limitations",
      "",
      ...report.limitations.map((s: string) => `- ${s}`),
      "",
      "Full decisions, exclusions, monthly results, calibration, availability and uncertainty remain in the hashed JSON artifact. This private report is not a publication approval or evidence of executed wagers.",
    ];
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, lines.join("\n"), { flag: "wx" });
    console.log(`Private research report written: ${dest}`);
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
    command === "validate-data" ||
    command === "replay" ||
    command === "sensitivity" ||
    command === "stress-test"
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
    let config = strategyV1;
    if (
      manifest.evidence !== "demo" &&
      !["import", "validate-data"].includes(command)
    ) {
      const frozen = JSON.parse(
        await readFile("research-output/freeze.json", "utf8"),
      );
      if (
        hash(frozen) !== manifest.freezeArtifactHash ||
        frozen.configHash !== manifest.configHash ||
        frozen.codeCommit !== manifest.codeCommit
      )
        throw new Error("Freeze artifact/provenance mismatch");
      const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      if (
        currentCommit !== frozen.codeCommit ||
        execFileSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
        }).trim()
      )
        throw new Error("Replay requires clean frozen code commit");
      config = validateStrategy(frozen.config) as typeof strategyV1;
    }
    const payload = ["import", "validate-data"].includes(command)
      ? {
          manifest,
          validation: validateDataset(events, manifest, config),
          label: "DATA QUALITY AUDIT ONLY — no strategy results revealed",
        }
      : command === "sensitivity" || command === "stress-test"
        ? sensitivity(events, manifest)
        : replay(events, manifest, config);
    if ("validation" in payload && !payload.validation.valid)
      throw new Error(payload.validation.errors.join("; "));
    const report = {
      ...payload,
      artifactIntegrity: {
        payloadHash: hash(payload),
        manifestHash: hash(manifest),
      },
    };
    const dest = path.resolve(output);
    const allowed = path.resolve("research-output");
    if (!dest.startsWith(allowed + path.sep))
      throw new Error("Output must be inside research-output");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(report, null, 2), { flag: "wx" });
    console.log(
      `Processed dataset ${manifest.datasetId}; report saved: ${dest}. Licence and source provenance require independent review.`,
    );
    return;
  }
  console.log(
    "Commands: freeze-strategy | demo | import/validate-data/replay/stress-test data.json manifest.json research-output/report.json | report research-output/replay.json research-output/report.md",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
