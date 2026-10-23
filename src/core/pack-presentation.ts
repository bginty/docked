export type PackTab = "buy" | "mine" | "history";
/** One pack shop, including bookmarks from the former /fantasy/packs links. */
export function packShopHref(sport?: string, tab: PackTab = "buy") {
  const query = new URLSearchParams({ view: "packs" });
  if (sport) query.set("sport", sport);
  if (tab !== "buy") query.set("packs", tab);
  return `/fantasy/test-wallet?${query}`;
}
export function packTitle(p: {
  name: string;
  tier?: string;
  type?: string | null;
  cards?: number;
  cardCount?: number | null;
}) {
  const type = p.type ?? p.tier;
  const count = p.cards ?? p.cardCount;
  const size = count ? ` ${count}` : "";
  return type === "PREMIUM"
    ? `Premium${size} Pack`
    : type === "STANDARD"
      ? `Standard${size} Pack`
      : p.name;
}
export function packTab(search: string, hash = ""): PackTab {
  const query = new URLSearchParams(search);
  const value = query.get("packs") ?? query.get("tab");
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
