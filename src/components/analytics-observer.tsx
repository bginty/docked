"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageEvent } from "@/core/analytics";

export function AnalyticsObserver() {
  const path = usePathname();
  useEffect(() => {
    const event = pageEvent(path);
    if (!event || navigator.doNotTrack === "1") return;
    let active = true;
    // Anonymous visitors are not identified. Do not issue tracking writes until
    // the server confirms this account explicitly consented to analytics.
    void fetch("/api/analytics", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => {
        if (active && v.enabled === true)
          return fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event }),
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);
  return null;
}
