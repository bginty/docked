import type { MemberTestView } from "./member-test-wallet";
/** Shared presentation contract, independent of the settlement implementation. */
export type PackShopState = Pick<
  MemberTestView,
  "member" | "economyEnabled"
> & {
  packs: (MemberTestView["packs"][number] & {
    award?: { id: string; reason: "PROMOTION" | "PRIZE" } | null;
  })[];
  products: (Omit<
    MemberTestView["products"][number],
    "inventoryScope" | "availabilityReason"
  > & { availabilityReason: string | null })[];
  wallet: { spendable: number };
  environment?: "commercial";
};
