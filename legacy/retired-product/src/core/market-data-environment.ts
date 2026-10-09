import manifest from "../../config/hosted-preview.json";
import {
  dockedPreviewOrigin,
  dockedPreviewProjectRef,
  previewDatabaseBound,
} from "./preview-auth";

type Environment = Record<string, string | undefined>;
/** Additive market-data authority only. This never grants publication, model or messaging authority. */
export function marketDataPreviewIdentity(env: Environment) {
  return (
    env.DOCKED_HOSTED_PREVIEW === "true" &&
    env.APP_ENV === "preview" &&
    env.SUPABASE_ENV === "preview" &&
    env.VERCEL_ENV === "preview" &&
    env.MARKET_DATA_PROJECT_REF === dockedPreviewProjectRef &&
    env.SITE_URL === manifest.origin &&
    env.NEXT_PUBLIC_SUPABASE_URL === dockedPreviewOrigin &&
    previewDatabaseBound(env) &&
    [
      "ODDS_POLLING_ENABLED",
      "PUBLICATION_ENABLED",
      "FORWARD_PAPER_ENABLED",
      "SENDING_ENABLED",
    ].every((k) => env[k] === "false") &&
    !env.ODDS_API_KEY?.trim() &&
    !env.ODDS_RIGHTS_REFERENCE?.trim()
  );
}
export function marketDataEnvironment(env: Environment) {
  return (
    marketDataPreviewIdentity(env) &&
    env.MARKET_DATA_POLLING_ENABLED === "true" &&
    ["the-odds-api", "odds-papi"].includes(env.MARKET_DATA_PROVIDER ?? "")
  );
}
