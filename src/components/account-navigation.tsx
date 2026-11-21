"use client";
import { useEffect, useState } from "react";
export function OwnerViewSwitch({ customer = false }: { customer?: boolean }) {
  return (
    <form
      method="post"
      action={"/api/owner-view?mode=" + (customer ? "owner" : "customer")}
    >
      <button className="button secondary" type="submit">
        {customer ? "Return to Owner Dashboard" : "View as Customer"}
      </button>
    </form>
  );
}
export function CustomerViewBanner({
  resume = false,
}: { resume?: boolean } = {}) {
  return (
    <aside className="actions" aria-label="Owner navigation">
      <strong>Customer View — Your Own Account</strong>
      {resume && (
        <a className="button secondary" href="/fantasy/play">
          Continue browsing
        </a>
      )}
      <OwnerViewSwitch customer />
    </aside>
  );
}
export function LogoutControls({
  allDevices = false,
}: {
  allDevices?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  async function logout(global: boolean) {
    if (
      busy ||
      (global &&
        !window.confirm(
          "Log out of Docked on every device, including this one?",
        ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "logout",
          scope: global ? "global" : "local",
          app: true,
        }),
      });
      if (!response.ok || (await response.json()).ok !== true) throw Error();
      window.location.replace("/app/login");
    } catch {
      setError("Logout could not be confirmed. Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="actions">
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void logout(false)}
      >
        Log out
      </button>
      {allDevices && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void logout(true)}
        >
          Log out all devices
        </button>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
