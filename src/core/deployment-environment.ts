import productionManifest from "../../config/hosted-production.json";
import { assertHostedPreview } from "./hosted-preview";
import { assertHostedProduction } from "./hosted-production.mjs";
import { assertHostedReview } from "./hosted-review.mjs";
import { assertHostedBeta } from "./hosted-beta.mjs";

/** Shared by entry points before a database connection, Auth call or request. */
export function assertDeploymentEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  for (const flag of [
    "ODDS_POLLING_ENABLED",
    "MARKET_DATA_POLLING_ENABLED",
    "EDGE_SCANNER_ENABLED",
    "RESEARCH_AUTOMATION_ENABLED",
    "PUBLICATION_ENABLED",
    "FORWARD_PAPER_ENABLED",
    "AUTO_PUBLISH_DOCKED_EDGES",
  ]) {
    if (env[flag] === "true")
      throw new Error("Retired product workflow cannot be activated");
  }
  if (assertHostedBeta(env)) return;
  if (assertHostedReview(env)) return;
  assertHostedPreview(env);
  assertHostedProduction(env, productionManifest);
}
