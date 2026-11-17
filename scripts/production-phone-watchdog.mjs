/** Default check is offline. --watch can only CLOSE a separately approved session. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { managementToken } from "./lib/supabase-management-read.mjs";
import { productionPhoneAdapter } from "./lib/production-phone-adapter.mjs";
import {
  validateProductionPhoneWindow,
  watchProductionPhoneWindow,
} from "./lib/production-phone-window-shutdown.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
let db, token;
try {
  const [mode, directory] = process.argv.slice(2),
    dir = path.resolve(directory ?? "");
  assert(["--check", "--watch"].includes(mode));
  assert(dir.startsWith(path.resolve("private-data") + path.sep));
  const bytes = fs.readFileSync(path.join(dir, "phone-window.json")),
    plan = JSON.parse(bytes),
    planHash = hash(bytes);
  validateProductionPhoneWindow(plan);
  if (mode === "--check") {
    console.log(
      JSON.stringify({ valid: true, planSha256: planHash, networkRequests: 0 }),
    );
  } else {
    const authority = JSON.parse(
      fs.readFileSync(path.join(dir, "authority.private.json")),
    );
    assert.equal(authority.approved, true);
    assert.equal(authority.planSha256, planHash);
    assert.equal(authority.packageSha256, plan.approvalSha256);
    assert.equal(authority.sourceCommit, plan.sourceCommit);
    assert(
      Date.parse(authority.approvedAt) <= Date.now() &&
        Date.parse(authority.expiresAt) >= Date.parse(plan.until),
    );
    assert(
      Date.parse(authority.expiresAt) - Date.parse(authority.approvedAt) <=
        86400000,
    );
    for (const f of authority.files) {
      const file = path.resolve(f.path);
      assert(file.startsWith(process.cwd() + path.sep));
      assert.equal(hash(fs.readFileSync(file)), f.sha256);
    }
    for (const required of [
      "scripts/production-phone-watchdog.mjs",
      "scripts/lib/production-phone-adapter.mjs",
      "scripts/lib/production-phone-window-shutdown.mjs",
      "scripts/lib/supabase-management-read.mjs",
    ])
      assert(authority.files.some((f) => f.path === required));
    assert(
      !fs.existsSync(path.join(dir, "result.json")),
      "Do not reuse completed session",
    );
    const connection = JSON.parse(
      fs.readFileSync(path.join(dir, "database.private.json")),
    );
    const url = new URL(connection.databaseUrl);
    assert(
      url.hostname.endsWith(".supabase.com") ||
        url.hostname.endsWith(".supabase.co"),
    );
    assert(
      decodeURIComponent(url.username).includes(plan.projectRef) ||
        url.hostname.includes(plan.projectRef),
      "Exact Production database binding required",
    );
    db = postgres(connection.databaseUrl, {
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
      },
      max: 1,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 15,
      onnotice: () => {},
    });
    token = managementToken();
    const request = async (ref, suffix, payload) => {
      assert.equal(ref, plan.projectRef);
      const response = await fetch(
        "https://api.supabase.com/v1/projects/" + ref + suffix,
        {
          method: payload ? "PATCH" : "GET",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        },
      );
      assert(response.ok, "Provider operation unavailable");
      return response.json();
    };
    let stopped = false;
    process.on("SIGINT", () => {
      stopped = true;
    });
    process.on("SIGTERM", () => {
      stopped = true;
    });
    const result = await watchProductionPhoneWindow(
      plan,
      productionPhoneAdapter(db, request, plan),
      {
        stopRequested: () => stopped || fs.existsSync(path.join(dir, "STOP")),
        onReady: () =>
          fs.writeFileSync(
            path.join(dir, "armed.json"),
            JSON.stringify({
              at: new Date().toISOString(),
              planSha256: planHash,
            }),
            { flag: "wx" },
          ),
      },
    );
    fs.writeFileSync(
      path.join(dir, "result.json"),
      JSON.stringify(
        { at: new Date().toISOString(), planSha256: planHash, ...result },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(JSON.stringify(result));
    if (result.safetyFailure) process.exitCode = 1;
  }
} catch {
  console.error(
    "Phone watchdog stopped: independently verify exact budget window, Phone and hook OFF. No secret or provider response emitted.",
  );
  process.exitCode = 1;
} finally {
  token = undefined;
  await db?.end({ timeout: 5 });
}
