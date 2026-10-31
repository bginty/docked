import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Local operator credential only. Never bundled, logged or copied to phone. */
export function googleLabOAuth(hostedCredential?: string) {
  let cached = "",
    until = 0;
  return async () => {
    if (cached && Date.now() < until) return cached;
    try {
      const key = JSON.parse(
        hostedCredential ??
          readFileSync(
            join(
              process.env.USERPROFILE ?? "",
              ".docked-secrets/google-play-test-verifier.json",
            ),
            "utf8",
          ),
      );
      if (
        key.client_email !==
        "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com"
      )
        throw Error();
      const encode = (v: unknown) =>
        Buffer.from(JSON.stringify(v)).toString("base64url");
      const now = Math.floor(Date.now() / 1000);
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
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: payload + "." + signer.sign(key.private_key, "base64url"),
        }),
      });
      if (!response.ok) throw Error();
      const body = await response.json();
      if (
        typeof body.access_token !== "string" ||
        !body.access_token ||
        /\s/.test(body.access_token)
      )
        throw Error();
      cached = body.access_token;
      until = Date.now() + 5 * 60_000;
      return cached;
    } catch {
      throw Error("Google lab authorization unavailable");
    }
  };
}
