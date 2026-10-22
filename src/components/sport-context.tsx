"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { boundedFetch } from "@/core/bounded-request";
import { NbaBetaScreen } from "./nba-beta-screen";
import { SportBetaCommerce } from "./sport-beta-commerce";
import { isBetaSport, type BetaSport } from "@/core/sports-private-beta";
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
});
export function SportProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [sport, setSport] = useState<Sport>("nfl"),
    [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [nba, setNba] = useState(false);
  const [beta, setBeta] = useState<BetaSport[]>([]);
  useEffect(() => {
    const clear = () => setNotice("");
    window.addEventListener("docked:sport-draft-clean", clear);
    return () => window.removeEventListener("docked:sport-draft-clean", clear);
  }, []);
  useEffect(() => {
    let disposed = false;
    void boundedFetch("/api/nba-beta", { cache: "no-store" })
      .then(async (r) => {
        const enabled = r.ok && (await r.json()).allowed === true;
        if (!disposed) setNba(enabled);
      })
      .catch(() => {
        if (!disposed) setNba(false);
      });
    void boundedFetch("/api/sports-beta", { cache: "no-store" })
      .then(async (r) => {
        const allowed = r.ok ? (await r.json()).allowed : [];
        if (!disposed)
          setBeta(
            Array.isArray(allowed)
              ? allowed.filter(
                  (x): x is BetaSport =>
                    typeof x === "string" && isBetaSport(x),
                )
              : [],
          );
      })
      .catch(() => {
        if (!disposed) setBeta([]);
      });
    return () => {
      disposed = true;
    };
  }, [path]);
  useEffect(() => {
    const read = () => {
      const requested = new URLSearchParams(location.search).get("sport");
      // Unsupported deep links remain explicit instead of displaying another sport's data.
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("docked:active-sport");
      } catch {}
      setSport(
        valid(requested)
          ? requested
          : saved === "nfl" ||
              (nba && saved === "basketball") ||
              (saved !== null && isBetaSport(saved) && beta.includes(saved))
            ? saved
            : "nfl",
      );
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [path, nba, beta]);
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
    window.dispatchEvent(new Event("docked:sport-changed"));
  }
  return (
    <SportContext.Provider value={{ sport, change, notice, ready, nba, beta }}>
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
  const { sport, ready, nba, beta } = useSport();
  const path = usePathname();
  if (!ready) return <p role="status">Loading your sport…</p>;
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
    if (path === "/fantasy/play" || path === "/fantasy/cards")
      return (
        <NbaBetaScreen
          key={`${path}:${sport}`}
          sport={sport}
          cards={path === "/fantasy/cards"}
        />
      );
    if (path === "/fantasy/test-wallet" || path === "/fantasy/packs")
      return (
        <SportBetaCommerce
          key={`${path}:${sport}`}
          sport={sport}
          surface="packs"
        />
      );
    if (path === "/fantasy/market")
      return (
        <SportBetaCommerce
          key={`${path}:${sport}`}
          sport={sport}
          surface="market"
        />
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
