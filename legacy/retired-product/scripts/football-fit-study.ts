import { readFile, writeFile } from "node:fs/promises";
import { fitPoisson, initialPoissonConfig } from "../src/core/football-poisson";
import { phase5Hash } from "../src/core/phase5-hash";

async function main() {
  const study = JSON.parse(
    await readFile("private-data/phase5d/training-study.json", "utf8"),
  );
  if (
    study.report.failures.length ||
    study.report.included !== study.training.matches.length ||
    study.report.trainingHash !== phase5Hash(study.training) ||
    study.report.configurationHash !== phase5Hash(initialPoissonConfig)
  )
    throw Error("Reviewed training study mismatch");
  const fit = fitPoisson(study.training);
  const value = {
    status: "RESEARCH_FIT_ONLY",
    fittedAt: new Date().toISOString(),
    fit,
    fitHash: phase5Hash(fit),
    qualityReview: "docs/OPENFOOTBALL_EPL_DATA_QUALITY.md",
    persistedPrediction: false,
    officialRecordStarted: false,
  };
  await writeFile(
    "private-data/phase5d/fitting-study.json",
    JSON.stringify(value, null, 2),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      status: value.status,
      diagnostics: fit.diagnostics,
      counts: fit.counts,
      fitHash: value.fitHash,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Fit failed");
  process.exitCode = 1;
});
