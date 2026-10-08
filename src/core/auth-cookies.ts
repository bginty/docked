import type { CookieOptions } from "@supabase/ssr";
import { betaOrigin } from './hosted-beta.mjs';

/** Every SSR writer, including refresh and deletion, uses the same origin policy. */
export function authCookieOptions(
  options: CookieOptions,
  siteUrl = process.env.DOCKED_BETA_STAGING === 'true' ? betaOrigin(process.env) : process.env.SITE_URL ?? "http://localhost:3000",
): CookieOptions {
  const https = new URL(siteUrl).protocol === "https:";
  return {
    ...options,
    sameSite: "lax",
    secure: https,
    // Auth and PKCE are handled by server routes; native/browser JS needs no token access.
    httpOnly: https ? true : options.httpOnly,
  };
}
