"use client";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
export function WebPushSettings() {
  const [config, setConfig] = useState<{
      available: boolean;
      publicKey: string | null;
    } | null>(null),
    [message, setMessage] = useState("Checking push availability…"),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(false),
    [supported, setSupported] = useState(false);
  useEffect(() => {
    let active = true;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(supported);
    if (!supported) {
      setMessage(
        "Push is not supported in this browser. On iPhone or iPad, add Docked to your Home Screen and open it there. In-app notifications remain available.",
      );
      return;
    }
    void boundedFetch("/api/notifications/push")
      .then(async (r) => {
        if (!r.ok) throw Error();
        const c = await r.json();
        if (!active) return;
        setConfig(c);
        setMessage(
          c.available
            ? "Enable card-sale alerts on this device. Permission is requested only when you choose Enable."
            : "Push delivery is awaiting server configuration. In-app sale notifications are available.",
        );
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription && active) {
          const check = await boundedFetch("/api/notifications/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", subscription }),
          });
          if (check.ok) {
            const status = await check.json();
            if (active) setEnabled(status.enabled === true);
          }
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Push availability could not be checked. Reload this page to retry.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function update() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active)
        throw Error(
          "Docked is preparing offline support. Reload, then try again.",
        );
      let subscription = await registration.pushManager.getSubscription();
      if (enabled) {
        if (subscription) {
          const r = await boundedFetch("/api/notifications/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "disable", subscription }),
          });
          if (!r.ok) throw Error("Could not disable push. Please retry.");
          await subscription.unsubscribe();
        }
        setEnabled(false);
        setMessage(
          "Push disabled on this device. In-app notices remain available.",
        );
        return;
      }
      if (!config?.available || !config.publicKey)
        throw Error("Push delivery is not configured yet.");
      if (Notification.permission === "denied")
        throw Error(
          "Notifications are blocked. Allow them in your browser’s site settings to enable push.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error(
          "Permission was not granted. In-app notifications remain available.",
        );
      if (!subscription) {
        const raw = atob(
          config.publicKey.replaceAll("-", "+").replaceAll("_", "/"),
        );
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      }
      const r = await boundedFetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable", subscription }),
      });
      const result = await r.json();
      if (!r.ok || !result.enabled)
        throw Error(result.error || "Subscription was not saved. Try again.");
      setEnabled(true);
      setMessage("Card-sale push enabled on this device.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update push settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="app-panel">
      <h2>Card-sale push notifications</h2>
      <p role="status">{message}</p>
      {supported && (config?.available || enabled) && (
        <button
          className="button"
          disabled={busy}
          onClick={() => void update()}
        >
          {busy
            ? "Saving…"
            : enabled
              ? "Disable push on this device"
              : "Enable push on this device"}
        </button>
      )}
      <p className="small-note">
        Device alerts may show the card and sale amount on your lock screen.
        Detailed receipts require sign-in.
      </p>
    </section>
  );
}
