"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function OwnerDetailDisclosure({ children }: { children: ReactNode }) {
  const detail = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("owner-")) return;
      const target = document.getElementById(id);
      if (target && detail.current?.contains(target)) {
        detail.current.open = true;
        target.scrollIntoView({ block: "start" });
      }
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return (
    <details ref={detail} className="owner-reference-detail">
      <summary>Operational detail, reporting definitions & controls</summary>
      {children}
    </details>
  );
}
