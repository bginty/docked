"use client";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { useEffect, useRef, useState } from "react";

type Session = {
  enabled: boolean;
  environment: "test";
  member?: string;
  accountBinding?: string;
};
type Item = {
  id: string;
  name: string;
  price: string;
  currency: string;
  credits: number;
};
const apple = registerPlugin<{
  capabilities(): Promise<Session>;
  products(): Promise<{ products: Item[] }>;
  purchase(input: {
    productId: string;
    accountBinding: string;
  }): Promise<{ state: string }>;
  reconcile(): Promise<{ checked: boolean }>;
  addListener(
    event: "purchaseSettled",
    callback: () => void,
  ): Promise<PluginListenerHandle>;
}>("DockedAppleBilling");

/** Hidden unless the native sandbox build and authenticated server admission
 * both permit this exact member. No checkout SDK or requests on Android/web. */
export function AppleTestCredits({
  member,
  onSettled,
}: {
  member: string;
  onSettled: () => Promise<void>;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const running = useRef(false),
    active = useRef(true),
    settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);
  useEffect(() => {
    active.current = true;
    let stopped = false,
      listener: PluginListenerHandle | undefined;
    if (Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform()) {
      void (async () => {
        const s = await apple.capabilities();
        if (
          stopped ||
          !s.enabled ||
          s.environment !== "test" ||
          s.member !== member ||
          !s.accountBinding
        )
          return;
        const result = await apple.products();
        if (stopped) return;
        setSession(s);
        setItems(result.products.filter((p) => p.currency === "AUD"));
        listener = await apple.addListener("purchaseSettled", () => {
          if (stopped) return;
          void settled
            .current()
            .then(() => {
              if (!stopped)
                window.dispatchEvent(new Event("docked-app-resume"));
            })
            .catch(() => {
              if (!stopped)
                setMessage(
                  "Purchase verified. Refresh your wallet to see the latest balance.",
                );
            });
        });
        if (stopped) await listener.remove();
      })().catch(() => {
        if (!stopped) {
          setSession(null);
          setItems([]);
        }
      });
    }
    return () => {
      stopped = true;
      active.current = false;
      void listener?.remove();
    };
  }, [member]);
  if (!session || session.member !== member) return null;
  async function run(item?: Item) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      const fresh = await apple.capabilities();
      if (
        !fresh.enabled ||
        fresh.member !== member ||
        fresh.environment !== "test" ||
        fresh.accountBinding !== session!.accountBinding
      )
        throw Error(
          "Your purchase session changed. Sign in and check purchases again.",
        );
      if (item) {
        const available = (await apple.products()).products.some(
          (p) => p.id === item.id && p.currency === "AUD",
        );
        if (!available) throw Error("This product is currently unavailable.");
        const result = await apple.purchase({
          productId: item.id,
          accountBinding: fresh.accountBinding!,
        });
        if (active.current)
          setMessage(
            result.state === "verified"
              ? "Apple test purchase verified."
              : result.state === "pending"
                ? "Approval pending. No credits have been added."
                : "Purchase cancelled.",
          );
      } else {
        await apple.reconcile();
        await settled.current();
        if (active.current)
          setMessage("Available unfinished purchases checked.");
      }
    } catch {
      if (active.current)
        setMessage(
          "Verification is pending or unavailable. Check purchases before trying another purchase.",
        );
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="panel" aria-labelledby="apple-test-title">
      <h2 id="apple-test-title">Apple sandbox purchases</h2>
      <p>
        Authorised testing only. Continue only when Apple identifies this as a
        sandbox purchase.
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          className="primary"
          disabled={busy}
          onClick={() => void run(item)}
        >
          {item.credits.toLocaleString("en-AU")} test credits · {item.price}
        </button>
      ))}
      {!items.length && <p>No sandbox products are available.</p>}
      <button disabled={busy} onClick={() => void run()}>
        Check purchases
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
