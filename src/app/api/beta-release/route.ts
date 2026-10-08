import { NextResponse } from "next/server";
import manifest from "../../../../config/hosted-production.json";
import build from "../../../../config/netlify-build.json";
import { assertHostedProduction } from "@/core/hosted-production.mjs";
import { productionInvitationsEnabled } from "@/core/auth-invitation";

export const dynamic = "force-dynamic";
export function GET() {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  };
  try {
    assertHostedProduction(process.env, manifest, build);
    if (
      process.env.APP_ENV !== "production" ||
      process.env.DOCKED_RELEASE_CHANNEL !== "beta" ||
      process.env.SITE_URL !== "https://docked.com.au" ||
      process.env.REGISTRATION_ENABLED !== "false" ||
      process.env.FANTASY_FREE_PLAY_PRODUCTION !== "true" ||
      !productionInvitationsEnabled(process.env)
    )
      throw Error("Unavailable");
    // Public provenance only, not an assertion that live acceptance passed.
    return NextResponse.json(
      {
        channel: "beta",
        origin: "https://docked.com.au",
        siteId: manifest.netlifySiteId,
        projectRef: manifest.supabaseProjectRef,
        commit: build.commit,
        deploymentId: build.deployId,
        publicRegistration: false,
        invitedAuthentication: true,
      },
      { headers },
    );
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
