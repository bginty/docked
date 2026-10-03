import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  compareProviderTrials,
  type ProviderTrial,
} from "../src/providers/comparison";
async function main() {
  const [input, universe, destination] = process.argv.slice(2);
  if (!input || !universe || !destination)
    throw new Error(
      "Usage: npx tsx scripts/provider-comparison.ts private-data/trials.json private-data/universe.json research-output/provider-comparison.json",
    );
  const output = path.resolve(destination),
    allowed = path.resolve("research-output");
  if (!output.startsWith(allowed + path.sep))
    throw new Error("Comparison output must stay in ignored research-output");
  const trials = JSON.parse(await readFile(input, "utf8")) as ProviderTrial[];
  const expected = JSON.parse(await readFile(universe, "utf8")) as {
    eventIds: string[];
    marketKeys?: string[];
  };
  const report = compareProviderTrials(trials, expected);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `Compared ${trials.length} recorded trials across ${report.providers.length} providers; private report saved. No provider request made.`,
  );
}
main().catch(() => {
  console.error(
    "Provider comparison failed. Check private input evidence and the documented CLI contract; no provider payload or credential printed.",
  );
  process.exitCode = 1;
});
