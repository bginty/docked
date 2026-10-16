import type { Operations } from "./owner-operations";
export type CommandCentre = {
  activeMembers: number;
  packsOpened: number;
  entriesUpdated: number;
  posts: number;
  pendingInvitations: number;
  suspendedMembers: number;
  daily: { day: string; entries: number; packs: number; posts: number }[];
  packFailures: { id: string; category: string; recorded_at: string }[];
  feedJobs: {
    id: string;
    provider: string;
    state: string;
    attempts: number;
    error_code: string | null;
    last_success: string | null;
    available_at: string;
    lease_until: string | null;
  }[];
  workerRuns: {
    id: number;
    started_at: string;
    finished_at: string | null;
    status: string;
  }[];
  lastRosterSync: string | null;
  weeklyEnabled: boolean;
  inventorySummary: { tier: string; issued: number; cap: number }[];
  limitations: string[];
};
export type OwnerAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  at: string;
  href: string;
  status: string;
};
export function ownerAlerts(data: Operations): OwnerAlert[] {
  const alerts: OwnerAlert[] = [];
  const wallet = data.wallet;
  if (wallet && (wallet.difference !== 0 || wallet.unbalancedTransactions > 0))
    alerts.push({
      id: "ledger",
      severity: "critical",
      title: "Test ledger requires reconciliation",
      detail: `${wallet.difference} credit difference · ${wallet.unbalancedTransactions} unbalanced journals`,
      at: data.generatedAt,
      href: "/fantasy/test-wallet",
      status: "Review required",
    });
  for (const x of data.centre?.packFailures ?? [])
    alerts.push({
      id: x.id,
      severity: x.category === "TRANSACTION" ? "warning" : "info",
      title: `Pack purchase: ${x.category.toLowerCase()}`,
      detail:
        "Recorded rejected purchase. Inspect the owner wallet report before taking action.",
      at: x.recorded_at,
      href: "/fantasy/test-wallet",
      status: "Recorded failure",
    });
  for (const x of data.centre?.feedJobs ?? []) {
    const expired =
      x.state === "leased" &&
      x.lease_until &&
      Date.parse(x.lease_until) < Date.parse(data.generatedAt);
    if (x.state !== "blocked" && !expired) continue;
    alerts.push({
      id: x.id,
      severity: "warning",
      title: `${x.provider} data job ${expired ? "lease expired" : "blocked"}`,
      detail: `${x.attempts} attempts · ${x.error_code ?? "Inspect feed operations"}`,
      at: x.last_success ?? x.available_at,
      href: "#owner-data",
      status: "Review required",
    });
  }
  for (const x of data.reports)
    alerts.push({
      id: x.id,
      severity: "warning",
      title: "Moderation report awaiting review",
      detail: "Review the protected report and its evidence.",
      at: x.created_at,
      href: "/admin/community/reports",
      status: x.status,
    });
  if (data.emailFailures)
    alerts.push({
      id: "email",
      severity: "warning",
      title: "Email delivery failures",
      detail: `${data.emailFailures} failed outbox messages in the selected range`,
      at: data.generatedAt,
      href: "/admin/preview-testers",
      status: "Review required",
    });
  const priority = { critical: 0, warning: 1, info: 2 };
  return alerts.sort(
    (a, b) =>
      priority[a.severity] - priority[b.severity] ||
      Date.parse(b.at) - Date.parse(a.at) ||
      a.id.localeCompare(b.id),
  );
}
