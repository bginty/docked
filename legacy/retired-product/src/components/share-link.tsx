"use client";
import { useState } from "react";
import { isDockedNative } from "./native-bridge";
import { safeSharePath } from "@/core/native-navigation";
export function ShareLink() {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      const url = new URL(location.href);
      url.search = "";
      url.hash = "";
      if (isDockedNative()) {
        const route = safeSharePath(url.pathname);
        if (!route) throw new Error("Unsupported article address");
        const { Share } = await import("@capacitor/share");
        await Share.share({
          title: document.title,
          url: `docked://${route.slice(1)}`,
          dialogTitle: "Share Docked article",
        });
        setMessage("Share sheet closed.");
      } else {
        await navigator.clipboard.writeText(url.toString());
        setMessage("Link copied.");
      }
      if (navigator.doNotTrack !== "1")
        void fetch("/api/analytics", { cache: "no-store" })
          .then((r) => r.json())
          .then((v) =>
            v.enabled
              ? fetch("/api/analytics", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ event: "share_clicked" }),
                })
              : null,
          )
          .catch(() => {});
    } catch {
      setMessage("Copy the page address from your browser to share it.");
    }
  }
  return (
    <div>
      <button type="button" className="button secondary" onClick={copy}>
        Copy article link
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
