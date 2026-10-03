// Public-screen capture only. Do not use after entering credentials or viewing
// private member content. No WebView inspection or ADB forwarding is enabled.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = process.argv[2];
const serial = process.env.DOCKED_ANDROID_SERIAL || "emulator-5554";
if (!/^[a-z0-9-]{3,48}$/.test(name || "") || !/^emulator-\d+$/.test(serial))
  throw new Error(
    "A static public capture name and designated emulator are required.",
  );
const adb = path.join(
  process.env.ANDROID_HOME || "",
  "platform-tools",
  "adb.exe",
);
function run(args, encoding = "utf8") {
  return execFileSync(adb, ["-s", serial, ...args], {
    encoding,
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
mkdirSync("private-data/android-https-preview", { recursive: true });
mkdirSync("docs/qa/android-https-preview/native", { recursive: true });
const screenshot = run(["exec-out", "screencap", "-p"], "buffer");
writeFileSync(`docs/qa/android-https-preview/native/${name}.png`, screenshot);
try {
  const devicePath = `/sdcard/docked-preview-${name}.xml`;
  run(["shell", "uiautomator", "dump", devicePath]);
  const xml = run(["shell", "cat", devicePath]);
  writeFileSync(`private-data/android-https-preview/ui-${name}.xml`, xml);
  const labels = [...xml.matchAll(/(?:text|content-desc)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value.trim());
  console.log(
    JSON.stringify({ name, labels: [...new Set(labels)].slice(0, 45) }),
  );
} catch {
  console.log(
    JSON.stringify({
      name,
      uiHierarchy: "UNAVAILABLE",
      screenshot: "CAPTURED",
    }),
  );
}
