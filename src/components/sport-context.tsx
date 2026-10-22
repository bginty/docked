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
});
export function SportProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [sport, setSport] = useState<Sport>("nfl"),
    [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [nba, setNba] = useState(false);
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
          : saved === "nfl" || (nba && saved === "basketball")
            ? saved
            : "nfl",
      );
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [path, nba]);
  function change(next: Sport) {
    if ((next !== "nfl" && !(next === "basketball" && nba)) || next === sport)
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
    <SportContext.Provider value={{ sport, change, notice, ready, nba }}>
      {children}
    </SportContext.Provider>
  );
}
export const useSport = () => useContext(SportContext);
export function SportSelector({ mobile = false }: { mobile?: boolean }) {
  const { sport, change, notice, nba } = useSport();
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
            disabled={id !== "nfl" && !(id === "basketball" && nba)}
          >
            {label}
            {id === "basketball" && nba
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
  const { sport, ready, nba } = useSport();
  const path = usePathname();
  if (!ready) return <p role="status">Loading your sport…</p>;
  if (sport === "basketball" && nba) {
    // The wallet is shared; the pack catalogue remains explicitly sport gated.
    if (
      path === "/fantasy/test-wallet" &&
      new URLSearchParams(
        typeof location === "undefined" ? "" : location.search,
      ).get("view") !== "packs"
    )
      return children;
    if (path === "/fantasy/play" || path === "/fantasy/cards")
      return <NbaBetaScreen key={path} cards={path === "/fantasy/cards"} />;
    return (
      <section className="fantasy-panel">
        <h1>NBA private beta</h1>
        <p>
          NBA packs and marketplace trading are not enabled. Test cards are
          available in Cards and Play.
        </p>
        <a href="/fantasy/play?sport=basketball">Open NBA Play</a>
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
    const guard = (event: Event) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("docked:sport-changing", guard);
    return () => window.removeEventListener("docked:sport-changing", guard);
  }, [dirty]);
}
