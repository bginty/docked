import productionManifest from "../config/hosted-production.json" with { type: "json" };
import {
  assertHostedProduction,
  productionDeploymentRequested,
} from "../src/core/hosted-production.mjs";

// Local builds use npm run build; hosted builds must select a reviewed target.
// An accidental production target can never reuse the Preview configuration.
try {
  if (productionDeploymentRequested(process.env, productionManifest)) {
    assertHostedProduction(process.env, productionManifest);
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
