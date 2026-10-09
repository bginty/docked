import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

let onDarkLogo: Promise<string> | undefined;
/** The image renderer embeds the supplied bytes without an external fetch. */
export function onDarkWordmarkData() {
  return (onDarkLogo ??= readFile(
    path.join(process.cwd(), "public/brand/canonical/docked-master.png"),
  ).then((bytes) => `data:image/png;base64,${bytes.toString("base64")}`));
}
