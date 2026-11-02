import { execFileSync } from "node:child_process";
import fs from "node:fs";
const adb = "C:/Users/61412/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const run = (...args) =>
  execFileSync(adb, ["-s", "RFCX30C95JF", ...args], {
    windowsHide: true,
    encoding: "utf8",
  });
run("shell", "uiautomator", "dump", "/sdcard/docked-v30.xml");
run("pull", "/sdcard/docked-v30.xml", "private-data/v30-screen.private.xml");
const xml = fs.readFileSync("private-data/v30-screen.private.xml", "utf8");
const decode = (s) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
let found = 0;
for (const match of xml.matchAll(/<node\s+([^>]+)>?/g)) {
  const a = Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [
      m[1],
      decode(m[2]),
    ]),
  );
  if (
    !["docked.fantasy", "com.android.vending"].includes(a.package) ||
    a.password === "true" ||
    a.bounds === "[0,0][0,0]"
  )
    continue;
  if (a.text || a["content-desc"]) {
    console.log(
      JSON.stringify({
        text: a.text,
        label: a["content-desc"],
        bounds: a.bounds,
      }),
    );
    found++;
  }
}
if (!found)
  console.log("No visible Docked/Play text. Inspect screenshot before input.");
if (process.argv.includes("--screenshot"))
  fs.writeFileSync(
    "private-data/v30-screen.private.png",
    execFileSync(adb, ["-s", "RFCX30C95JF", "exec-out", "screencap", "-p"], {
      windowsHide: true,
      maxBuffer: 12 * 1024 * 1024,
    }),
  );
