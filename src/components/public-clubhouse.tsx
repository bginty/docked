import Link from "next/link";
import { packShopHref } from "@/core/pack-presentation";
import type { PublicSport } from "@/core/public-customer";

export function PublicClubhouse({ sport }: { sport: PublicSport }) {
  return (
    <section className="fantasy-panel">
      <h1>{sport.toUpperCase()} clubhouse</h1>
      <p>
        Browse your collection and build lineups where Practice entries are
        available. Scored competitions and prizes are closed.
      </p>
      <nav className="actions" aria-label="Your cards and packs">
        <Link className="pack-control primary" href={packShopHref(sport)}>
          Browse packs
        </Link>
        <Link
          className="pack-control secondary"
          href={packShopHref(sport, "mine")}
        >
          My packs
        </Link>
        <Link
          className="pack-control secondary"
          href={"/fantasy/cards?sport=" + sport}
        >
          My Cards
        </Link>
        <Link className="pack-control secondary" href="/fantasy/test-wallet">
          Docked Credits
        </Link>
      </nav>
    </section>
  );
}
