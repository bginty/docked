import { ImageResponse } from "next/og";
import { getCommunityEdge } from "@/server/community-edges";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const record = await getCommunityEdge(
      new URL(request.url).searchParams.get("id") ?? "",
    );
    if (!record) throw new Error("Unavailable");
    const edge = record.edge;
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 56,
          background: "#142b35",
          color: "#f5f5ef",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 30,
          }}
        >
          <span>DOCKED.</span>
          <span style={{ color: "#c8e6d5" }}>COMMUNITY · PERMANENT RECORD</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 23, display: "flex" }}>
            {edge.interactionsAllowed
              ? `@${edge.handle}`
              : "Community member · identity unavailable"}
          </div>
          <div style={{ fontSize: 31, display: "flex" }}>
            {edge.eventLabel.slice(0, 100)}
          </div>
          <div style={{ fontSize: 47, display: "flex" }}>
            {edge.selection.slice(0, 80)}
          </div>
          <div
            style={{ fontSize: 24, display: "flex" }}
          >{`${(edge.marketLabel ?? edge.marketId).slice(0, 100)} · ${edge.bookmaker.slice(0, 50)}`}</div>
          <div
            style={{ fontSize: 32, color: "#c8e6d5", display: "flex" }}
          >{`${edge.odds} verified standard odds · 1.00 unit · ${edge.result.replaceAll("_", " ")}`}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 20,
          }}
        >
          <div style={{ display: "flex" }}>
            Submitted {edge.submittedAt} · Corrections {edge.corrections}
          </div>
          <div style={{ display: "flex" }}>
            Status captured {new Date().toISOString()}. Check the permanent
            record for updates.
          </div>
          <div style={{ display: "flex", color: "#c8e6d5" }}>
            Member opinion. Past performance does not guarantee future results.
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 700,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="docked-community-${edge.id}.png"`,
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "An eligible account and accessible community record are required.",
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
