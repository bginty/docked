import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

export function assertDebugAssets(config, receipt) {
  const url = config?.server?.url;
  if (url !== undefined && url !== "http://localhost:3000/app")
    throw Error("Debug builds cannot package hosted assets.");
  if (
    receipt ||
    (config?.android?.webContentsDebuggingEnabled &&
      url !== "http://localhost:3000/app")
  )
    throw Error(
      "Debug assets require a local or disconnected development target.",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const root = "android/app/src/main/assets/";
    const receipt = root + "public/preview-environment.json";
    assertDebugAssets(
      JSON.parse(readFileSync(root + "capacitor.config.json", "utf8")),
      existsSync(receipt) ? JSON.parse(readFileSync(receipt, "utf8")) : null,
    );
  } catch {
    console.error(
      "Debug APK refused: synchronize local or disconnected assets first; hosted beta/Preview assets cannot be installed as the debug app.",
    );
    process.exitCode = 1;
  }
}
