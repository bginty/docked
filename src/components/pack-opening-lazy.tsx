"use client";
import { lazy, Suspense, type ComponentProps } from "react";
import { PurchaseTransition } from "./purchase-transition";

// Shop and collection pages do not initialise cinema/audio until a pack is shown.
const loadOpening = () => import("./pack-opening");
const Opening = lazy(loadOpening);
/** Start code downloads on purchase intent, in parallel with server work.
 * Importing never creates audio, chooses cards or changes ownership. */
export function preloadPackOpening() {
  return Promise.all([loadOpening(), import("./pack-cinema-v2")]).then(
    () => undefined,
  );
}
export default function PackOpening(props: ComponentProps<typeof Opening>) {
  return (
    <Suspense fallback={<PurchaseTransition state="securing" />}>
      <Opening {...props} />
    </Suspense>
  );
}
