import { z } from "zod";
import { ownerRosterQuery } from "@/core/commercial-player-roster";
import { ownerRosterCsv } from "@/core/owner-roster-export";
import { OwnerRosterAccessError, ownerRosters } from "@/server/owner-rosters";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const expectedOwner = request.headers.get("x-docked-owner");
    if (!z.string().uuid().safeParse(expectedOwner).success)
      throw new OwnerRosterAccessError(
        "Open the player roster from your Owner dashboard before continuing.",
        403,
      );
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length)
      return Response.json(
        { error: "Duplicate roster filters are not supported." },
        { status: 400, headers },
      );
    const { format = "json", ...input } = Object.fromEntries(params);
    z.enum(["json", "csv"]).parse(format);
    ownerRosterQuery.strict().parse(input);
    const report = await ownerRosters(input, {
      all: format === "csv",
      expectedOwner: expectedOwner!,
    });
    if (format === "csv")
      return new Response(ownerRosterCsv(report), {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="docked-player-roster-${report.filters.sport}-${report.generatedAt.slice(0, 10)}.csv"`,
        },
      });
    return Response.json(report, { headers });
  } catch (error) {
    if (error instanceof OwnerRosterAccessError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    if (error instanceof z.ZodError)
      return Response.json(
        { error: "Check the roster filters and try again." },
        { status: 400, headers },
      );
    const message = error instanceof Error ? error.message : "";
    const denied =
      /Authentication required|Privileged MFA required|Role denied|Active Owner MFA required|Current Owner (identity|role|session|account) required/.test(
        message,
      );
    return Response.json(
      {
        error: denied
          ? "Verified Owner access and MFA are required."
          : "The player roster is temporarily unavailable. Try again shortly.",
      },
      { status: denied ? 403 : 503, headers },
    );
  }
}
