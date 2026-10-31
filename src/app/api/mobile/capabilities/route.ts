import { customerSports } from "@/core/customer-sports";
import { sportsBetaCapabilities } from "@/server/sports-private-beta";
import { requireIdentity } from "@/server/auth";
import release from "../../../../../config/mobile-store-release.json";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
/** Shared authenticated backend; native apps never receive credentials or activation switches. */
export async function GET() {
  try {
    await requireIdentity();
    const beta = await sportsBetaCapabilities();
    return Response.json(
      {
        version: release.version,
        sports: customerSports.filter(
          (sport) => sport === "nfl" || beta.includes(sport),
        ),
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
