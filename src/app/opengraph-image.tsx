import { readFile } from "node:fs/promises";
import path from "node:path";
import { fantasyEnabled } from "@/core/fantasy";
export const alt = fantasyEnabled()
  ? "DOCKED — COLLECT. BUILD. COMPETE."
  : "Docked — BUILT FOR AN EDGE. Sports intelligence and community.";
export const size = { width: 1200, height: 630 };
export const contentType = fantasyEnabled() ? "image/jpeg" : "image/png";
// Generated composition contains the exact canonical master, never a redrawn D.
export default async function Image() {
  const bytes = await readFile(
    path.join(
      process.cwd(),
      fantasyEnabled()
        ? "public/brand/docked/social/docked-open-graph-1200x630.jpg"
        : "public/brand/canonical/docked-social.png",
    ),
  );
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": contentType },
  });
}
