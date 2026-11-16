export class BoundedRequestError extends Error {
  constructor() {
    super(
      "Connection timed out or interrupted. Retry to check the saved state.",
    );
    this.name = "BoundedRequestError";
  }
}
/** Read/mutation timeout without automatic mutation retries. Callers retain idempotency keys. */
export async function boundedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeout = 15000,
) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  init.signal?.addEventListener("abort", relay, { once: true });
  if (init.signal?.aborted) controller.abort();
  let rejectDeadline: (error: Error) => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const interrupted = () => rejectDeadline(new BoundedRequestError());
  controller.signal.addEventListener("abort", interrupted, { once: true });
  if (controller.signal.aborted) interrupted();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        // All callers consume finite JSON. Include body transfer in the deadline;
        // headers alone must not leave a screen waiting forever.
        const body = await response.arrayBuffer();
        return new Response(body.byteLength ? body : null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      })(),
    ]);
  } catch (e) {
    if (controller.signal.aborted) throw new BoundedRequestError();
    throw e;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", interrupted);
    init.signal?.removeEventListener("abort", relay);
  }
}
/** For read-only server rendering; underlying DB/socket timeouts remain in force. */
export async function boundedRead<T>(
  operation: Promise<T>,
  timeout = 15000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Loading timed out. Please retry.")),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
