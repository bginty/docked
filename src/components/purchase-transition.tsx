"use client";
import { useEffect, useState } from "react";
import { fantasyAssets } from "@/brand/fantasy-assets";

/** Presentation follows real request state; timers only offer recovery advice. */
export function PurchaseTransition({
  state,
}: {
  state: "processing" | "securing" | "pending";
}) {
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  const pending = state === "pending";
  return (
    <div className="purchase-transition-transition" data-state={state}>
      <div className="purchase-transition-scene" aria-hidden="true">
        <div className="purchase-transition-halo" />
        <div className="purchase-transition-pack">
          <img src={fantasyAssets.compact} alt="" width="132" height="35" />
          <span>YOUR PACK</span>
        </div>
        <i className="purchase-transition-spark" />
        <i className="purchase-transition-spark" />
        <i className="purchase-transition-spark" />
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <h3>
          {offline
            ? "Connection interrupted"
            : pending
              ? "Awaiting confirmation"
              : state === "securing"
                ? "Securing your cards"
                : "Processing purchase"}
        </h3>
        <p>
          {offline
            ? state === "securing"
              ? "Your existing pack is safe. Reconnect and reopen it."
              : "Your request is saved. Reconnect, then check the same purchase."
            : pending
              ? "Check the existing request to retrieve its result."
              : state === "securing"
                ? "Retrieving your confirmed pack. Your cards will appear automatically."
                : "Waiting for the server to confirm your purchase."}
        </p>
        {slow && !pending && !offline && (
          <p className="purchase-transition-slow">
            {state === "securing"
              ? "Taking longer than usual to load. You can safely reopen your existing pack from My Packs."
              : "Taking longer than usual. You can close this panel safely and check the pending request."}
          </p>
        )}
      </div>
    </div>
  );
}
