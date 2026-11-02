import "server-only";
import { db } from "./db";
import { previewAuthReadinessQuery } from "./preview-auth-query";
import {
  assertIsolatedPublicPreview,
  isolatedExternalEmailRecipient,
} from "@/core/isolated-public-preview.mjs";
import {
  hostedPreviewCaptureReady,
  hostedPreviewEnvironmentBound,
  localPreviewAuth,
  previewRecipient,
  type PreviewCaptureReadiness,
} from "@/core/preview-auth";

/** Preview email authorization only. This function never sends email or enables the hook. */
export async function previewAuthEmailAllowed(
  email: string | undefined,
  app = false,
) {
  if (localPreviewAuth(process.env)) return true;
  if (assertIsolatedPublicPreview(process.env)) {
    // Distinct hosted test transport: no change to the legacy loopback proof.
    // The database returns only admission, never captured confirmation tokens.
    if (
      !app ||
      (!/^docked-preview-public-(member|deletion)-[a-f0-9]+@example\.invalid$/.test(
        email ?? "",
      ) &&
        !isolatedExternalEmailRecipient(process.env, email))
    )
      return false;
    try {
      const [result] =
        await db()`select preview_auth.hosted_recipient_allowed(${email!}) allowed`;
      return result?.allowed === true;
    } catch {
      return false;
    }
  }
  // The independently proven hosted capture hook only permits its two legacy callbacks.
  // New app callbacks need a separate reviewed proof; never silently reroute or broaden it.
  if (app) return false;
  // Reject a mismatched project before touching the configured database.
  if (!hostedPreviewEnvironmentBound(process.env) || !previewRecipient(email))
    return false;
  try {
    const rows = await db().unsafe(previewAuthReadinessQuery, [email!]);
    if (rows.length !== 1) return false;
    const projected = Object.fromEntries(
      Object.entries(rows[0]).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    ) as PreviewCaptureReadiness;
    return hostedPreviewCaptureReady(email, process.env, projected);
  } catch {
    return false;
  }
}
