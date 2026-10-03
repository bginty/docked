import { readFile } from "node:fs/promises";
import path from "node:path";
export const alt =
  "Docked — BUILT FOR AN EDGE. Sports intelligence and community.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Generated composition contains the exact canonical master, never a redrawn D.
export default async function Image() {
  const bytes = await readFile(
    path.join(
      process.cwd(),
      "public/brand/canonical/docked-social.png",
    ),
  );
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": contentType },
  });
}
