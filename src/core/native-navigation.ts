const id =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const record = new RegExp(`^/(tips|edges|results)/(${id})$`);
const community = new RegExp(`^/community/(posts|edges)/(${id})$`);
const shortPost = new RegExp(`^/community/(${id})$`);
const staticPaths = new Set([
  "/home",
  "/edges",
  "/community",
  "/top-docked",
  "/notifications",
  "/profile",
  "/results",
  "/methodology",
  "/membership",
  "/dashboard",
]);
/** Pure allowlist; never imports cookies, session tokens or arbitrary destinations from a deep link. */
export function nativeDeepLink(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  let route: string;
  if (url.protocol === "docked:" && !url.port)
    route = `/${url.hostname}${url.pathname}`;
  else if (
    url.protocol === "https:" &&
    url.hostname === "docked.com.au" &&
    !url.port
  )
    route = url.pathname;
  else return null;
  if (route.endsWith("/") && route !== "/") route = route.slice(0, -1);
  if (url.search) return null;
  const official = route.match(record);
  if (official) return `/tips/${official[2]}`;
  if (community.test(route)) return route;
  const post = route.match(shortPost);
  if (post) return `/community/posts/${post[1]}`;
  if (
    /^\/profile\/[a-z][a-z0-9_]{2,23}$/.test(route) ||
    /^\/learn\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route)
  )
    return route;
  return staticPaths.has(route) ? route : null;
}
/** Only an authorization code can return; the original WebView's PKCE verifier remains mandatory. */
export function nativeAuthCallback(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "docked:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    return null;
  const entries = [...url.searchParams.keys()];
  if (
    entries.some((k) => !["code", "next"].includes(k)) ||
    new Set(entries).size !== entries.length
  )
    return null;
  const code = url.searchParams.get("code"),
    next = url.searchParams.get("next");
  if (
    !code ||
    !/^[A-Za-z0-9_-]{8,512}$/.test(code) ||
    (next !== null && next !== "/reset-password")
  )
    return null;
  const query = new URLSearchParams({ code });
  if (next) query.set("next", next);
  return `/auth/callback?${query}`;
}
export function safeSharePath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return nativeDeepLink(`https://docked.com.au${path}`);
}
export const nativePushTypes = [
  "official_edge",
  "edge_status",
  "comment",
  "reply",
  "follower",
  "followed_member_edge",
  "leaderboard",
  "system",
] as const;
export function nativeNotificationRoute(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { type?: unknown; path?: unknown };
  if (
    typeof value.type !== "string" ||
    !nativePushTypes.includes(value.type as (typeof nativePushTypes)[number]) ||
    typeof value.path !== "string"
  )
    return null;
  const route = safeSharePath(value.path);
  if (!route) return null;
  const family: Record<(typeof nativePushTypes)[number], RegExp> = {
    official_edge: /^\/tips\//,
    edge_status: /^\/tips\//,
    comment: /^\/community\/posts\//,
    reply: /^\/community\/posts\//,
    follower: /^\/profile\//,
    followed_member_edge: /^\/community\/edges\//,
    leaderboard: /^\/top-docked$/,
    system: /^\/(notifications|dashboard|home)$/,
  };
  return family[value.type as (typeof nativePushTypes)[number]].test(route)
    ? route
    : null;
}
