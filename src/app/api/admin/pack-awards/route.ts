import { z } from "zod";
import { boundedCommunityBody } from "@/core/community-social";
import { OwnerPackAwardRejected } from "@/core/owner-pack-awards";
import { sameOrigin } from "@/server/auth";
import {
  OwnerPackAwardAccessError,
  ownerPackAward,
  ownerPackAwardsView,
} from "@/server/owner-pack-awards";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function expectedOwner(request: Request) {
  const value = request.headers.get("x-docked-owner");
  if (!z.string().uuid().safeParse(value).success)
    throw new OwnerPackAwardAccessError(
      "Open pack awards from your Owner dashboard before continuing.",
      403,
    );
  return value!;
}

function failure(error: unknown) {
  if (error instanceof OwnerPackAwardRejected)
    return Response.json(
      { error: error.message, outcome: "rejected" },
      { status: 409, headers },
    );
  if (error instanceof OwnerPackAwardAccessError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error:
          "Check the customer, pack quantities and award reference, then review again.",
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
        ? "Verified Owner access and MFA are required. Sign in again before retrying the saved award."
        : "The award could not be confirmed. Check award history, then retry the saved request to recover its result.",
    },
    { status: denied ? 403 : 503, headers },
  );
}

export async function GET(request: Request) {
  try {
    const query = z
      .object({ offset: z.coerce.number().int().min(0).max(100000).default(0) })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(
      await ownerPackAwardsView(query.offset, expectedOwner(request)),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const owner = expectedOwner(request);
    let input: unknown;
    try {
      input = JSON.parse(
        new TextDecoder().decode(await boundedCommunityBody(request, 8192)),
      );
    } catch {
      return Response.json(
        {
          error: "A valid pack award request is required.",
          outcome: "rejected",
        },
        { status: 400, headers },
      );
    }
    return Response.json(await ownerPackAward(input, owner), { headers });
  } catch (error) {
    return failure(error);
  }
}
