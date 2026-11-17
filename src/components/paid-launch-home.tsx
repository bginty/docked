import Link from "next/link";
import { FantasyHero, FantasyLogo } from "./fantasy-brand";
import { brand } from "../brand/brand";

export function PaidLaunchHome({ canRegister }: { canRegister: boolean }) {
  return (
    <div className="fantasy-public">
      <header>
        <Link href="/" aria-label="Docked home">
          <FantasyLogo />
        </Link>
        <Link className="button" href="/app/login">
          Log in
        </Link>
      </header>
      <section className="fantasy-welcome">
        <FantasyHero />
        <div>
          <p className="eyebrow">NFL · AFL · NRL COLLECTIBLE CARDS</p>
          <h1>Build your permanent card collection.</h1>
          <p>
            Discover player cards in Standard and Premium packs. Each limited
            card has a permanent edition serial, with lifetime rarity limits
            that do not reset each season.
          </p>
          <p>One collection, on your phone and in your browser.</p>
          <div className="actions">
            {canRegister ? (
              <Link className="button" href="/app/signup">
                Create your account
              </Link>
            ) : (
              <p role="status">
                Australian public registration is not open yet.
              </p>
            )}
            <Link href="/commercial-policy">
              Pack prices and rarity probabilities
            </Link>
          </div>
          <p className="small-note">
            Australian residents aged 18 or older. Email and an Australian
            mobile number must be verified. Beta credits, cards and packs do not
            transfer into commercial participation.
          </p>
        </div>
      </section>
      <section className="fantasy-stats" aria-label="How Docked works">
        <div>
          <h2>Choose your credits</h2>
          <p>
            {canRegister ? "Buy" : "At launch, buy"} Docked Credits through
            Google Play in the Android app: A$49 for 4,900 credits or A$99 for
            9,900 credits, including GST. Credits cannot be withdrawn.
          </p>
        </div>
        <div>
          <h2>Choose your pack</h2>
          <p>
            Standard packs: 1 card for 100 credits, 3 for 300, or 9 for 700.
            Premium packs: 1 card for 700 credits, 3 for 1,900, or 9 for 5,000.
            The same prices apply to NFL, AFL and NRL.
          </p>
          <p>
            A 4,900-credit purchase alone does not cover a 5,000-credit Premium
            nine-card pack.
          </p>
        </div>
        <div>
          <h2>Keep your cards</h2>
          <p>
            Review the card count, price and rarity probabilities before buying.
            Your completed purchase and allocated cards are saved for recovery
            after a reload. Find your collection in My Cards.
          </p>
          <p>
            Marketplace trading and swaps are unavailable. Practice competitions
            remain closed. No prizes, withdrawals or scored competitions are
            open.
          </p>
        </div>
      </section>
      <footer>
        <p>DOCKED · {brand.tagline}</p>
        <p>
          Docked is independent and does not claim endorsement by a league, club
          or player.
        </p>
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>{" "}
        · <Link href="/refund-policy">Purchases and refunds</Link> ·{" "}
        <a href="mailto:support@docked.com.au">Support</a>
      </footer>
    </div>
  );
}
