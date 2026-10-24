import { memberCollectionRecord } from "@/server/member-collection-record";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    if ([...params.keys()].some((k) => k !== "sport"))
      return Response.json(
        { error: "Only your own collection can be requested." },
        { status: 400, headers },
      );
    return Response.json(await memberCollectionRecord(params.get("sport")), {
      headers,
    });
  } catch (error) {
    const kind = memberAccessFailure(error);
    return Response.json(
      { error: "Your collection summary could not be loaded. Please retry." },
      {
        status:
          kind === "authentication"
            ? 401
            : kind === "permission" || kind === "mfa"
              ? 403
              : 503,
        headers,
      },
    );
  }
}
