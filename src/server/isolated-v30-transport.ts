import { createHmac, timingSafeEqual } from "node:crypto";
import { boundedCommunityBody } from "../core/community-social";

const cookie = "__Host-docked-v30-acceptance";
const entry = "/profile/qa_billing";
const exit = "/profile/qa_billing_exit";
const previewAuthCookie =
  /^sb-bckkllmndoxzpzdqrevb-auth-token(?:\.[0-9]+|-code-verifier)?$/;
type Env = Record<string, string | undefined>;
const same = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked isolated TEST</title><body style="background:#071326;color:white;font:18px system-ui;margin:24px;max-width:560px"><h1>Isolated Google TEST</h1>${body}</body></html>`,
    {
      status,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
export function v30TransportConfig(env: Env, now = Date.now()) {
  if (env.DOCKED_V30_TRANSPORT !== "true") return null;
  const until = Date.parse(env.DOCKED_V30_TRANSPORT_UNTIL ?? "");
  const key = env.DOCKED_V30_TRANSPORT_KEY ?? "";
  const target = env.DOCKED_V30_TRANSPORT_TARGET ?? "";
  const oidc = env.DOCKED_V30_TRANSPORT_OIDC ?? "";
  if (
    env.VERCEL_PROJECT_ID !== "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST" ||
    env.VERCEL_ENV !== "production" ||
    env.SITE_URL !== "https://docked.com.au" ||
    !/^[a-f0-9]{64}$/.test(key) ||
    !Number.isFinite(until) ||
    until <= now ||
    until > now + 6 * 3600000 ||
    !/^https:\/\/docked-preview-[a-z0-9]+-briant-s-projects\.vercel\.app$/.test(
      target,
    )
  )
    throw Error("Isolated transport configuration unavailable");
  let claims: { exp?: number };
  try {
    claims = JSON.parse(
      Buffer.from(oidc.split(".")[1], "base64url").toString(),
    );
  } catch {
    throw Error("Protected transport credential unavailable");
  }
  // This is an operator-supplied credential, not client authorization. Vercel
  // verifies its signature/audience; local expiry prevents a stale transport.
  if (!claims.exp || claims.exp * 1000 < until)
    throw Error("Protected transport credential expires before session");
  const sig = createHmac("sha256", key)
    .update(`v30:${until}:${target}`)
    .digest("hex");
  return { until, key, target, oidc, session: `${until}.${sig}` };
}
/** Temporary opt-in transport only. No wallet, Auth administration or settlement
 * credentials exist here. The complete upstream app still authenticates the
 * ordinary customer and applies its own isolated receipt/ledger checks. */
export async function isolatedV30Transport(
  request: Request,
  env: Env,
  transport: typeof fetch = fetch,
  now = Date.now(),
): Promise<Response | null> {
  const u = new URL(request.url);
  const pairs = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  const session = pairs
    .find((x) => x.startsWith(cookie + "="))
    ?.slice(cookie.length + 1);
  if (u.pathname === exit) {
    if (
      request.method !== "POST" ||
      request.headers.get("origin") !== "https://docked.com.au"
    )
      return html("<p>Use the exit button in your TEST session.</p>", 403);
    const r = new Response(null, {
      status: 303,
      headers: { ...headers, Location: "/app/login" },
    });
    r.headers.append(
      "Set-Cookie",
      `${cookie}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    for (const pair of pairs) {
      const name = pair.split("=")[0];
      if (previewAuthCookie.test(name))
        r.headers.append(
          "Set-Cookie",
          `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
        );
    }
    return r;
  }
  if (!session && u.pathname !== entry) return null;
  const fail = () =>
    html(
      `<p>The isolated test connection is closed. No request has been sent to a customer wallet.</p><form method="post" action="${exit}"><button>Exit TEST session</button></form>`,
      503,
    );
  let c;
  try {
    c = v30TransportConfig(env, now);
  } catch {
    return fail();
  }
  if (!c || u.origin !== "https://docked.com.au") return fail();
  if (u.pathname === entry) {
    if (request.method === "GET")
      return html(
        `<p>Authorised no-charge testing only. This connects to isolated Preview accounts and inventory. Never use a real payment method.</p><form method="post"><label>Operator access code <input name="code" type="password" autocomplete="off" required maxlength="64"></label><button>Connect to TEST</button></form>`,
      );
    if (
      request.method !== "POST" ||
      request.headers.get("origin") !== u.origin ||
      Number(request.headers.get("content-length")) > 256
    )
      return fail();
    let text: string;
    try {
      text = new TextDecoder().decode(await boundedCommunityBody(request, 256));
    } catch {
      return fail();
    }
    if (
      text.length > 256 ||
      !same(new URLSearchParams(text).get("code") ?? "", c.key)
    )
      return fail();
    // Retain an expired marker until explicit exit, so expiry cannot turn a
    // pending TEST POST into an ordinary Production request.
    return new Response(null, {
      status: 303,
      headers: {
        ...headers,
        Location: "/app/login",
        "Set-Cookie": `${cookie}=${c.session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`,
      },
    });
  }
  if (!same(session!, c.session)) return fail();
  if (
    /^\/(?:admin|api\/(?:admin|internal))(?:\/|$)/.test(u.pathname) ||
    !["GET", "HEAD", "POST"].includes(request.method)
  )
    return html("<p>This route is outside customer acceptance.</p>", 403);
  if (request.method === "POST" && request.headers.get("origin") !== u.origin)
    return fail();
  const outgoing = new Headers();
  for (const name of [
    "accept",
    "accept-language",
    "content-type",
    "user-agent",
    "rsc",
    "next-router-state-tree",
    "next-router-prefetch",
    "next-url",
  ])
    if (request.headers.has(name))
      outgoing.set(name, request.headers.get(name)!);
  outgoing.set(
    "cookie",
    pairs.filter((x) => previewAuthCookie.test(x.split("=")[0])).join("; "),
  );
  outgoing.set("x-vercel-trusted-oidc-idp-token", c.oidc);
  if (request.headers.has("origin"))
    outgoing.set(
      "origin",
      "https://docked-preview-s24-briant-ginty.vercel.app",
    );
  // Never forward Production Auth, bearer tokens, forwarding headers or the
  // operator's admission cookie. Never follow a redirect to another origin.
  try {
    const body =
      request.method === "POST"
        ? Buffer.from(await boundedCommunityBody(request, 65536))
        : undefined;
    const r = await transport(c.target + u.pathname + u.search, {
      method: request.method,
      headers: outgoing,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    const h = new Headers(headers);
    for (const name of [
      "content-type",
      "content-disposition",
      "vary",
      "content-security-policy",
    ])
      if (r.headers.has(name)) h.set(name, r.headers.get(name)!);
    const location = r.headers.get("location");
    if (location) {
      const redirect = new URL(location, c.target);
      if (
        ![
          c.target,
          "https://docked-preview-s24-briant-ginty.vercel.app",
        ].includes(redirect.origin)
      )
        return fail();
      h.set("Location", redirect.pathname + redirect.search);
    }
    for (const value of r.headers.getSetCookie()) {
      if (
        !previewAuthCookie.test(value.split("=")[0]) ||
        /;\s*domain=/i.test(value)
      )
        return fail();
      h.append("Set-Cookie", value);
    }
    return new Response(r.body, { status: r.status, headers: h });
  } catch {
    return fail();
  }
}
