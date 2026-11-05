// Read-only capture for the existing authorised Samsung/v30 investigation.
// Never persist raw ProductDetails, offer tokens, purchases or unrelated logs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const adb = "C:/Users/61412/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const run = (...args) => execFileSync(adb, ["-s", "RFCX30C95JF", ...args], {
  encoding: "utf8", windowsHide: true, timeout: 20000, maxBuffer: 8 * 1024 * 1024,
});
const directory = "docs/qa/google-eligibility-20261105";
const markerFile = `${directory}/query-window.json`;
const products = new Set(["docked_credits_4900_v1", "docked_credits_9900_v1"]);
mkdirSync(directory, { recursive: true });
if (process.argv[2] === "begin") {
  assert.equal(run("shell", "getprop", "log.tag.BillingClient").trim(), "VERBOSE");
  const deviceTime = run("shell", "date", "+%m-%dT%H:%M:%S").trim().replace("T", " ") + ".000";
  assert.match(deviceTime, /^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.000$/);
  const marker = { at: new Date().toISOString(), deviceTime, mutations: 0 };
  writeFileSync(markerFile, JSON.stringify(marker, null, 2) + "\n");
  console.log(JSON.stringify(marker));
} else {
  assert.equal(process.argv[2], "capture", "Use begin immediately before the query, then capture");
  const marker = JSON.parse(readFileSync(markerFile, "utf8"));
  const raw = run("logcat", "-d", "-v", "threadtime", "-s", "BillingClient:V", "*:S");
  const events = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.slice(0, 18) < marker.deviceTime) continue;
    const unfetched = line.match(/Got unfetchedProduct: UnfetchedProduct\{productId='([^']+)', productType='([^']+)', statusCode=(\d+)\}/);
    if (unfetched && products.has(unfetched[1])) {
      events.push({ deviceTime: line.slice(0, 18), product: unfetched[1], type: unfetched[2], statusCode: Number(unfetched[3]) });
      continue;
    }
    const failure = line.match(/getSkuDetails\(\) failed for queryProductDetailsAsync\. Response code: (\d+)/);
    if (failure) events.push({ deviceTime: line.slice(0, 18), queryResponseCode: Number(failure[1]) });
    for (const message of [
      "queryProductDetailsAsync got empty product details response.",
      "queryProductDetailsAsync got null response list",
      "getSkuDetails() returned a bundle with neither an error nor a product detail list for queryProductDetailsAsync.",
    ]) if (line.includes(message)) events.push({ deviceTime: line.slice(0, 18), message });
  }
  const evidence = { at: new Date().toISOString(), since: marker, events, rawLogsPersisted: false, mutations: 0 };
  writeFileSync(`${directory}/native-query-log.json`, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
}
