import "server-only";
import { z } from "zod";
import { boundedCommunityBody } from "@/core/community-social";
import { sameOrigin } from "./auth";
import {
  OwnerRosterAccessError,
  ownerRosterActivation,
  ownerRosterDecisions,
} from "./owner-rosters";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function ownerRosterMutationRequest(
  request: Request,
  action: "decisions" | "activation",
) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const expectedOwner = request.headers.get("x-docked-owner");
    if (!z.string().uuid().safeParse(expectedOwner).success)
      throw new OwnerRosterAccessError(
        "Open the player roster from your Owner dashboard before continuing.",
        403,
      );
    let input: unknown;
    try {
      input = JSON.parse(
        new TextDecoder().decode(
          await boundedCommunityBody(
            request,
            action === "decisions" ? 524288 : 8192,
          ),
        ),
      );
    } catch {
      return Response.json(
        {
          error: "A valid reviewed roster request is required.",
          outcome: "rejected",
        },
        { status: 400, headers },
      );
    }
    const receipt =
      action === "decisions"
        ? await ownerRosterDecisions(input, expectedOwner!)
        : await ownerRosterActivation(input, expectedOwner!);
    return Response.json(receipt, { headers });
  } catch (error) {
    if (error instanceof OwnerRosterAccessError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: "Check the reviewed roster request before retrying.",
          outcome: "rejected",
        },
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
          ? "Verified Owner access and MFA are required. Sign in again before retrying the saved request."
          : "The roster change could not be confirmed. Check the current roster and retry the same saved request to recover its result.",
      },
      { status: denied ? 403 : 503, headers },
    );
  }
}
