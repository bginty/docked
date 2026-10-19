import type { PackReceipt } from "./pack-opening";
export const weeklyCorePolicy = {
  version: "weekly-core-nfl-v1",
  name: "Weekly Core Pack",
  cards: 4,
  periodSeconds: 604800,
  sport: "nfl",
  positions: ["QB", "RB", "WR", "TE"],
  rarity: "CORE",
  price: 0,
} as const;
export type WeeklyCoreView = {
  enabled: boolean;
  serverTime: number;
  member?: string;
  policy?: string;
  enrolledAt?: string;
  nextIssueAt?: string;
  packs: {
    id: string;
    issuedAt: string;
    dueAt: string;
    openedAt: string | null;
    receipt: PackReceipt | null;
  }[];
};
export function weeklyCountdown(next: string | undefined, now: number) {
  const remaining = next ? Date.parse(next) - now : NaN;
  if (!Number.isFinite(remaining)) return "Checking schedule…";
  if (remaining <= 0) return "Checking your next pack…";
  const seconds = Math.ceil(remaining / 1000);
  return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
}
