/** Bounded, device-local User Timing only. Never contains a member, token,
 * receipt, product identifier, balance or card. Nothing is sent to analytics. */
type Flow =
  "test-credit" | "commercial-credit" | "google-test" | "google-commercial";
type Stage =
  | "purchase"
  | "open"
  | "checkout"
  | "verification"
  | "assets"
  | "receipt-render";
const serverNames = new Set([
  "purchase_total",
  "purchase_auth",
  "purchase_admission",
  "purchase_verify",
  "purchase_transaction",
  "purchase_lock",
  "purchase_rules",
  "purchase_issue",
  "purchase_persist",
  "purchase_view",
  "purchase_ack",
]);
export function purchaseTiming(flow: Flow, stage: Stage) {
  const start = typeof performance === "undefined" ? 0 : performance.now();
  let finished = false;
  return (outcome: "confirmed" | "pending" | "failed", response?: Response) => {
    if (finished || typeof performance === "undefined") return;
    finished = true;
    const server: Record<string, number> = {};
    for (const item of (response?.headers.get("server-timing") ?? "").split(
      ",",
    )) {
      const match = item.trim().match(/^([a-z_]+);dur=([\d.]+)/);
      if (
        match &&
        serverNames.has(match[1]) &&
        Number.isFinite(Number(match[2]))
      )
        server[match[1]] = (server[match[1]] ?? 0) + Number(match[2]);
    }
    const name = `docked.purchase.${flow}.${stage}`;
    try {
      // Bound every fixed-name buffer for long-running installed-app sessions.
      if (performance.getEntriesByName(name, "measure").length >= 32)
        performance.clearMeasures(name);
      performance.measure(name, {
        start,
        end: performance.now(),
        detail: { outcome, server },
      });
    } catch {
      /* Measurement must never affect a transaction. */
    }
  };
}
