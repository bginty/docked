type Health = { attentionRequired: boolean } & Record<string, unknown>;
/** Keep the existing scheduler and legacy queue. Dormant commercial configuration
 * must not open a connection or run commercial jobs; checkout activation is not
 * required to reconcile refunds for an already configured service. */
export async function runGoogleReconciliationServices(
  env: Record<string, string | undefined>,
  services: {
    legacy: () => Promise<Health>;
    commercial: () => Promise<Health>;
  },
): Promise<Health & { services: Record<string, Health> }> {
  const enabled = [
    ...(env.DOCKED_GOOGLE_RECONCILIATION_ENABLED === "true"
      ? ["legacy" as const]
      : []),
    ...(env.DOCKED_COMMERCIAL_SERVICE === "true"
      ? ["commercial" as const]
      : []),
  ];
  if (!enabled.length) throw Error("Store reconciliation is disabled");
  // One provider/queue failure must not prevent the other queue from running.
  const results = await Promise.allSettled(
    enabled.map((name) => services[name]()),
  );
  if (results.some((r) => r.status === "rejected"))
    throw Error("Store reconciliation deferred; durable jobs retained");
  const health = Object.fromEntries(
    enabled.map((name, index) => [
      name,
      (results[index] as PromiseFulfilledResult<Health>).value,
    ]),
  );
  return {
    // Preserve the existing legacy scheduler's flat operational counters.
    ...(health.legacy ?? {}),
    services: health,
    attentionRequired: Object.values(health).some((r) => r.attentionRequired),
  };
}
