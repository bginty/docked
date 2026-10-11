import { boundedCommunityBody } from "./community-social";
type Result = "confirmed" | "invalid" | "unavailable";
export async function customerVerification(
  request: Request,
  deps: {
    enabled: boolean;
    origin: string;
    verify: (token: string) => Promise<Result>;
  },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "strict-origin",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  };
  const page = (message: string, status: number, token?: string) =>
    new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify Docked email</title><style>body{background:#0b1020;color:white;font:18px system-ui;padding:24px}main{max-width:480px;margin:10vh auto}button{font:inherit;padding:16px;border-radius:12px}</style><main><h1>Welcome to Docked</h1><p>${message}</p>${token ? `<form method="post" action="/auth/verify"><input type="hidden" name="token_hash" value="${token}"><input type="hidden" name="type" value="signup"><button>Verify my email</button></form>` : ""}<p><a style="color:inherit" href="/app/login">Return to sign in</a></p></main></html>`,
      {
        status,
        headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
      },
    );
  if (!deps.enabled)
    return page("Email verification is temporarily unavailable.", 503);
  const url = new URL(request.url);
  if (url.origin !== deps.origin)
    return page("Open your link on the Docked website.", 403);
  let input: URLSearchParams;
  if (request.method === "GET") input = url.searchParams;
  else if (request.method === "POST") {
    if (
      request.headers.get("origin") !== deps.origin ||
      request.headers.get("content-type")?.split(";")[0] !==
        "application/x-www-form-urlencoded"
    )
      return page("Reopen your email link.", 403);
    try {
      input = new URLSearchParams(
        new TextDecoder().decode(await boundedCommunityBody(request, 2048)),
      );
    } catch {
      return page("Link unavailable.", 400);
    }
  } else return page("Method not allowed.", 405);
  const token = input.get("token_hash");
  if (
    input.getAll("token_hash").length !== 1 ||
    input.getAll("type").length !== 1 ||
    input.get("type") !== "signup" ||
    !token ||
    !/^[a-zA-Z0-9_-]{20,256}$/.test(token)
  )
    return page(
      "This link is invalid. Request another verification email.",
      400,
    );
  if (request.method === "GET")
    return page(
      "Verify your email to continue. You’ll choose your display name and accept the free beta rules next.",
      200,
      token,
    );
  let result: Result;
  try {
    result = await deps.verify(token);
  } catch {
    result = "unavailable";
  }
  if (result === "confirmed")
    return new Response(null, {
      status: 303,
      headers: { ...headers, Location: deps.origin + "/app" },
    });
  return page(
    result === "invalid"
      ? "This link has expired or was already used. Sign in to resume, or request another verification email."
      : "Verification could not be confirmed. Please retry.",
    result === "invalid" ? 400 : 503,
  );
}
