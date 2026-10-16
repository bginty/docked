import { z, ZodError } from "zod";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { moderationRetention } from "@/server/moderation-retention";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status = /Role denied|Authentication|MFA/.test(message)
    ? 403
    : error instanceof ZodError || /Invalid|confirmation required/.test(message)
      ? 400
      : /rate limit/.test(message)
        ? 429
        : /conflict|state changed|holds? before|cannot be restored/.test(
              message,
            )
          ? 409
          : 503;
  return Response.json(
    {
      error:
        status === 403
          ? "Verified owner or administrator permission is required."
          : status === 400
            ? "Check the review fields and confirmation."
            : status === 429
              ? "Too many requests. Try again shortly."
              : status === 409
                ? "Evidence or case state changed. Reload and review existing holds; deleted content cannot be restored."
                : "Retention outcome is uncertain or unavailable. Retry the same request.",
    },
    { status, headers },
  );
}
export async function GET(request: Request) {
  try {
    return Response.json(
      await moderationRetention(
        z.coerce
          .number()
          .int()
          .min(1)
          .max(1000)
          .parse(new URL(request.url).searchParams.get("page") ?? 1),
      ),
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
    return Response.json(
      await moderationRetention(
        1,
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(request, 8000)),
        ),
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
