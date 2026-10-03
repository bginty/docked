"use client";
import { useEffect, useState } from "react";

/** Keep server-rendered action controls inert until their handlers are mounted. */
export function useClientReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
