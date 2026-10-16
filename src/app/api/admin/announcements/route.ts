import { ZodError, z } from "zod";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { adminAnnouncements } from "@/server/admin-announcements";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const denied = /Authentication|MFA|Role denied|independent reviewer/.test(
    message,
  );
  const conflict =
    /conflict|state denied|Save content|Archive an existing/.test(message);
  const invalid =
    error instanceof ZodError || /Invalid announcement/.test(message);
  const limited = /rate limit/.test(message);
  return Response.json(
    {
      error: denied
        ? "Verified staff permission and an owner or independent reviewer are required."
        : conflict
          ? "This draft changed or its review state does not allow this action. Reload the saved draft before continuing."
          : invalid
            ? "Check the draft fields and try again."
            : limited
              ? "Too many requests. Try again shortly."
              : "Draft service unavailable. Retry the same request to check its outcome.",
    },
    {
      status: denied
        ? 403
        : conflict
          ? 409
          : invalid
            ? 400
            : limited
              ? 429
              : 503,
      headers,
    },
  );
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    return Response.json(
      await adminAnnouncements(
        id
          ? { id: z.uuid().parse(id) }
          : { page: Number(params.get("page") ?? 1) },
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
    const mutation = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 18000)),
    );
    return Response.json(await adminAnnouncements({ mutation }), { headers });
  } catch (error) {
    return failure(error);
  }
}
