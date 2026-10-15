"use client";
import { useEffect, useState } from "react";
import type { SocialProfile } from "@/core/community-social";
import { MemberDiscovery } from "./community-feed";
export function SocialDiscovery({
  suggestions,
}: {
  suggestions: SocialProfile[];
}) {
  const [query, setQuery] = useState(""),
    [profiles, setProfiles] = useState(suggestions),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) {
      setProfiles(suggestions);
      setMessage("");
      return;
    }
    const c = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/community?view=search&q=${encodeURIComponent(query)}`,
          { cache: "no-store", signal: c.signal },
        );
        if (!r.ok) throw Error("Member search unavailable");
        const v = await r.json();
        if (v.status !== "ready") throw Error(v.message ?? "Unavailable");
        if (!c.signal.aborted) {
          setProfiles(v.profiles);
          setMessage(v.profiles.length ? "" : "No matching members.");
        }
      } catch (e) {
        if (!c.signal.aborted) {
          setProfiles([]);
          setMessage(e instanceof Error ? e.message : "Search unavailable");
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, suggestions]);
  return (
    <section>
      <label>
        Search members
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or handle"
        />
      </label>
      <p role="status">{message}</p>
      <MemberDiscovery
        profiles={profiles}
        title={query.trim().length >= 2 ? "Search results" : "Discover members"}
        explanation="Visible admitted members. Open a profile to see the collection they have chosen to share."
      />
    </section>
  );
}
