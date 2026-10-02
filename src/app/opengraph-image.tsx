import { ImageResponse } from "next/og";
export const alt =
  "Docked — sports pricing with perspective. Transparent research. No guaranteed returns.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#142b35",
        color: "#f5f5ef",
        padding: 70,
      }}
    >
      <div style={{ display: "flex", fontSize: 32, letterSpacing: 5 }}>
        DOCKED.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 70 }}>Only when the price</div>
        <div style={{ display: "flex", fontSize: 70, color: "#c8e6d5" }}>
          offers value.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#c8e6d5" }}>
        Transparent research. No guaranteed returns.
      </div>
    </div>,
    size,
  );
}
