import { readFile } from "node:fs/promises";
import path from "node:path";
export const alt =
  "Docked — BUILT FOR AN EDGE. Sports intelligence and community.";
export const size = { width: 2244, height: 508 };
export const contentType = "image/png";
// Serve the approved export unchanged: no recreated wordmark or altered artwork.
export default async function Image() {
  const bytes = await readFile(
    path.join(
      process.cwd(),
      "public/brand/social/docked-hero-built-for-an-edge.png",
    ),
  );
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": contentType },
  });
}
