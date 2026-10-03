import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TheOddsApi, type Mapping } from "../src/providers/odds-api";
import { OddsPapi, type OddsPapiMapping } from "../src/providers/odds-papi";
import { runProviderTrial } from "../src/providers/comparison";
type TrialConfiguration = {
  competition: string;
  asOf?: string;
  rights: string;
  retentionApproved: boolean;
  theOddsApi: { remaining: number | null; regions: string; mapping: Mapping };
  oddsPapi: {
    remaining: number | null;
    bookmakers: string[];
    mapping: OddsPapiMapping;
  };
};
async function main() {
  const [flag, file, destination] = process.argv.slice(2);
  if (
    flag !== "--run-authorised-preview-trial" ||
    process.env.APP_ENV !== "preview" ||
    !file ||
    !destination
  )
    throw new Error("Explicit preview-only trial invocation required");
  const privateRoot = path.resolve("private-data"),
    output = path.resolve(destination);
  if (
    !output.startsWith(privateRoot + path.sep) ||
    !path.resolve(file).startsWith(privateRoot + path.sep)
  )
    throw new Error(
      "Trial configuration and licensed evidence must stay private",
    );
  const config = JSON.parse(await readFile(file, "utf8")) as TrialConfiguration;
  if (!config.rights?.trim() || config.retentionApproved !== true)
    throw new Error("Approved trial/retention rights required");
  const providers = [
    new TheOddsApi({
      key: process.env.ODDS_API_KEY ?? "",
      rights: config.rights,
      allowPolling: true,
      remaining: config.theOddsApi.remaining,
      regions: config.theOddsApi.regions,
      mapping: config.theOddsApi.mapping,
    }),
    new OddsPapi({
      key: process.env.ODDSPAPI_API_KEY ?? "",
      rights: config.rights,
      allowPolling: true,
      remaining: config.oddsPapi.remaining,
      bookmakers: config.oddsPapi.bookmakers,
      mapping: config.oddsPapi.mapping,
    }),
  ];
  const trials = [];
  for (const provider of providers)
    trials.push(
      await runProviderTrial(provider, config.competition, config.asOf),
    );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(trials, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      trials.map((t) => ({ provider: t.provider, status: t.status })),
    ),
  );
}
main().catch(() => {
  console.error(
    "Provider trial stopped by a configuration, rights or runtime guard; no credential-bearing provider details printed.",
  );
  process.exitCode = 1;
});
