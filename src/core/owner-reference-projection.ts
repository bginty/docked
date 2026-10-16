import type { CreditsState } from "./credits-sandbox";
import type { Operations } from "./owner-operations";
import { adminHref } from "./admin-navigation";
import {
  dashboardChange,
  type DashboardMetric,
  type OwnerReferenceAggregate,
  type OwnerReferenceData,
} from "./owner-reference-data";

/** Existing test economy only. This projection creates no receipts or balances. */
export function ownerReferenceProjection(
  source: OwnerReferenceAggregate,
  state: CreditsState | null,
  operations: Operations,
  range: { startAt: string; endAt: string; sport: string },
): OwnerReferenceData {
  if (
    state &&
    (state.mode !== "financial-sandbox-only" || state.policy.liveEnabled)
  )
    throw Error("Test reporting scope required");
  const start = Date.parse(range.startAt),
    end = Math.min(Date.parse(range.endAt), Date.parse(operations.generatedAt));
  const previousStart = start - (Date.parse(range.endAt) - start);
  const members = new Set(source.memberIds);
  const inRange = (at: number, previous = false) =>
    at >= (previous ? previousStart : start) && at < (previous ? start : end);
  const sportMatches = (sport: string | undefined) =>
    range.sport === "all" || sport === range.sport;
  const metric = (
    current: number | null,
    previous: number | null,
    unit: DashboardMetric["unit"],
    detail: string,
  ): DashboardMetric => ({
    current,
    previous,
    changePercent: dashboardChange(current, previous),
    unit,
    detail,
  });
  const packs = Object.values(state?.economy?.packs ?? {}).filter(
    (p) => members.has(p.member) && sportMatches(p.product.sport),
  );
  const packSales = new Map<string, OwnerReferenceData["packSales"][number]>();
  for (const p of packs.filter((p) => inRange(p.createdAt))) {
    const row = packSales.get(p.product.version) ?? {
      id: p.product.version,
      name: p.product.name,
      type: p.product.type,
      sport: p.product.sport,
      cards: p.product.cards,
      sold: 0,
      testCredits: 0,
      revenueAud: null,
    };
    row.sold++;
    row.testCredits += p.product.priceCredits;
    packSales.set(p.product.version, row);
  }
  const playerForCard = (card: string) => {
    const instance = state?.economy?.instances[card];
    return instance ? state?.economy?.players[instance.playerId] : undefined;
  };
  // Private credit-only offers settle through these same listing receipts. Do
  // not count the private offer again. Swaps have one immutable acceptance event.
  const receipts = new Map<
    string,
    { id: string; at: number; card: string; credits: number }
  >();
  for (const [id, listing] of Object.entries(state?.listings ?? {})) {
    if (
      listing.status !== "SOLD" ||
      !listing.receipt ||
      !members.has(listing.member) ||
      !listing.buyer ||
      !members.has(listing.buyer) ||
      !sportMatches(playerForCard(listing.card)?.sport)
    )
      continue;
    receipts.set(listing.receipt.reference, {
      id,
      at: listing.receipt.at,
      card: listing.card,
      credits: listing.receipt.price,
    });
  }
  const swaps: { id: string; at: number }[] = [];
  const acceptedEvents = new Map<string, number>();
  for (const event of state?.events ?? []) {
    const command = event.command as { kind?: string; swap?: string };
    if (
      command.kind === "accept" &&
      command.swap &&
      !acceptedEvents.has(command.swap)
    )
      acceptedEvents.set(command.swap, event.at);
  }
  for (const [id, swap] of Object.entries(state?.swaps ?? {})) {
    const at = acceptedEvents.get(id);
    if (
      swap.status !== "ACCEPTED" ||
      at === undefined ||
      !members.has(swap.member) ||
      !members.has(swap.other)
    )
      continue;
    if (
      ![...swap.give, ...swap.take].every((id) =>
        sportMatches(playerForCard(id)?.sport),
      )
    )
      continue;
    swaps.push({ id, at });
  }
  const trades = [...receipts.values(), ...swaps];
  const topCards = new Map<string, OwnerReferenceData["topCards"][number]>();
  for (const sale of [...receipts.values()]
    .filter((s) => inRange(s.at))
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))) {
    const instance = state?.economy?.instances[sale.card],
      player = playerForCard(sale.card);
    if (!instance || !player) continue;
    const row = topCards.get(instance.definition) ?? {
      id: instance.definition,
      name: player.name,
      sport: player.sport,
      position: player.position,
      rarity: instance.rarity,
      sales: 0,
      testCredits: 0,
      revenueAud: null,
      thumbnail: {
        name: player.name,
        position: player.position,
        tier: instance.rarity,
        sport: player.sport,
        team: instance.printedTeam,
        serial: instance.serial,
        max_supply: instance.lifetimeCap,
        verifiedJerseyNumber: player.verifiedJerseyNumber,
      },
    };
    row.sales++;
    row.testCredits += sale.credits;
    topCards.set(row.id, row);
  }
  const recent = [...source.recent];
  for (const p of packs.filter((p) => inRange(p.createdAt)))
    recent.push({
      id: `pack:${p.id}`,
      kind: "pack",
      title: "Pack purchased",
      detail: p.product.name,
      at: new Date(p.createdAt).toISOString(),
      href: adminHref("packs"),
    });
  for (const t of trades.filter((t) => inRange(t.at)))
    recent.push({
      id: `trade:${t.id}`,
      kind: "trade",
      title: "Test-credit trade completed",
      at: new Date(t.at).toISOString(),
      href: adminHref("marketplace"),
    });
  recent.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
  );
  const failedJobs = operations.centre?.feedJobs.some(
    (j) =>
      j.state === "blocked" ||
      (j.state === "leased" &&
        j.lease_until !== null &&
        Date.parse(j.lease_until) < Date.parse(operations.generatedAt)),
  );
  return {
    generatedAt: operations.generatedAt,
    period: {
      start: range.startAt,
      end: new Date(end).toISOString(),
      previousStart: new Date(previousStart).toISOString(),
      previousEnd: range.startAt,
      timezone: "Australia/Sydney",
    },
    kpis: {
      users: metric(
        source.usersCurrent,
        source.usersPrevious,
        "members",
        "Registered beta profiles at period end; compared with period start",
      ),
      packs: metric(
        state ? packs.filter((p) => inRange(p.createdAt)).length : null,
        state ? packs.filter((p) => inRange(p.createdAt, true)).length : null,
        "packs",
        "Completed nine-card test-credit purchases; rewards and replays excluded",
      ),
      revenue: metric(
        null,
        null,
        "AUD",
        "Real-money payments disabled; no settled AUD reporting source",
      ),
      trades: metric(
        state ? trades.filter((t) => inRange(t.at)).length : null,
        state ? trades.filter((t) => inRange(t.at, true)).length : null,
        "trades",
        "Completed test-credit sales and accepted swaps; both members in selected scope",
      ),
      circulation: metric(
        source.circulationCurrent,
        source.circulationPrevious,
        "cards",
        "Issued legacy and permanent beta instances; all owners, selected sport",
      ),
    },
    registrations: source.registrations,
    newUsers: {
      current: source.newUsersCurrent,
      previous: source.newUsersPrevious,
      changePercent: dashboardChange(
        source.newUsersCurrent,
        source.newUsersPrevious,
      ),
    },
    revenueSeries: null,
    packSales: [...packSales.values()]
      .sort((a, b) => b.sold - a.sold || a.id.localeCompare(b.id))
      .slice(0, 10),
    topCards: [...topCards.values()]
      .sort(
        (a, b) =>
          b.sales - a.sales ||
          b.testCredits - a.testCredits ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5),
    recent: recent.slice(0, 20),
    moderation: source.moderation,
    health: [
      {
        id: "database",
        label: "Database",
        status: "passed",
        detail: "This authorised read-only reporting transaction completed",
        checkedAt: operations.generatedAt,
        href: "/admin/operations#owner-data",
      },
      {
        id: "api",
        label: "API",
        status: "unknown",
        detail: "No independent API probe recorded",
        checkedAt: null,
        href: adminHref("settings"),
      },
      {
        id: "web",
        label: "Web application",
        status: "unknown",
        detail:
          "Dashboard render is not an end-to-end application health check",
        checkedAt: null,
        href: adminHref("settings"),
      },
      {
        id: "android",
        label: "Android app",
        status: "unknown",
        detail: "No physical-device health observation recorded",
        checkedAt: null,
        href: adminHref("settings"),
      },
      {
        id: "jobs",
        label: "Background jobs",
        status: failedJobs ? "warning" : "unknown",
        detail: failedJobs
          ? "Recorded blocked or expired feed job requires review"
          : "No current end-to-end worker health probe",
        checkedAt: operations.generatedAt,
        href: "/admin/operations#owner-data",
      },
      {
        id: "email",
        label: "Email service",
        status: operations.emailFailures ? "warning" : "unknown",
        detail: operations.emailFailures
          ? `${operations.emailFailures} recorded delivery failures`
          : "No successful delivery probe recorded",
        checkedAt: operations.generatedAt,
        href: "/admin/preview-testers",
      },
    ],
    limitations: [
      "All economy reporting is isolated test-credit activity, never AUD revenue. Older single-card payment experiments are excluded from nine-card pack sales.",
      "Member growth is account-wide and based on completed profile registration, including subsequently restricted accounts; staff inclusion follows the report filter.",
      "Previous flow comparison is the immediately preceding equal elapsed-time window. An in-progress period is not a forecast.",
      "Top Cards counts completed credit-sale receipts only. Swap or combined-offer card values are not imputed. Unknown sport is omitted from sport-specific reports.",
      "Circulation includes all issued instances regardless of current owner or staff status. No historical owner reconstruction is implied.",
      "Recent activity is redacted, refreshed on report load, and capped at 20. No private email, ledger lines or report evidence is included.",
      "A listing-specific moderation case adapter is not available; that category remains unavailable rather than reporting a false zero.",
    ],
  };
}
