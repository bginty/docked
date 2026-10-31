import "server-only";
import { createSign } from "node:crypto";
/** Server credential only; neither tokens nor Google's error bodies are logged. */
export function googlePlayOAuth(email: string, privateKey: string) {
  if (
    !email.endsWith(".iam.gserviceaccount.com") ||
    !privateKey.includes("PRIVATE KEY")
  )
    throw Error("Google server credentials unavailable");
  let cached: { token: string; until: number } | undefined;
  return async () => {
    if (cached && cached.until > Date.now()) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const body =
      encode({ alg: "RS256", typ: "JWT" }) +
      "." +
      encode({
        iss: email,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      });
    const signer = createSign("RSA-SHA256");
    signer.update(body);
    signer.end();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: body + "." + signer.sign(privateKey, "base64url"),
      }),
    });
    if (!r.ok) throw Error("Google verification temporarily unavailable");
    const data = await r.json();
    if (
      typeof data.access_token !== "string" ||
      !data.access_token ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in < 60
    )
      throw Error("Google verification temporarily unavailable");
    cached = {
      token: data.access_token,
      until: Date.now() + (Math.min(data.expires_in, 3600) - 60) * 1000,
    };
    return cached.token;
  };
}
