"use client";
import { useEffect, useState } from "react";
import {
  tipStatusLabels,
  timeBoundStatus,
  type TipDisplayStatus,
} from "@/core/tip-presentation";
export function QuoteStatus({
  status,
  sourceAt,
  startAt,
  initialNow,
}: {
  status: TipDisplayStatus;
  sourceAt: string | null;
  startAt: string;
  initialNow: number;
}) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);
  const current = timeBoundStatus(status, sourceAt, startAt, now);
  return (
    <span className={`pill status-${current}`} aria-live="polite">
      {tipStatusLabels[current]}
    </span>
  );
}
