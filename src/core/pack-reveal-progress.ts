import { revealIndex, revealKey, type PackReceipt } from "./pack-opening";

export type RevealProgress = {
  index: number;
  revealed: boolean;
  updatedAt: number;
};
export const revealProgressEvent = "docked:reveal-progress";
/** Presentation only: no player, wallet, card metadata or receipt body is persisted. */
export function revealProgressKey(
  user: string,
  receipt: Pick<PackReceipt, "id">,
) {
  return `docked:reveal:v2:${user}:${receipt.id}`;
}
export function parseRevealProgress(
  raw: string | null,
  count: number,
): RevealProgress | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      !value ||
      !Number.isSafeInteger(value.index) ||
      value.index < 0 ||
      value.index > count ||
      typeof value.revealed !== "boolean" ||
      !Number.isSafeInteger(value.updatedAt) ||
      value.updatedAt < 0
    )
      return null;
    return {
      index: value.index,
      revealed: value.index < count && value.revealed,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
export function readRevealProgress(
  storage: Pick<Storage, "getItem">,
  user: string,
  receipt: PackReceipt,
): RevealProgress | null {
  try {
    const current = parseRevealProgress(
      storage.getItem(revealProgressKey(user, receipt)),
      receipt.cards.length,
    );
    if (current) return current;
    const legacy = storage.getItem(revealKey(user, receipt));
    return legacy === null
      ? null
      : {
          index: revealIndex(legacy, receipt.cards.length),
          revealed: false,
          updatedAt: 0,
        };
  } catch {
    return null;
  }
}
