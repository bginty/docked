import { assertHostedPreview } from "./hosted-preview";
import { dockedPreviewProjectRef } from "./preview-auth";

export function previewCommunityContext(
  env: Record<string, string | undefined>,
) {
  assertHostedPreview(env);
  return env.DOCKED_HOSTED_PREVIEW === "true" ? dockedPreviewProjectRef : "";
}

export function previewCommunityFeature(feature: string, operator?: string) {
  return !operator && ["community_social", "public_profiles"].includes(feature);
}
