/** Tombstones for saved links and old clients. No flag can reactivate these APIs. */
export const retiredProductRoots = [
  "/edges",
  "/tips",
  "/results",
  "/research",
  "/methodology",
  "/learn",
  "/leagues",
  "/data-status",
  "/top-docked",
  "/my-edge",
  "/points",
  "/deals",
  "/membership",
  "/community/edges",
  "/api/edges",
  "/api/market-data",
  "/api/preview-edges",
  "/api/community-edges",
  "/api/top-docked",
  "/api/benefits",
  "/api/internal",
  "/api/admin/benefits",
  "/api/admin/community-edges",
  "/api/admin/community-recognition",
  "/api/admin/market-data-editorial",
  "/api/admin/models",
  "/api/admin/research",
  "/api/admin/scanner",
  "/admin/candidate-edges",
  "/admin/daily",
  "/admin/data-health",
  "/admin/edge-scanner",
  "/admin/forward-paper",
  "/admin/model-performance",
  "/admin/research",
  "/admin/strategies",
] as const;
export function retiredProductPath(path: string) {
  return (
    path === "/api/admin" ||
    retiredProductRoots.some(
      (root) => path === root || path.startsWith(root + "/"),
    )
  );
}
