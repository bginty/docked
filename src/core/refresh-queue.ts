/** Coalesce read invalidations only. Never cache values or retry mutations. */
export function createRefreshQueue(
  read: (current: () => boolean) => Promise<void>,
) {
  let generation = 0;
  let running = false;
  let scheduled = false;
  let disposed = false;
  const schedule = () => {
    if (disposed || scheduled || running) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      if (disposed) return;
      running = true;
      const started = generation;
      try {
        await read(() => !disposed && started === generation);
      } finally {
        running = false;
        // A purchase/resume during a read needs one NEW authoritative read.
        if (!disposed && started !== generation) schedule();
      }
    });
  };
  return {
    request() {
      generation++;
      schedule();
    },
    dispose() {
      disposed = true;
      generation++;
    },
  };
}
