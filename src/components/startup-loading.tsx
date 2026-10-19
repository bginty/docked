"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
const StartupContext = createContext<{ pending: boolean; ready: () => void }>({
  pending: false,
  ready: () => {},
});
export function LightSweep({
  failed = false,
  onRetry,
  authRequired = false,
  failureMessage,
  recoveryHref,
  recoveryLabel,
}: {
  failed?: boolean;
  onRetry?: () => void;
  authRequired?: boolean;
  failureMessage?: string;
  recoveryHref?: string;
  recoveryLabel?: string;
}) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <section
      className={`light-sweep${failed ? " light-sweep-failed" : ""}`}
      aria-busy={!failed}
      aria-label={failed ? "Docked unavailable" : "Loading Docked"}
    >
      <div className="loading-card" aria-hidden="true">
        <div className="loading-card-inner">
          <div className="loading-facets" />
          <div className="loading-brand">
            <BrandLogo decorative surface="dark" />
            <span>COLLECT. COMPETE. CONNECT.</span>
          </div>
          <div className="loading-reflection" />
        </div>
      </div>
      <p className="loading-message" role={failed ? "alert" : "status"}>
        {failed
          ? (failureMessage ??
            (authRequired
              ? "Please sign in again."
              : "Docked couldn’t load. Please try again."))
          : late
            ? "Taking longer than usual…"
            : "Getting Docked ready…"}
      </p>
      {failed ? (
        <div className="loading-recovery">
          {onRetry && (
            <button className="button" onClick={onRetry}>
              Retry
            </button>
          )}
          {(authRequired || recoveryHref) && (
            <a className="button" href={recoveryHref ?? "/app/login"}>
              {recoveryLabel ?? "Sign in"}
            </a>
          )}
        </div>
      ) : (
        <div className="loading-track" aria-hidden="true">
          <span />
        </div>
      )}
    </section>
  );
}
export function StartupBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Lifetime is the document, not the route. Successful client navigation never
  // resets this state, even when subsequent routes suspend.
  const [pending, setPending] = useState(() =>
    /^\/(fantasy|app|home|feed|following|notifications)(\/|$)/.test(pathname),
  );
  const [failed, setFailed] = useState(false);
  const ready = useCallback(() => {
    setPending(false);
    setFailed(false);
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(() => setFailed(true), 45000);
    return () => clearTimeout(timeout);
  }, [pending]);
  return (
    <StartupContext.Provider value={{ pending, ready }}>
      {pending && (
        <LightSweep failed={failed} onRetry={() => location.reload()} />
      )}
      <div inert={pending || undefined} aria-hidden={pending || undefined}>
        {children}
      </div>
    </StartupContext.Provider>
  );
}
export function StartupReady() {
  const { ready } = useContext(StartupContext);
  useEffect(() => ready(), [ready]);
  return null;
}
export function useStartup() {
  return useContext(StartupContext);
}
