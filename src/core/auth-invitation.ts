import { boundedCommunityBody } from "./community-social";
import { assertHostedBeta } from "./hosted-beta.mjs";

const headers = {
  "Cache-Control": "private, no-store",
  // no-referrer turns navigation POST Origin into null in Chromium. Send only
  // the origin (never the token-bearing path/query) while preserving CSRF checks.
  "Referrer-Policy": "strict-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
const tokenPattern = /^[a-zA-Z0-9_-]{20,256}$/;
type Verification = "confirmed" | "invalid" | "unavailable";
type Dependencies = {
  enabled: boolean;
  siteUrl: string;
  verify: (token: string) => Promise<Verification>;
};
const html = (message: string, status: number, token?: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked invitation</title><style>body{font:18px system-ui;background:#0b1020;color:#f5f7fb;margin:0;padding:24px}main{max-width:580px;margin:10vh auto}button{font:inherit;padding:14px 20px;cursor:pointer}p{line-height:1.6}</style></head><body><main><h1>Docked invitation</h1><p>${message}</p>${token ? `<form method="post" action="/auth/invite"><input type="hidden" name="type" value="invite"><input type="hidden" name="token_hash" value="${token}"><button type="submit">Confirm my invitation</button></form>` : ""}<p>Support: support@docked.com.au</p></main></body></html>`,
    {
      status,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    },
  );

/** No GET consumes a token. This endpoint verifies Auth ownership only: it does
 * not create a profile, record consent, allocate cards or grant administrator rights. */
export async function invitationRequest(request: Request, deps: Dependencies) {
  if (!deps.enabled) return html("Invitations are not available yet.", 503);
  const url = new URL(request.url);
  if (url.origin !== new URL(deps.siteUrl).origin)
    return html(
      "This invitation must be opened on the configured Docked site.",
      403,
    );
  if (request.method === "GET") {
    const token = url.searchParams.get("token_hash");
    if (
      url.searchParams.getAll("token_hash").length !== 1 ||
      url.searchParams.getAll("type").length !== 1 ||
      url.searchParams.get("type") !== "invite" ||
      !token ||
      !tokenPattern.test(token)
    )
      return html(
        "This invitation link is invalid. Contact support for help.",
        400,
      );
    return html(
      "Continue only if you expected this invitation. Confirming proves access to your email. Account setup and policy acceptance are still required before gameplay.",
      200,
      token,
    );
  }
  if (request.method !== "POST") return html("Method not allowed.", 405);
  if (
    request.headers.get("origin") !== new URL(deps.siteUrl).origin ||
    request.headers.get("content-type")?.split(";", 1)[0].trim() !==
      "application/x-www-form-urlencoded"
  )
    return html("This request was not accepted. Reopen your invitation.", 403);
  let form: URLSearchParams;
  try {
    const body = await boundedCommunityBody(request, 2048);
    form = new URLSearchParams(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch {
    return html("This invitation request is invalid.", 400);
  }
  const token = form.get("token_hash");
  if (
    form.getAll("token_hash").length !== 1 ||
    form.getAll("type").length !== 1 ||
    form.get("type") !== "invite" ||
    !token ||
    !tokenPattern.test(token)
  )
    return html("This invitation request is invalid.", 400);
  let outcome: Verification;
  try {
    outcome = await deps.verify(token);
  } catch {
    outcome = "unavailable";
  }
  if (outcome === "confirmed")
    return new Response(null, {
      status: 303,
      headers: {
        ...headers,
        Location: new URL("/app/reset-password", deps.siteUrl).href,
      },
    });
  if (outcome === "invalid")
    return html(
      "This invitation is invalid, expired or already used. Contact support for help.",
      400,
    );
  return html(
    "Confirmation could not be completed. Its outcome is uncertain. Do not request repeated invitations; try signing in or contact support.",
    503,
  );
}

export function productionInvitationsEnabled(
  env: Record<string, string | undefined>,
) {
  if (env.DOCKED_BETA_STAGING === "true") {
    try {
      return (
        assertHostedBeta(env) &&
        env.BETA_ACCESS_ENABLED === "true" &&
        env.DOCKED_AUTH_INVITES_READY === "true" &&
        env.AUTH_EMAIL_ENABLED === "true"
      );
    } catch {
      return false;
    }
  }
  return (
    env.APP_ENV === "production" &&
    env.SUPABASE_ENV === "production" &&
    env.DOCKED_AUTH_INVITES_READY === "true" &&
    env.AUTH_EMAIL_ENABLED === "true" &&
    env.NEXT_PUBLIC_SUPABASE_URL ===
      "https://pojoymtniryarxxunyvz.supabase.co" &&
    ["https://docked-production.netlify.app", "https://docked.com.au"].includes(
      env.SITE_URL ?? "",
    )
  );
}
