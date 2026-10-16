import { adminRecord } from "@/server/admin-record";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const record = await adminRecord(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(record ? { record } : { error: "Record not found." }, {
      status: record ? 200 : 404,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const denied = /Authentication|MFA|Role denied|Category denied/.test(
      message,
    );
    const invalid = /Invalid record/.test(message);
    const limited = /rate limit/.test(message);
    return Response.json(
      {
        error: denied
          ? "Verified staff access and permission are required."
          : invalid
            ? "Invalid record request."
            : limited
              ? "Too many requests. Try again shortly."
              : "Record is temporarily unavailable. Try again.",
      },
      { status: denied ? 403 : invalid ? 400 : limited ? 429 : 503, headers },
    );
  }
}
