// Read-only operator diagnostic. Never activates products, changes releases,
// refunds orders, consumes receipts or writes wallets. Credentials stay outside Git.
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const base =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/";
async function main() {
  const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
  const version = versionArg ? versionArg.slice("--version=".length) : "23";
  if (!/^[1-9][0-9]{0,8}$/.test(version))
    throw Error("Invalid release version");
  const key = JSON.parse(
    readFileSync(
      join(
        process.env.USERPROFILE,
        ".docked-secrets/google-play-test-verifier.json",
      ),
      "utf8",
    ),
  );
  if (
    key.client_email !==
    "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com"
  )
    throw Error("Unexpected verifier credential");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signer = createSign("RSA-SHA256");
  signer.update(payload);
  signer.end();
  const auth = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: payload + "." + signer.sign(key.private_key, "base64url"),
    }),
  });
  if (!auth.ok) throw Error("Google server authentication unavailable");
  const { access_token: token } = await auth.json();
  if (typeof token !== "string" || !token)
    throw Error("Google access token unavailable");
  const get = (path) =>
    fetch(base + path, {
      headers: { Authorization: "Bearer " + token },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  const results = [];
  for (const [name, path] of [
    ["catalogue", "oneTimeProducts?pageSize=10"],
    ["refund-readback", "purchases/voidedpurchases?type=0&maxResults=1"],
    [`generated-release-${version}`, `generatedApks/${version}`],
  ]) {
    const r = await get(path),
      body = await r.json();
    const summary = { name, httpStatus: r.status };
    if (r.ok && name === "catalogue")
      summary.products = body.oneTimeProducts?.map((p) => ({
        id: p.productId,
        options: p.purchaseOptions?.map((o) => ({
          id: o.purchaseOptionId,
          state: o.state,
          multiQuantityEnabled: o.buyOption?.multiQuantityEnabled === true,
          regions: o.regionalPricingAndAvailabilityConfigs?.map((r) => ({
            region: r.regionCode,
            availability: r.availability,
            price: r.price,
          })),
        })),
      }));
    if (r.ok && name === "refund-readback")
      summary.returnedRefunds = body.voidedPurchases?.length ?? 0;
    if (r.ok && name === `generated-release-${version}`) {
      summary.signingKeys = body.generatedApks?.map((g) => ({
        sha256: g.certificateSha256Hash,
        splits: g.generatedSplitApks?.length ?? 0,
        standalone: g.generatedStandaloneApks?.length ?? 0,
        universal: !!g.generatedUniversalApk,
      }));
      if (process.argv.includes("--download-universal")) {
        const variants =
          body.generatedApks?.filter(
            (g) => g.generatedUniversalApk?.downloadId,
          ) ?? [];
        if (variants.length !== 1)
          throw Error(
            "No unique Google-signed universal APK available; inspect targeting before download",
          );
        const apk = await get(
          `generatedApks/${version}/downloads/` +
            encodeURIComponent(variants[0].generatedUniversalApk.downloadId) +
            ":download?alt=media",
        );
        if (!apk.ok) throw Error("Google-generated APK download unavailable");
        const bytes = Buffer.from(await apk.arrayBuffer());
        if (bytes.length < 1000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
          throw Error("Invalid APK container");
        mkdirSync("tmp/play-generated", { recursive: true });
        writeFileSync(
          `tmp/play-generated/docked-${version}-google-universal.apk`,
          bytes,
        );
        summary.downloaded = true;
      }
    }
    results.push(summary);
  }
  const evidence = {
    at: new Date().toISOString(),
    oauthHttpStatus: auth.status,
    checks: results,
    mutations: 0,
  };
  const evidenceArg = process.argv.find((arg) => arg.startsWith("--evidence="));
  const evidenceFile =
    evidenceArg?.slice("--evidence=".length) ??
    "docs/qa/public-play-readiness-20261031/google-readiness-latest.json";
  if (!/^docs\/qa\/[a-zA-Z0-9_/-]+\.json$/.test(evidenceFile))
    throw Error("Repository evidence path required");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
  if (results.some((r) => r.httpStatus !== 200)) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Read-only Google diagnostic failed. Credentials and provider response content were redacted.",
  );
  process.exitCode = 1;
});
