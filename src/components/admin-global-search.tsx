"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminSearchResponse } from "@/core/admin-navigation";

export function AdminGlobalSearch() {
  const pathname = usePathname();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AdminSearchResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOpen(false);
    setResult(null);
    setQuery("");
    setPage(1);
  }, [pathname]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (
        event.key === "Escape" &&
        root.current?.contains(document.activeElement)
      ) {
        setOpen(false);
        input.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  useEffect(() => {
    setResult(null);
    setError("");
    if (!open || query.trim().length < 2) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query.trim())}&page=${page}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Search unavailable");
        if (!controller.signal.aborted) setResult(data);
      } catch (problem) {
        if (!controller.signal.aborted)
          setError(
            problem instanceof Error ? problem.message : "Search unavailable",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, open]);
  return (
    <div className="admin-global-search" ref={root}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <svg
          aria-hidden="true"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          ref={input}
          aria-label="Search permitted administrative records"
          aria-controls={open ? "admin-search-results" : undefined}
          maxLength={120}
          value={query}
          placeholder="Search users, cards, packs, transactions..."
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
        <kbd aria-label="Control or Command K">⌘ K</kbd>
      </form>
      {open && (
        <section
          id="admin-search-results"
          className="admin-search-results"
          aria-label="Administrative search results"
        >
          <div className="admin-search-top">
            <strong>Search permitted records</strong>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <p role="status">
            {busy
              ? "Searching…"
              : error ||
                (query.trim().length < 2
                  ? "Enter at least two characters."
                  : result?.results.length
                    ? `Page ${page} · ${result.results.length} results`
                    : "No matching records.")}
          </p>
          {result?.results.map((item) => (
            <Link
              key={`${item.category}:${item.id}`}
              href={item.href}
              onClick={() => setOpen(false)}
            >
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </Link>
          ))}
          {(page > 1 || result?.hasMore) && (
            <nav aria-label="Search pages">
              <button
                type="button"
                disabled={busy || page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={busy || !result?.hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
