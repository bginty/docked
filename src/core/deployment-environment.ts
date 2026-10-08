import productionManifest from "../../config/hosted-production.json";
import { assertHostedPreview } from "./hosted-preview";
import { assertHostedProduction } from "./hosted-production.mjs";
import { assertHostedReview } from "./hosted-review.mjs";

/** Shared by entry points before a database connection, Auth call or request. */
export function assertDeploymentEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  if (assertHostedReview(env)) return;
  assertHostedPreview(env);
  assertHostedProduction(env, productionManifest);
}
