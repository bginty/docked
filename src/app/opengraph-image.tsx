import { readFile } from "node:fs/promises";
import path from "node:path";
export const alt = "Docked — COLLECT. BUILD. COMPETE.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";
export default async function Image() {
  return new Response(
    new Uint8Array(
      await readFile(
        path.join(
          process.cwd(),
          "public/brand/docked/social/docked-open-graph-1200x630.jpg",
        ),
      ),
    ),
    { headers: { "Content-Type": contentType } },
  );
}
