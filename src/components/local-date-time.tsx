"use client";
import { useSyncExternalStore } from "react";
import { localTime } from "@/core/fantasy-play";
const subscribe = () => () => {};
/** Hydrate a stable UTC fallback before formatting in the device's timezone. */
export function LocalDateTime({ value }: { value: string }) {
  const onDevice = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={value}>
      {onDevice
        ? localTime(value)
        : `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`}
    </time>
  );
}
