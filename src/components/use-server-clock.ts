"use client";
import { useEffect, useState } from "react";
/** Server observation plus elapsed time; device wall-clock cannot revive an offer. */
export function useServerClock(serverTime: number) {
  const [clock, setClock] = useState(serverTime);
  useEffect(() => {
    const start = performance.now();
    setClock(serverTime);
    const id = setInterval(
      () => setClock(serverTime + performance.now() - start),
      1000,
    );
    return () => clearInterval(id);
  }, [serverTime]);
  return clock;
}
