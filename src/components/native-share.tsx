"use client";
import { useState } from "react";
import { safeSharePath } from "@/core/native-navigation";
import { isDockedNative } from "./native-bridge";
export async function lightNativeFeedback() {
  if (
    !isDockedNative() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    if (localStorage.getItem("docked-native-haptics") !== "true") return;
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}
export function NativeShare({
  path,
  title = "Docked record",
}: {
  path: string;
  title?: string;
}) {
  const [message, setMessage] = useState("");
  async function share() {
    const route = safeSharePath(path);
    if (!route) {
      setMessage("This private or unsupported address cannot be shared.");
      return;
    }
    try {
      if (isDockedNative()) {
        const { Share } = await import("@capacitor/share");
        if (!(await Share.canShare()).value) throw new Error("unavailable");
        await Share.share({
          title,
          text: "Docked preview link. Access controls apply; estimates are not guaranteed profit.",
          url: `docked://${route.slice(1)}`,
          dialogTitle: "Share Docked link",
        });
        setMessage(
          "Share sheet closed. Docked has not posted anything automatically.",
        );
        await lightNativeFeedback();
      } else {
        await navigator.clipboard.writeText(`${location.origin}${route}`);
        setMessage("Link copied. Access controls still apply.");
      }
    } catch {
      setMessage(
        "Sharing was cancelled or unavailable. No automatic message was sent.",
      );
    }
  }
  return (
    <div className="native-share">
      <button type="button" className="button ghost small" onClick={share}>
        Share link
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
