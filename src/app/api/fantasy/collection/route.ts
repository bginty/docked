import { ZodError } from "zod";
import { ownedCollection } from "@/server/owned-collection";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(req: Request) {
  const start = performance.now();
  try {
    const query = Object.fromEntries(new URL(req.url).searchParams);
    const page = await ownedCollection(query);
    return Response.json(page, {
      headers: {
        ...headers,
        "Server-Timing": `collection;dur=${(performance.now() - start).toFixed(1)}`,
      },
    });
  } catch (error) {
    const kind = memberAccessFailure(error);
    const message = error instanceof Error ? error.message : "";
    const invalid =
      error instanceof ZodError || message === "Invalid collection cursor";
    const forbidden =
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42501") ||
      kind === "permission" ||
      kind === "mfa" ||
      /session required|sport access|Sport beta unavailable|beta identity|privileged MFA|Verified.*session/i.test(
        message,
      );
    const status = invalid
      ? 400
      : kind === "authentication"
        ? 401
        : forbidden
          ? 403
          : message === "Collection rate limit"
            ? 429
            : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "Reset your collection filters and try again."
            : status === 401
              ? "Sign in to view your collection."
              : status === 403
                ? "Your account does not have access to this collection."
                : status === 429
                  ? "Please wait a moment before trying again."
                  : "Your collection could not be loaded. Please retry.",
      },
      { status, headers },
    );
  }
}
