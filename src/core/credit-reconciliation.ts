import { DateTime } from "luxon";
import { financialReport } from "./credits-sandbox";
import { csv } from "./owner-operations";
type Report = ReturnType<typeof financialReport>;
/** Sydney calendar dates, inclusive start/exclusive next midnight. No implicit UTC day. */
export function reconciliationRange(from?: string | null, to?: string | null) {
  const parse = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Error("Use YYYY-MM-DD dates");
    const d = DateTime.fromISO(v, { zone: "Australia/Sydney" });
    if (!d.isValid) throw Error("Invalid reporting date");
    return d;
  };
  const start = from ? parse(from).toMillis() : 0;
  const end = to
    ? parse(to).plus({ days: 1 }).toMillis()
    : Number.MAX_SAFE_INTEGER;
  if (end <= start) throw Error("End date must follow start date");
  return { start, end };
}
export function reconciliationRows(
  report: Report,
  range = reconciliationRange(),
) {
  const lots = new Map(report.fundingLots.map((l) => [l.id, l]));
  let balance = 0;
  const rows = [];
  for (const j of report.transactions) {
    const memberLines = j.lines.filter((l) => l.account.startsWith("lot:"));
    const net = memberLines.reduce((n, l) => n + l.credits, 0);
    const opening = balance;
    balance += net;
    if (j.at < range.start || j.at >= range.end) continue;
    const funding = [
      ...new Set(
        memberLines.map(
          (l) => lots.get(l.account.split(":")[1])?.provenance ?? "MISSING_LOT",
        ),
      ),
    ];
    const users = [
      ...new Set(
        memberLines.map(
          (l) => lots.get(l.account.split(":")[1])?.member ?? "MISSING_MEMBER",
        ),
      ),
    ];
    const refs = report.deposits.filter(
      (d) =>
        funding.includes(`payment:${d.capture}`) || d.id === j.depositReference,
    );
    for (const d of refs)
      if (d.capture && !funding.includes(`payment:${d.capture}`))
        funding.push(`payment:${d.capture}`);
    for (const d of refs) if (!users.includes(d.member)) users.push(d.member);
    const commission = j.lines
      .filter((l) => l.account === "system:commission")
      .reduce((n, l) => n + l.credits, 0);
    const debit = -memberLines
      .filter((l) => l.credits < 0)
      .reduce((n, l) => n + l.credits, 0);
    const credit = memberLines
      .filter((l) => l.credits > 0)
      .reduce((n, l) => n + l.credits, 0);
    rows.push({
      id: j.id,
      at: j.at,
      type: j.type,
      environment: j.environment,
      actor: j.actor,
      users,
      funding,
      providerReferences: refs.map((d) =>
        [d.provider, d.capture, d.settlement?.reference]
          .filter(Boolean)
          .join(" / "),
      ),
      grossDebit: debit,
      grossCredit: credit,
      sellerProceeds: j.type === "buy" ? credit : 0,
      commission,
      classification: ["refund-event", "reverse"].includes(j.type)
        ? j.type
        : "ordinary",
      liabilityMovement: net,
      opening,
      closing: balance,
      exception:
        j.lines.reduce((n, l) => n + l.credits, 0) !== 0
          ? "UNBALANCED"
          : funding.includes("MISSING_LOT")
            ? "MISSING_LOT"
            : refs.some((d) => d.status === "REVIEW")
              ? "CURRENT_FUNDING_REVIEW"
              : "NONE",
      reason: j.reason,
      postings: j.lines,
      hash: j.hash,
      previousHash: j.previousHash,
    });
  }
  const before = report.transactions
    .filter((j) => j.at < range.start)
    .flatMap((j) => j.lines)
    .filter((l) => l.account.startsWith("lot:"))
    .reduce((n, l) => n + l.credits, 0);
  return {
    rows,
    opening: before,
    closing: before + rows.reduce((n, r) => n + r.liabilityMovement, 0),
    range,
  };
}
export function reconciliationCsv(
  report: Report,
  range = reconciliationRange(),
) {
  const view = reconciliationRows(report, range);
  return csv([
    [
      "Record",
      "Environment",
      "Transaction",
      "Timestamp UTC",
      "Type",
      "Actor",
      "User references",
      "Funding sources",
      "Provider references",
      "Gross debit credits",
      "Gross credit credits",
      "Seller proceeds",
      "Commission",
      "Classification",
      "Liability movement",
      "Opening customer liability",
      "Closing customer liability",
      "Exception (current funding state)",
      "Reason",
      "Immutable postings",
      "Hash",
      "Previous hash",
    ],
    [
      "PERIOD",
      "financial-sandbox-only",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      0,
      0,
      0,
      0,
      "",
      view.closing - view.opening,
      view.opening,
      view.closing,
      "",
      "Sydney date range; test only; all amounts whole credits; one row per transaction, never sum opening/closing balances",
      "",
      "",
      "",
    ],
    ...view.rows.map((r) => [
      "TRANSACTION",
      r.environment,
      r.id,
      new Date(r.at).toISOString(),
      r.type,
      r.actor,
      r.users.join(" | "),
      r.funding.join(" | "),
      r.providerReferences.join(" | "),
      r.grossDebit,
      r.grossCredit,
      r.sellerProceeds,
      r.commission,
      r.classification,
      r.liabilityMovement,
      r.opening,
      r.closing,
      r.exception,
      r.reason,
      JSON.stringify(r.postings),
      r.hash,
      r.previousHash,
    ]),
  ]);
}
