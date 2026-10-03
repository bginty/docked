"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Hydration starts with the same UTC text everywhere; local time follows it. */
export function LocalTimestamp({ value }: { value: string }) {
  const local = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>Time unavailable</span>;
  const text = local
    ? date.toLocaleString(undefined, { timeZoneName: "short" })
    : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
  return <time dateTime={value}>{text}</time>;
}
