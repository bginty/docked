"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
const sports = {
  nfl: "NFL",
  football: "EPL",
  afl: "AFL",
  basketball: "Basketball",
} as const;
type Sport = keyof typeof sports;
const valid = (value: string | null): value is Sport =>
  !!value && Object.hasOwn(sports, value);
const SportContext = createContext({
  sport: "nfl" as Sport,
  change: (_sport: Sport) => {},
  notice: "",
  ready: true,
});
export function SportProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [sport, setSport] = useState<Sport>("nfl"),
    [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      const requested = new URLSearchParams(location.search).get("sport");
      // Unsupported deep links remain explicit instead of displaying another sport's data.
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("docked:active-sport");
      } catch {}
      setSport(valid(requested) ? requested : saved === "nfl" ? saved : "nfl");
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [path]);
  function change(next: Sport) {
    if (next !== "nfl" || next === sport) return;
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
    ])
      url.searchParams.delete(key);
    url.searchParams.set("sport", next);
    history.replaceState(null, "", url);
    window.dispatchEvent(new Event("docked:sport-changed"));
  }
  return (
    <SportContext.Provider value={{ sport, change, notice, ready }}>
      {children}
    </SportContext.Provider>
  );
}
export const useSport = () => useContext(SportContext);
export function SportSelector({ mobile = false }: { mobile?: boolean }) {
  const { sport, change, notice } = useSport();
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
          <option key={id} value={id} disabled={id !== "nfl"}>
            {label}
            {id !== "nfl" ? " · Coming soon" : ""}
          </option>
        ))}
      </select>
      {notice && <small role="status">{notice}</small>}
    </label>
  );
}
export function SportScope({ children }: { children: ReactNode }) {
  const { sport, ready } = useSport();
  if (!ready) return <p role="status">Loading your sport…</p>;
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
