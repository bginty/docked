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
  const minutes = Math.ceil(remaining / 60000);
  return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`;
}
