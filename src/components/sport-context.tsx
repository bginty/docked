"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { boundedFetch } from "@/core/bounded-request";
const NbaBetaScreen = lazy(() =>
  import("./nba-beta-screen").then((m) => ({ default: m.NbaBetaScreen })),
);
const SportBetaCommerce = lazy(() =>
  import("./sport-beta-commerce").then((m) => ({
    default: m.SportBetaCommerce,
  })),
);
import { isBetaSport, type BetaSport } from "@/core/sports-private-beta";
import { activeSportCookie, workspaceSport } from "@/core/workspace-sport";
const sports = {
  nfl: "NFL",
  football: "EPL",
  afl: "AFL",
  nrl: "NRL",
  basketball: "NBA",
} as const;
type Sport = keyof typeof sports;
const valid = (value: string | null): value is Sport =>
  !!value && Object.hasOwn(sports, value);
const SportContext = createContext({
  sport: "nfl" as Sport,
  change: (_sport: Sport) => {},
  notice: "",
  ready: true,
  nba: false,
  beta: [] as BetaSport[],
  capabilitiesReady: false,
  capabilitiesError: false,
  retryCapabilities: () => {},
});
export function SportProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [sport, setSport] = useState<Sport>("nfl"),
    [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [beta, setBeta] = useState<BetaSport[]>([]);
  const nba = beta.includes("basketball");
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState(false);
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const memberArea = /^\/(fantasy|profile|dashboard|admin)(\/|$)/.test(path);
  useEffect(() => {
    const clear = () => setNotice("");
    window.addEventListener("docked:sport-draft-clean", clear);
    return () => window.removeEventListener("docked:sport-draft-clean", clear);
  }, []);
  useEffect(() => {
    let disposed = false;
    if (!memberArea) {
      setBeta([]);
      setCapabilitiesReady(true);
      setCapabilitiesError(false);
      return;
    }
    let current: AbortController | undefined;
    let inFlight = false;
    setCapabilitiesReady(false);
    const read = async () => {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      current = controller;
      try {
        // This existing endpoint includes NBA as well as AFL/NRL. One request
        // per workspace lifetime avoids duplicate auth/DB work on every tab.
        const r = await boundedFetch("/api/sports-beta", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok && ![401, 403].includes(r.status))
          throw Error("Sport access unavailable");
        const allowed = r.ok ? (await r.json()).allowed : [];
        if (!disposed) {
          setBeta(
            Array.isArray(allowed)
              ? allowed.filter(
                  (x): x is BetaSport =>
                    typeof x === "string" && isBetaSport(x),
                )
              : [],
          );
          setCapabilitiesError(false);
        }
      } catch {
        if (!disposed) setCapabilitiesError(true);
      } finally {
        inFlight = false;
        if (!disposed) setCapabilitiesReady(true);
      }
    };
    const resume = () => {
      if (document.visibilityState === "visible") void read();
    };
    void read();
    window.addEventListener("online", resume);
    window.addEventListener("docked-app-resume", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      current?.abort();
      window.removeEventListener("online", resume);
      window.removeEventListener("docked-app-resume", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [memberArea, capabilityAttempt]);
  useEffect(() => {
    const read = () => {
      const requested = new URLSearchParams(location.search).get("sport");
      // Unsupported deep links remain explicit instead of displaying another sport's data.
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("docked:active-sport");
      } catch {}
      let cookie: string | undefined;
      try {
        cookie = document.cookie
          .split("; ")
          .find((v) => v.startsWith(`${activeSportCookie}=`))
          ?.split("=")[1];
      } catch {}
      const selected = workspaceSport(
        requested,
        cookie ?? (valid(saved) ? saved : undefined),
      );
      setSport(selected);
      if (capabilitiesReady)
        document.cookie = `${activeSportCookie}=${selected}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [path, capabilitiesReady]);
  function change(next: Sport) {
    if (
      (next !== "nfl" &&
        !(next === "basketball" && nba) &&
        !(isBetaSport(next) && beta.includes(next))) ||
      next === sport
    )
      return;
    if (
      !window.dispatchEvent(
        new Event("docked:sport-changing", { cancelable: true }),
      )
    ) {
      setNotice("Save or discard your lineup changes before changing sport.");
      return;
    }
    setSport(next);
    setNotice("");
    try {
      localStorage.setItem("docked:active-sport", next);
    } catch {}
    document.cookie = `${activeSportCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const url = new URL(location.href);
    for (const key of [
      "competition",
      "team",
      "position",
      "rarity",
      "page",
      "search",
      "week",
      "season",
      "mode",
    ])
      url.searchParams.delete(key);
    url.searchParams.set("sport", next);
    history.replaceState(null, "", url);
    // Private sport routes intentionally do not pre-load NFL. Returning to NFL
    // must request its server page, preserving the authenticated shared shell.
    if (next === "nfl" && path !== "/fantasy/cards") router.refresh();
    window.dispatchEvent(new Event("docked:sport-changed"));
  }
  return (
    <SportContext.Provider
      value={{
        sport,
        change,
        notice,
        ready,
        nba,
        beta,
        capabilitiesReady,
        capabilitiesError,
        retryCapabilities: () => setCapabilityAttempt((n) => n + 1),
      }}
    >
      {children}
    </SportContext.Provider>
  );
}
export const useSport = () => useContext(SportContext);
export function SportSelector({ mobile = false }: { mobile?: boolean }) {
  const { sport, change, notice, nba, beta } = useSport();
  return (
    <label
      className={`shell-sport ${mobile ? "shell-sport-mobile" : "shell-sport-desktop"}`}
    >
      <span>Sport</span>
      <select
        aria-label={mobile ? "Active sport" : "Active sport desktop"}
        value={sport}
        onChange={(e) => change(e.target.value as Sport)}
      >
        {Object.entries(sports).map(([id, label]) => (
          <option
            key={id}
            value={id}
            disabled={
              id !== "nfl" &&
              !(id === "basketball" && nba) &&
              !(isBetaSport(id) && beta.includes(id))
            }
          >
            {label}
            {(id === "basketball" && nba) ||
            (isBetaSport(id) && beta.includes(id))
              ? " · Private beta"
              : id !== "nfl"
                ? " · Coming soon"
                : ""}
          </option>
        ))}
      </select>
      {notice && <small role="status">{notice}</small>}
    </label>
  );
}
export function SportScope({ children }: { children: ReactNode }) {
  const {
    sport,
    ready,
    nba,
    beta,
    capabilitiesReady,
    capabilitiesError,
    retryCapabilities,
  } = useSport();
  const path = usePathname();
  if (!ready) return <p role="status">Loading your sport…</p>;
  if (isBetaSport(sport) && !capabilitiesReady)
    return <p role="status">Checking sport access…</p>;
  if (isBetaSport(sport) && capabilitiesError && !beta.includes(sport))
    return (
      <section className="fantasy-panel">
        <h1>{sports[sport]}</h1>
        <p role="alert">Sport access could not be checked. Please retry.</p>
        <button onClick={retryCapabilities}>Retry</button>
      </section>
    );
  if (
    isBetaSport(sport) &&
    ((sport === "basketball" && nba) || beta.includes(sport))
  ) {
    // The wallet is shared; the pack catalogue remains explicitly sport gated.
    if (
      path === "/fantasy/test-wallet" &&
      new URLSearchParams(
        typeof location === "undefined" ? "" : location.search,
      ).get("view") !== "packs"
    )
      return children;
    if (path === "/fantasy/cards") return children;
    if (path === "/fantasy/play")
      return (
        <Suspense fallback={<p role="status">Loading your team…</p>}>
          <NbaBetaScreen key={`${path}:${sport}`} sport={sport} />
        </Suspense>
      );
    if (path === "/fantasy/test-wallet" || path === "/fantasy/packs")
      return (
        <Suspense fallback={<p role="status">Loading your packs…</p>}>
          <SportBetaCommerce
            key={`${path}:${sport}`}
            sport={sport}
            surface="packs"
          />
        </Suspense>
      );
    if (path === "/fantasy/market")
      return (
        <Suspense fallback={<p role="status">Loading your market…</p>}>
          <SportBetaCommerce
            key={`${path}:${sport}`}
            sport={sport}
            surface="market"
          />
        </Suspense>
      );
    if (path === "/fantasy/social") return children;
    return (
      <section className="fantasy-panel">
        <h1>{sports[sport]} private beta</h1>
        <p>
          Open Play for your team and rankings, Cards for your test collection,
          or Packs and Market for the separately controlled test economy.
        </p>
        <a href={`/fantasy/play?sport=${sport}`}>Open {sports[sport]} Play</a>
      </section>
    );
  }
  return sport === "nfl" ? (
    children
  ) : (
    <section className="fantasy-panel">
      <h1>{sports[sport]} · Coming soon</h1>
      <p>
        This sport is unavailable. Choose NFL to view your cards and
        competitions.
      </p>
    </section>
  );
}
export function useSportDraftGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) window.dispatchEvent(new Event("docked:sport-draft-clean"));
    const guard = (event: Event) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("docked:sport-changing", guard);
    return () => window.removeEventListener("docked:sport-changing", guard);
  }, [dirty]);
}
