import { z, ZodError } from "zod";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { moderationCase } from "@/server/moderation-cases";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const denied = /Authentication|MFA|Role denied|assignment denied/.test(
    message,
  );
  const conflict =
    /conflict|state changed|unavailable|resolution|required|Save case|Release content/.test(
      message,
    );
  const invalid = error instanceof ZodError || /Invalid case/.test(message);
  const limited = /rate limit/.test(message);
  return Response.json(
    {
      error: denied
        ? "Verified staff permission and case assignment are required."
        : invalid
          ? "Check the case fields and reason."
          : limited
            ? "Too many case requests. Try again shortly."
            : conflict
              ? "Case or content state changed. Reload before continuing; review assignment, resolution and existing holds."
              : "Case save outcome is uncertain. Retry the same request.",
    },
    {
      status: denied
        ? 403
        : invalid
          ? 400
          : limited
            ? 429
            : conflict
              ? 409
              : 503,
      headers,
    },
  );
}
export async function GET(request: Request) {
  try {
    return Response.json(
      await moderationCase({
        id: z.uuid().parse(new URL(request.url).searchParams.get("id")),
      }),
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
    const mutation = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 8000)),
    );
    return Response.json(await moderationCase({ id: "", mutation }), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
