import { exportCollection } from "@/server/collection-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const csv = await exportCollection();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="docked-collection-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "Your collection could not be exported. Check your sign-in and try again.",
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
