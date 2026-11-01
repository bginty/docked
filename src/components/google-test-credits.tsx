"use client";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";

type StoreItem = {
  id: string;
  name: string;
  offers: { token: string; price: string; currency: string }[];
};
type PurchaseEvent = { responseCode: number; purchases: { token: string }[] };
interface Billing {
  capabilities(): Promise<{ enabled: boolean }>;
  products(): Promise<{ products: StoreItem[] }>;
  purchase(args: {
    productId: string;
    accountBinding: string;
    offerToken: string;
  }): Promise<unknown>;
  reconcile(): Promise<{ purchases: { token: string }[] }>;
  addListener(
    name: "purchasesUpdated",
    callback: (e: PurchaseEvent) => void,
  ): Promise<PluginListenerHandle>;
}
const billing = registerPlugin<Billing>("DockedBilling");
type Session = {
  member: string;
  accountBinding: string;
  environment: "test";
  products: { id: string; credits: number }[];
};
const endpoint = "/api/store/google/test";
/** Invisible unless BOTH the native allowlist and account-specific server gate
 * admit no-charge testing. No PayPal link, client allocation or local receipt cache. */
export function GoogleTestCredits({
  member,
  onSettled,
}: {
  member: string;
  onSettled: () => Promise<void>;
}) {
  const [items, setItems] = useState<(StoreItem & { credits: number })[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(true),
    running = useRef(false),
    queue = useRef(Promise.resolve()),
    settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);
  async function readSession() {
    const r = await boundedFetch(endpoint, { cache: "no-store" });
    if (!r.ok) throw Error("Google testing is not enabled for this account.");
    const s = (await r.json()) as Session;
    if (
      s.member !== member ||
      s.environment !== "test" ||
      !/^[a-f0-9]{64}$/.test(s.accountBinding)
    )
      throw Error("Purchase session unavailable.");
    return s;
  }
  useEffect(() => {
    active.current = true;
    let stopped = false;
    let listener: PluginListenerHandle | undefined;
    const receive = (purchases: { token: string }[]) => {
      // Serial delivery also handles duplicate Play callbacks safely. Token never
      // enters browser persistence; the server inbox provides durable idempotency.
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          if (stopped) return;
          for (const p of purchases.slice(0, 16)) {
            const r = await boundedFetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: p.token }),
            });
            if (!r.ok)
              throw Error(
                "Purchase verification is pending. Use Check purchases to retry.",
              );
            const result = await r.json();
            if (!stopped)
              setMessage(
                result.state === "PENDING"
                  ? "Payment is pending; no credits added."
                  : result.state === "PURCHASED"
                    ? "Test purchase verified."
                    : "Purchase cancelled or refunded.",
              );
          }
          if (!stopped) {
            await settled.current();
            window.dispatchEvent(new Event("docked-app-resume"));
          }
        })
        .catch((e) => {
          if (!stopped)
            setMessage(
              e instanceof Error ? e.message : "Verification pending.",
            );
        })
        .finally(() => {
          if (!stopped) {
            running.current = false;
            setBusy(false);
          }
        });
    };
    void (async () => {
      if (
        !Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() !== "android" ||
        !(await billing.capabilities()).enabled
      )
        return;
      const s = await readSession();
      const available = await billing.products();
      if (stopped) return;
      setSession(s);
      setItems(
        available.products.flatMap((p) => {
          const approved = s.products.find((a) => a.id === p.id);
          return approved && p.offers.some((o) => o.currency === "AUD")
            ? [
                {
                  ...p,
                  offers: p.offers.filter((o) => o.currency === "AUD"),
                  credits: approved.credits,
                },
              ]
            : [];
        }),
      );
      listener = await billing.addListener("purchasesUpdated", (e) => {
        if (stopped) return;
        if (e.responseCode === 0) receive(e.purchases);
        else {
          running.current = false;
          setBusy(false);
          setMessage(
            e.responseCode === 1
              ? "Purchase cancelled. No confirmed charge."
              : "Google Play could not finish. Check purchases before retrying.",
          );
        }
      });
      if (stopped) {
        await listener.remove();
        return;
      }
      receive((await billing.reconcile()).purchases);
    })().catch(() => {
      if (!stopped) {
        setItems([]);
        setSession(null);
      }
    });
    return () => {
      stopped = true;
      active.current = false;
      void listener?.remove();
    };
  }, [member]);
  if (!session) return null;
  async function buy(item: StoreItem) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      const s = await readSession();
      if (
        s.accountBinding !== session!.accountBinding ||
        !s.products.some((p) => p.id === item.id)
      )
        throw Error("Account or product changed. Refresh before purchasing.");
      const fresh = (await billing.products()).products.find(
          (p) => p.id === item.id,
        ),
        offer = fresh?.offers.find((o) => o.currency === "AUD");
      if (!offer) throw Error("This product is currently unavailable.");
      // Google's own confirmation shows the current authoritative price. This
      // button starts checkout only; the server never credits a client result.
      await billing.purchase({
        productId: item.id,
        accountBinding: s.accountBinding,
        offerToken: offer.token,
      });
    } catch (e) {
      if (active.current) {
        running.current = false;
        setBusy(false);
        setMessage(e instanceof Error ? e.message : "Google Play unavailable.");
      }
    }
  }
  return (
    <section className="panel" aria-labelledby="google-test-title">
      <h2 id="google-test-title">Google Play test purchases</h2>
      <p>
        Authorised license testing only. Continue only when Google shows a test
        payment method and confirms you will not be charged.
      </p>
      {items.map((item) => (
        <button
          className="primary"
          key={item.id}
          disabled={busy}
          onClick={() => void buy(item)}
        >
          {item.credits.toLocaleString("en-AU")} test credits ·{" "}
          {item.offers[0].price}
        </button>
      ))}
      <button
        disabled={busy}
        onClick={() => {
          if (running.current) return;
          running.current = true;
          setBusy(true);
          void billing
            .reconcile()
            .then(async (data) => {
              for (const p of data.purchases.slice(0, 16)) {
                const r = await boundedFetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token: p.token }),
                });
                if (!r.ok) throw Error("Verification pending. Retry later.");
              }
              const reconciled = await boundedFetch(
                endpoint + "?action=reconcile",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                },
              );
              if (!reconciled.ok)
                throw Error("Server reconciliation pending. Retry later.");
              const result = await reconciled.json();
              await settled.current();
              window.dispatchEvent(new Event("docked-app-resume"));
              setMessage(
                result.morePossible
                  ? "Purchases checked. More may remain; check again shortly."
                  : "Available purchases checked.",
              );
            })
            .catch(() => setMessage("Verification pending. Retry later."))
            .finally(() => {
              running.current = false;
              setBusy(false);
            });
        }}
      >
        Check purchases
      </button>
      {!items.length && <p>No test products are currently available.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
