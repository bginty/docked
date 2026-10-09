import { timingSafeEqual } from "node:crypto";
/** No URL/query credentials, fallback key, or browser-session authorization. */
export function scannerWorkerAuthorized(
  expected: string | undefined,
  authorization: string | null,
) {
  if (
    !expected ||
    !/^[-A-Za-z0-9_]{32,200}$/.test(expected) ||
    !authorization?.startsWith("Bearer ")
  )
    return false;
  const actual = Buffer.from(authorization, "utf8"),
    wanted = Buffer.from(`Bearer ${expected}`, "utf8");
  return (
    actual.byteLength === wanted.byteLength && timingSafeEqual(actual, wanted)
  );
}
