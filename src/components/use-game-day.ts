"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { StandingRound } from "@/core/standings";

export function useGameDay(initial: StandingRound[] = []) {
  const [rounds, setRounds] = useState(initial);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(initial.length > 0);
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let active = false;
    const controller = new AbortController();
    async function read() {
      if (active || document.hidden) return;
      active = true;
      try {
        const response = await boundedFetch("/api/fantasy/standings", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw Error(body.error || "Scores unavailable. Try again.");
        if (!Array.isArray(body.rounds))
          throw Error("Scores unavailable. Try again.");
        if (!disposed) {
          setRounds(body.rounds);
          setError("");
          setLoaded(true);
        }
      } catch (e) {
        if (!disposed)
          setError(e instanceof Error ? e.message : "Scores unavailable.");
      } finally {
        active = false;
      }
    }
    refresh.current = () => void read();
    void read();
    const timer = setInterval(read, 30000);
    const resume = () => void read();
    window.addEventListener("focus", resume);
    window.addEventListener("docked-app-resume", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("docked-app-resume", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return {
    rounds,
    error,
    loaded,
    retry: useCallback(() => refresh.current(), []),
  };
}
