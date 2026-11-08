import { AsyncLocalStorage } from "node:async_hooks";

/** Fixed names only. Never attach a token, account, request ID, product or error
 * to diagnostics. Nested spans overlap; they are not additive transaction steps. */
export type PurchaseStage =
  | "purchase_auth"
  | "purchase_admission"
  | "purchase_verify"
  | "purchase_transaction"
  | "purchase_lock"
  | "purchase_rules"
  | "purchase_issue"
  | "purchase_persist"
  | "purchase_view"
  | "purchase_ack";

export class PurchaseTiming {
  private readonly started = performance.now();
  private readonly durations = new Map<PurchaseStage, number>();

  record(stage: PurchaseStage, milliseconds: number) {
    if (Number.isFinite(milliseconds) && milliseconds >= 0)
      this.durations.set(
        stage,
        (this.durations.get(stage) ?? 0) + milliseconds,
      );
  }

  snapshot() {
    return {
      ...Object.fromEntries(this.durations),
      purchase_total: performance.now() - this.started,
    } as Partial<Record<PurchaseStage, number>> & { purchase_total: number };
  }

  header() {
    return Object.entries(this.snapshot())
      .map(([stage, milliseconds]) => `${stage};dur=${milliseconds.toFixed(1)}`)
      .join(", ");
  }
}

const scope = new AsyncLocalStorage<PurchaseTiming>();

/** Also used by isolated benchmarks; the context never crosses requests. */
export function withPurchaseTiming<T>(
  timing: PurchaseTiming,
  operation: () => T,
): T {
  return scope.run(timing, operation);
}

export async function timePurchase<T>(
  stage: PurchaseStage,
  operation: () => PromiseLike<T>,
): Promise<T> {
  const timing = scope.getStore();
  if (!timing) return operation();
  const started = performance.now();
  try {
    return await operation();
  } finally {
    timing.record(stage, performance.now() - started);
  }
}

export function timePurchaseSync<T>(
  stage: PurchaseStage,
  operation: () => T,
): T {
  const timing = scope.getStore();
  if (!timing) return operation();
  const started = performance.now();
  try {
    return operation();
  } finally {
    timing.record(stage, performance.now() - started);
  }
}

/** Timing remains in the authenticated, no-store response, with no telemetry
 * upload or transaction payload logging. Success and recovery errors are timed. */
export function purchaseResponse(operation: () => Promise<Response>) {
  const timing = new PurchaseTiming();
  return withPurchaseTiming(timing, async () => {
    const response = await operation();
    response.headers.append("Server-Timing", timing.header());
    return response;
  });
}
