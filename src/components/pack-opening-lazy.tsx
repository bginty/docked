"use client";
import { lazy, Suspense, type ComponentProps } from "react";

// Shop and collection pages do not initialise cinema/audio until a pack is shown.
const Opening = lazy(() => import("./pack-opening"));
export default function PackOpening(props: ComponentProps<typeof Opening>) {
  return (
    <Suspense fallback={<p role="status">Loading your pack reveal…</p>}>
      <Opening {...props} />
    </Suspense>
  );
}
