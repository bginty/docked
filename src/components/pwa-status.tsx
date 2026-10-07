"use client";
import { useEffect, useState } from "react";
import { isDockedNative } from "./native-bridge";
import { useEnvironmentPresentation } from "./environment-context";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaStatus() {
  const { fantasyPreview } = useEnvironmentPresentation();
  const [offline, setOffline] = useState(false),
    [update, setUpdate] = useState<ServiceWorker | null>(null),
    [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if (isDockedNative()) return;
    const onOnline = () => setOffline(!navigator.onLine);
    onOnline();
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    let alive = true;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register(fantasyPreview ? "/sw.js?fantasy=1" : "/sw.js", {
          scope: "/",
        })
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
    };
  }, [fantasyPreview]);
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
      {install && (
        <button
          className="install-button"
          onClick={async () => {
            await install.prompt();
            await install.userChoice;
            setInstall(null);
          }}
        >
          Install Docked web app
        </button>
      )}
    </div>
  );
}
