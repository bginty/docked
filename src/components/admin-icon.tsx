import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  home: "m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a6 6 0 0 1 12 0v3M17 4a4 4 0 0 1 0 8m1 3a5 5 0 0 1 4 5v1",
  cards: "m8 3 12 3-4 16-12-3L8 3ZM4 5 2 17l3 1M9 7l7 2",
  pack: "m3 7 9-5 9 5v11l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v11M8 4l9 5v5",
  market: "M2 3h3l3 13h11l3-9H6M10 21h.01M18 21h.01",
  trophy:
    "M7 3h10v6a5 5 0 0 1-10 0V3Zm10 2h4v3a4 4 0 0 1-4 4M7 5H3v3a4 4 0 0 0 4 4M12 14v6m-5 1h10",
  file: "M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8M8 16h8",
  shield: "m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6l9-4Zm-4 10 3 3 5-6",
  wallet: "M21 7H4a2 2 0 0 1 0-4h15v4M3 5v16h18V7M21 11h-6v6h6m-3-3h.01",
  credits:
    "M21 5c0 2-4 3-9 3S3 7 3 5s4-3 9-3 9 1 9 3ZM3 5v14c0 2 4 3 9 3s9-1 9-3V5M3 10c0 2 4 3 9 3s9-1 9-3M3 15c0 2 4 3 9 3s9-1 9-3",
  chart: "M4 21V11h3v10M11 21V3h3v18M18 21V7h3v14",
  message: "M3 3h18v14H8l-5 4V3Zm4 5h10M7 12h7",
  settings:
    "m9 3 1-2h4l1 2 3 2 3 1v4l-2 2 2 3v4l-3 1-3 2h-4l-1-2-3-2-3-1v-4l2-2-2-3V6l3-1 3-2ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  bell: "M5 17V9a7 7 0 0 1 14 0v8l2 2H3l2-2Zm4 4h6",
  external: "M14 3h7v7M21 3 10 14M10 3H3v18h18v-7",
  arrow: "m9 5 7 7-7 7",
  send: "m2 11 20-9-7 20-4-8-9-3Zm9 3L22 2",
};
export function AdminIcon({
  name,
  style,
}: {
  name: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      style={style}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.file} />
    </svg>
  );
}
