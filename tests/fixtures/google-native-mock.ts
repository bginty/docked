// Isolated browser fixture only. Never imported by the application build.
export const Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => "android",
};
export function registerPlugin() {
  return {
    capabilities: async () => ({ enabled: true }),
    products: async () => ({
      products: [
        {
          id: "synthetic-credit-package",
          name: "Synthetic 9900",
          offers: [
            {
              token: "fixture-offer",
              price: "A$99.00 (synthetic)",
              currency: "AUD",
            },
          ],
        },
      ],
    }),
    purchase: async () => {
      window.dispatchEvent(new Event("qa-google-checkout"));
      return { started: true };
    },
    reconcile: async () => ({ purchases: [] }),
    addListener: async (_name: string, fn: (event: unknown) => void) => {
      const handler = (e: Event) => fn((e as CustomEvent).detail);
      window.addEventListener("qa-google-receipt", handler);
      return {
        remove: async () => {
          window.removeEventListener("qa-google-receipt", handler);
        },
      };
    },
  };
}
export function completeSyntheticPurchase(cancel = false) {
  window.dispatchEvent(
    new CustomEvent("qa-google-receipt", {
      detail: {
        responseCode: cancel ? 1 : 0,
        purchases: cancel ? [] : [{ token: "synthetic-reference" }],
      },
    }),
  );
}
