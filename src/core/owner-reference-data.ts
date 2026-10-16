/** Browser-safe, aggregate-only owner reporting contract. No wallet or identity documents. */
export type DashboardMetric = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
  unit: "members" | "packs" | "AUD" | "trades" | "cards";
  detail: string;
};
export type OwnerActivity = {
  id: string;
  kind:
    | "registration"
    | "pack"
    | "trade"
    | "listing"
    | "report"
    | "moderation"
    | "competition";
  title: string;
  detail?: string;
  at: string;
  href: string;
};
export type OwnerReferenceData = {
  generatedAt: string;
  period: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    timezone: "Australia/Sydney";
  };
  kpis: {
    users: DashboardMetric;
    packs: DashboardMetric;
    revenue: DashboardMetric;
    trades: DashboardMetric;
    circulation: DashboardMetric;
  };
  registrations: { day: string; registrations: number; cumulative: number }[];
  newUsers: { current: number; previous: number; changePercent: number | null };
  revenueSeries: null;
  packSales: {
    id: string;
    name: string;
    type: "STANDARD" | "PREMIUM";
    sport: string;
    cards: number;
    sold: number;
    testCredits: number;
    revenueAud: null;
  }[];
  topCards: {
    id: string;
    name: string;
    sport: string;
    position: string;
    rarity: string;
    sales: number;
    testCredits: number;
    revenueAud: null;
    thumbnail?: {
      name: string;
      position: string;
      tier: string;
      sport: string;
      team: string;
      serial: number;
      max_supply: number;
      verifiedJerseyNumber?: number | null;
    };
  }[];
  recent: OwnerActivity[];
  moderation: { content: number; members: number; listings: number | null };
  health: {
    id: "database" | "api" | "web" | "android" | "jobs" | "email";
    label: string;
    status: "passed" | "warning" | "failed" | "unknown";
    detail: string;
    checkedAt: string | null;
    href: string;
  }[];
  limitations: string[];
};

/** Zero-baseline growth is undefined, not fabricated as a 100% increase. */
export function dashboardChange(
  current: number | null,
  previous: number | null,
): number | null {
  return current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}

/** Internal database result: member IDs never leave the server-side projection. */
export type OwnerReferenceAggregate = {
  memberIds: string[];
  usersCurrent: number;
  usersPrevious: number;
  newUsersCurrent: number;
  newUsersPrevious: number;
  registrations: OwnerReferenceData["registrations"];
  circulationCurrent: number;
  circulationPrevious: number;
  moderation: OwnerReferenceData["moderation"];
  recent: OwnerActivity[];
};
