import { adminSearch } from "@/server/admin-search";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const q = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json(await adminSearch(q), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const denied = /Authentication|MFA|Role denied|Category denied/.test(
      message,
    );
    const invalid = /Search must|Invalid search/.test(message);
    const limited = /rate limit/.test(message);
    return Response.json(
      {
        error: denied
          ? "Verified staff access and permission are required."
          : invalid
            ? message
            : limited
              ? "Too many searches. Try again shortly."
              : "Search is temporarily unavailable. Try again.",
      },
      { status: denied ? 403 : invalid ? 400 : limited ? 429 : 503, headers },
    );
  }
}
