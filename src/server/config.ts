import {
  hostedPreviewEnvironmentBound,
  referencesDockedPreviewProject,
} from "@/core/preview-auth";
import { assertDeploymentEnvironment } from "@/core/deployment-environment";
import { reviewOrigin } from "@/core/hosted-review.mjs";
export function config(env: Record<string, string | undefined> = process.env) {
  assertDeploymentEnvironment(env);
  if (env.AUTO_PUBLISH_DOCKED_EDGES === "true")
    throw new Error(
      "Automatic Docked publication is not implemented or approved",
    );
  const production = env.APP_ENV === "production";
  if (env.PREVIEW_AUTH_CAPTURE_MODE || env.PREVIEW_AUTH_PROJECT_REF) {
    if (!hostedPreviewEnvironmentBound(env))
      throw new Error(
        "Hosted preview Auth requires the exact reviewed Docked Preview environment binding",
      );
  }
  if (production) {
    if (referencesDockedPreviewProject(env))
      throw new Error("Docked Preview cannot run in production mode");
    if (env.DEMO_MODE === "true" || env.SUPABASE_ENV !== "production")
      throw new Error("Production rejects demo/preview configuration");
    for (const key of [
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "SITE_URL",
    ])
      if (!env[key]) throw new Error(`Missing ${key}`);
    if (
      !env.SITE_URL?.startsWith("https://") ||
      env.LEGAL_ENTITY_VERIFIED !== "true"
    )
      throw new Error("Production legal/HTTPS gate pending");
  }
  if (
    env.ADS_ENABLED === "true" ||
    env.AFFILIATES_ENABLED === "true" ||
    env.PAID_PLANS_ENABLED === "true" ||
    env.PRO_ENTITLEMENTS_ENABLED === "true" ||
    env.COMPETITIONS_ENABLED === "true" ||
    env.PRIZES_ENABLED === "true" ||
    env.DEALS_ENABLED === "true"
  )
    throw new Error(
      "Monetisation requires a reviewed implementation and fresh opt-in",
    );
  return {
    production,
    reviewOnly: env.DOCKED_HOSTED_REVIEW === "true",
    environment: env.APP_ENV ?? "preview",
    siteUrl:
      env.DOCKED_HOSTED_REVIEW === "true"
        ? reviewOrigin(env)
        : (env.SITE_URL ?? "http://localhost:3000"),
    database: !!env.DATABASE_URL,
    auth:
      !!env.NEXT_PUBLIC_SUPABASE_URL &&
      !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    registration: env.REGISTRATION_ENABLED === "true",
    publication: env.PUBLICATION_ENABLED === "true",
    paper: env.FORWARD_PAPER_ENABLED === "true",
    sending: production && env.SENDING_ENABLED === "true",
  };
}
