import productionManifest from "../config/hosted-production.json" with { type: "json" };
import { writeFileSync } from "node:fs";
import { netlifyBuildCandidate } from "../src/core/hosting-identity.mjs";
import { assertHostedReview } from "../src/core/hosted-review.mjs";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
import {
  assertHostedProduction,
  productionDeploymentRequested,
} from "../src/core/hosted-production.mjs";

// Local builds use npm run build; hosted builds must select a reviewed target.
// An accidental production target can never reuse the Preview configuration.
try {
  if (assertHostedBeta(process.env)) {
    console.log(
      "Isolated production-connected beta Preview; admission remains independently gated.",
    );
  } else if (assertHostedReview(process.env)) {
    console.log(
      "Credential-free protected review target; production activation remains blocked.",
    );
  } else if (productionDeploymentRequested(process.env, productionManifest)) {
    const build =
      productionManifest.hostingProvider === "netlify"
        ? netlifyBuildCandidate(process.env)
        : undefined;
    assertHostedProduction(process.env, productionManifest, build);
    if (build)
      writeFileSync(
        new URL("../config/netlify-build.json", import.meta.url),
        JSON.stringify(build) + "\n",
      );
  } else if (
    process.env.VERCEL !== "1" ||
    process.env.VERCEL_ENV !== "preview" ||
    process.env.APP_ENV !== "preview" ||
    process.env.SUPABASE_ENV !== "preview" ||
    process.env.DOCKED_HOSTED_PREVIEW !== "true" ||
    (process.env.DOCKED_HOSTED_PRODUCTION &&
      process.env.DOCKED_HOSTED_PRODUCTION !== "false")
  ) {
    throw new Error("Unreviewed hosted target");
  }
} catch {
  console.error(
    "Docked refuses a hosted build outside its reviewed deployment boundary.",
  );
  process.exit(1);
}
