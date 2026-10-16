import type { OwnerReferenceData } from "./owner-reference-data";
export type HealthObservation = {
  service: "api" | "web";
  status: "passed" | "failed";
  code:
    | "matched"
    | "unexpected_response"
    | "timeout_or_network"
    | "invalid_configuration";
  statusCode: number | null;
  durationMs: number;
  checkedAt: string;
  expiresAt: string;
};
export function healthOrigin(site: string | undefined, hosted: boolean) {
  const url = new URL(site ?? "");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("Invalid health origin");
  if (
    url.origin !== "https://docked.com.au" &&
    (hosted ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.protocol !== "http:")
  )
    throw Error("Invalid health origin");
  return url.origin;
}
export function applyHealthObservations(
  health: OwnerReferenceData["health"],
  rows: HealthObservation[],
  now: number,
): OwnerReferenceData["health"] {
  return health.map((item) => {
    const row = rows.find((r) => r.service === item.id);
    if (!row) return item;
    const checked = Date.parse(row.checkedAt),
      expiry = Date.parse(row.expiresAt);
    const fresh =
      Number.isFinite(now) &&
      Number.isFinite(checked) &&
      Number.isFinite(expiry) &&
      checked <= now &&
      expiry > now &&
      expiry - checked <= 301000;
    return {
      ...item,
      status: fresh ? row.status : "unknown",
      checkedAt: row.checkedAt,
      href: "/admin/operations#owner-health-evidence",
      detail: `${fresh ? "Recorded" : "Stale"} ${row.service === "api" ? "release identity API" : "public login page"} check: ${row.code.replaceAll("_", " ")}${row.statusCode ? ` (HTTP ${row.statusCode})` : ""}; ${row.durationMs} ms. Checked ${row.checkedAt}; expires ${row.expiresAt}. This does not verify authenticated member journeys.`,
    };
  });
}
