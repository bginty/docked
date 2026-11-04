import { mobileSportCapabilities } from "@/core/mobile-capabilities";
import { publicCustomersEnabled } from "@/core/public-customer";
import { publicGameplay } from "@/server/public-gameplay";
import { sportsBetaCapabilities } from "@/server/sports-private-beta";
import { requireIdentity } from "@/server/auth";
import release from "../../../../../config/mobile-store-release.json";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
/** Shared authenticated backend; native apps never receive credentials or activation switches. */
export async function GET() {
  try {
    await requireIdentity();
    const sports = await mobileSportCapabilities({
      publicMode: publicCustomersEnabled(),
      publicSports: async () => (await publicGameplay()).allowed ?? [],
      betaSports: sportsBetaCapabilities,
    });
    return Response.json(
      {
        version: release.version,
        sports,
        billing: {
          enabled: false,
          products: [],
          reason: "Store purchases are not available.",
        },
        publicRegistration: false,
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Sign in with an authorised account." },
      { status: 401, headers },
    );
  }
}
