"use client";
import { useEffect, useState } from "react";
export function RelativeSocialTime({ value }: { value: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const date = new Date(value),
    seconds = now === null ? null : Math.round((date.getTime() - now) / 1000);
  const unit: Intl.RelativeTimeFormatUnit =
    seconds === null || Math.abs(seconds) < 3600
      ? "minute"
      : Math.abs(seconds) < 86400
        ? "hour"
        : "day";
  const amount =
    seconds === null
      ? null
      : Math.round(
          seconds / (unit === "day" ? 86400 : unit === "hour" ? 3600 : 60),
        );
  return (
    <time dateTime={value} title={date.toISOString()}>
      {amount === null
        ? date.toISOString().slice(0, 10)
        : new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
            amount,
            unit,
          )}
    </time>
  );
}
