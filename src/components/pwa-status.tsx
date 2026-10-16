"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isDockedNative } from "./native-bridge";
import { useEnvironmentPresentation } from "./environment-context";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
// Keep the browser-issued prompt across client navigation to Profile.
let deferredInstall: InstallEvent | null = null;
export function PwaStatus({
  allowInstall = false,
}: {
  allowInstall?: boolean;
}) {
  const { fantasyPreview: previewOnly, fantasyProduction } =
    useEnvironmentPresentation();
  const fantasyPreview = previewOnly || fantasyProduction;
  const [offline, setOffline] = useState(false),
    [update, setUpdate] = useState<ServiceWorker | null>(null),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const [installSlot, setInstallSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setInstallSlot(
      allowInstall ? document.getElementById("profile-install-slot") : null,
    );
  }, [allowInstall, install]);
  useEffect(() => {
    if (isDockedNative()) return;
    const onOnline = () => setOffline(!navigator.onLine);
    onOnline();
    const standalone = () =>
      matchMedia("(display-mode: standalone)").matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
    if (!standalone()) setInstall(deferredInstall);
    const installed = () => {
      deferredInstall = null;
      setInstall(null);
    };
    const onInstall = (event: Event) => {
      if (standalone()) return;
      event.preventDefault();
      deferredInstall = event as InstallEvent;
      setInstall(event as InstallEvent);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", installed);
    let alive = true;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register(
          fantasyProduction
            ? "/sw.js?fantasy=production"
            : fantasyPreview
              ? "/sw.js?fantasy=1"
              : "/sw.js",
          {
            scope: "/",
          },
        )
        .then((reg) => {
          if (!alive) return;
          if (reg.waiting) setUpdate(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (
                alive &&
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setUpdate(worker);
            });
          });
        })
        .catch(() => {});
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, [fantasyPreview, fantasyProduction]);
  return (
    <div className="pwa-status" aria-live="polite">
      {offline && (
        <p>
          You’re offline. Private feeds and prices are unavailable. Reconnect
          before submitting anything.
        </p>
      )}
      {update && (
        <p>
          A new Docked version is ready. Finish any draft before updating.{" "}
          <button
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => window.location.reload(),
                { once: true },
              );
              update.postMessage({ type: "ACTIVATE_UPDATE" });
            }}
          >
            Update app
          </button>
        </p>
      )}
      {allowInstall &&
        install &&
        installSlot &&
        createPortal(
          <button
            className="pack-control secondary install-button"
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              deferredInstall = null;
              setInstall(null);
            }}
          >
            Install Docked
          </button>,
          installSlot,
        )}
    </div>
  );
}
