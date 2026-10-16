export type PackTab = "buy" | "mine" | "history";
export function packTitle(p: {name:string; tier?:string; type?:string|null}) {
  const type = p.type ?? p.tier;
  return type === "PREMIUM" ? "Premium Pack" : type === "STANDARD" ? "Standard Pack" : p.name;
}
export function packTab(search: string, hash = ""): PackTab {
  const value = new URLSearchParams(search).get("packs");
  return value === "mine" || value === "history"
    ? value
    : hash === "#pack-history"
      ? "history"
      : "buy";
}
export function newestPacks<
  T extends { id: string; purchasedAt: number | null },
>(packs: T[]): T[] {
  return [...packs].sort(
    (a, b) =>
      (b.purchasedAt ?? -Infinity) - (a.purchasedAt ?? -Infinity) ||
      a.id.localeCompare(b.id),
  );
}
export function packBalance(available: number, cost: number) {
  if (
    ![available, cost].every(Number.isSafeInteger) ||
    available < 0 ||
    cost < 0
  )
    throw Error("Invalid credit amount");
  return available - cost;
}
