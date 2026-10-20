import { rarityLabel } from "./card-rarity";
export type SaleNotice = {
  price: number;
  fee: number;
  net: number;
  cardSnapshot?: {
    name?: string;
    tier?: string;
    serial?: number | null;
    max_supply?: number | null;
  };
};
export function saleNotice(receipt: SaleNotice) {
  const card = receipt.cardSnapshot;
  const serial = card?.serial
    ? ` #${String(card.serial).padStart(3, "0")}${card.max_supply ? `/${card.max_supply}` : ""}`
    : "";
  const name = card?.name ?? "Collectible card";
  const rarity = card?.tier ? rarityLabel(card.tier) : "";
  const number = (n: number) => n.toLocaleString("en-AU");
  return {
    title: "Card sold",
    body: `Your ${name}${rarity ? ` · ${rarity}` : ""}${serial} sold for ${number(receipt.price)} credits.`,
    detail: `Fee: ${number(receipt.fee)} credits · You received: ${number(receipt.net)} credits.`,
  };
}
