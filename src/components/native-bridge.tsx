"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  nativeAppRoute,
  nativeAuthCallback,
  nativeDeepLink,
  nativeSessionDestination,
} from "@/core/native-navigation";
import { brand } from "@/brand/brand";
export function isDockedNative() {
  return (
    typeof window !== "undefined" &&
    !!(
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  );
}
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const [native, setNative] = useState(false),
    [online, setOnline] = useState(true),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!isDockedNative()) return;
    setNative(true);
    document.documentElement.classList.add("docked-native");
    let alive = true;
    const cleanup: (() => void)[] = [];
    const external = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin === location.origin) {
        const appRoute = nativeAppRoute(url.pathname);
        if (appRoute) {
          event.preventDefault();
          router.push(appRoute);
        }
        return;
      }
      if (url.protocol !== "https:" || url.username || url.password) {
        event.preventDefault();
        setMessage(
          url.protocol === "mailto:"
            ? "Email links are not enabled in this Android preview. Use the support address shown on the page in your email app."
            : "This link type is not supported in the Android preview.",
        );
        return;
      }
      event.preventDefault();
      void import("@capacitor/browser")
        .then(({ Browser }) =>
          Browser.open({ url: url.href, toolbarColor: brand.colors.navy }),
        )
        .catch(() =>
          setMessage("The external browser could not open this link."),
        );
    };
    document.addEventListener("click", external);
    cleanup.push(() => document.removeEventListener("click", external));
    void Promise.all([
      import("@capacitor/app"),
      import("@capacitor/network"),
      import("@capacitor/splash-screen"),
    ])
      .then(async ([{ App }, { Network }, { SplashScreen }]) => {
        function open(value: string) {
          const route = nativeDeepLink(value, window.location.origin);
          if (route) router.push(route);
          else {
            const callback = nativeAuthCallback(value);
            // A normal same-origin callback exchange still needs the original PKCE cookie.
            if (callback) window.location.assign(callback);
            else
              setMessage(
                "This link cannot be opened in Docked. No session or price was imported.",
              );
          }
        }
        const handles = await Promise.all([
          App.addListener("appUrlOpen", ({ url }) => {
            if (alive) open(url);
          }),
          App.addListener("backButton", ({ canGoBack }) => {
            if (!alive) return;
            const panel = document.querySelector<HTMLDialogElement>("dialog[open]");
            if (panel) {
              panel.dispatchEvent(new Event("cancel", { cancelable: true }));
              return;
            }
            if (canGoBack) router.back();
            else void App.minimizeApp();
          }),
          App.addListener("appStateChange", ({ isActive }) => {
            if (alive && isActive) {
              router.refresh();
              window.dispatchEvent(new Event("docked-app-resume"));
            }
          }),
          Network.addListener("networkStatusChange", (status) => {
            if (alive) {
              setOnline(status.connected);
              if (status.connected) {
                router.refresh();
                window.dispatchEvent(new Event("docked-app-resume"));
              }
            }
          }),
        ]);
        for (const handle of handles) {
          if (alive)
            cleanup.push(() => {
              void handle.remove();
            });
          else await handle.remove();
        }
        if (!alive) return;
        setOnline((await Network.getStatus()).connected);
        const launch = await App.getLaunchUrl();
        if (launch?.url) open(launch.url);
        await SplashScreen.hide();
      })
      .catch(() => {
        if (alive)
          setMessage(
            "A native capability is unavailable. Existing web controls remain available.",
          );
      });
    return () => {
      alive = false;
      for (const remove of cleanup) remove();
      document.documentElement.classList.remove("docked-native");
    };
  }, [router]);
  useEffect(() => {
    if (!isDockedNative()) return;
    const mapped = nativeAppRoute(pathname);
    if (mapped) {
      router.replace(mapped);
      return;
    }
    const controller = new AbortController();
    let checking = false;
    async function checkSession() {
      if (
        checking ||
        !navigator.onLine ||
        pathname === "/app" ||
        pathname.startsWith("/app/")
      )
        return;
      checking = true;
      try {
        const response = await fetch("/api/app-session", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const destination = nativeSessionDestination(
          response.status,
          response.ok ? await response.json() : null,
          pathname,
        );
        if (!controller.signal.aborted && destination)
          router.replace(destination);
      } catch {
        /* Offline/service failure does not mean that a session expired. */
      } finally {
        checking = false;
      }
    }
    void checkSession();
    const resume = () => {
      void checkSession();
    };
    window.addEventListener("docked-app-resume", resume);
    return () => {
      controller.abort();
      window.removeEventListener("docked-app-resume", resume);
    };
  }, [pathname, router]);
  if (!native || (online && !message)) return null;
  return (
    <aside className="native-status" aria-label="Android connection status">
      {!online && (
        <p role="alert">
          Offline. Current prices and private content cannot be verified.
          Reconnect before submitting.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </aside>
  );
}

/** Account settings surface; native capabilities are never requested on mount. */
export function NativeAppSettings() {
  const [native, setNative] = useState(false);
  const [haptics, setHaptics] = useState(false);
  useEffect(() => {
    if (!isDockedNative()) return;
    setNative(true);
    try {
      setHaptics(localStorage.getItem("docked-native-haptics") === "true");
    } catch {}
  }, []);
  if (!native) return null;
  return (
    <section
      className="native-app-settings app-panel"
      aria-labelledby="native-settings-title"
    >
      <h2 id="native-settings-title">Android settings</h2>
      <p className="form-help">
        Push and app badges: NOT_CONFIGURED. No device registration or
        notification permission is requested.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={haptics}
          onChange={(e) => {
            setHaptics(e.target.checked);
            try {
              localStorage.setItem(
                "docked-native-haptics",
                String(e.target.checked),
              );
            } catch {}
          }}
        />
        Enable light confirmation haptics; reduced-motion settings take
        priority.
      </label>
    </section>
  );
}
