import { competitionNames } from "@/core/competition-display";
import { brand } from "@/brand/brand";
import Link from "next/link";
import { FantasyHero, FantasyLogo } from "@/components/fantasy-brand";
export const metadata = {
  title: "Fantasy sports cards",
  alternates: { canonical: "/" },
};
export default function Home() {
  const production = false;
  const liveBeta = false;
  return (
    <div className="fantasy-public">
      <header>
        <Link href="/" aria-label="Docked home">
          <FantasyLogo />
        </Link>
        <Link className="button" href="/app/login">
          {production ? "Log in" : "Tester login"}
        </Link>
      </header>
      <section className="fantasy-welcome">
        <FantasyHero />
        <div>
          <p className="eyebrow">
            {liveBeta
              ? "FANTASY CARDS · LIVE BETA"
              : production
                ? "FANTASY CARDS · FREE TO PLAY"
                : "FANTASY SPORTS CARDS · CLOSED PREVIEW"}
          </p>
          <h1>
            COLLECT.
            <br />
            BUILD.
            <br />
            COMPETE.
          </h1>
          <p>
            {production
              ? "Collect limited fictional player cards. Open your free Starter pack, build your football team and earn daily gameplay rewards."
              : "Collect limited fictional player cards. Build teams and compete. Football is the first playable sport; other sports are not yet available."}
          </p>
          <p>One collection, on your phone and in your browser.</p>
          <div className="actions">
            <Link className="button" href="/fantasy/play">
              Open member workspace
            </Link>
            <Link href={production && !liveBeta ? "/app/signup" : "/app/login"}>
              {production && !liveBeta
                ? "Create a free account"
                : "Invited tester access"}
            </Link>
          </div>
          <p className="small-note">
            {production
              ? "Free gameplay. Fictional players. No paid packs, cash value or cash prizes. Marketplace transfers are not open yet."
              : "Protected Preview. Public registration is closed. Gameplay access requires separate approval. Fictional players; no cash value."}
          </p>
        </div>
      </section>
      <section className="fantasy-stats">
        <div>
          <h2>Collect</h2>
          <p>
            Every card has a permanent identity, serial and ownership history.
          </p>
        </div>
        <div>
          <h2>Build</h2>
          <p>
            Build your seven-player NFL team from cards you own. {competitionNames.SALARY_CAP} and
            {competitionNames.OPEN} apply their published rarity multipliers; legacy rounds keep
            their saved rules.
          </p>
        </div>
        <div>
          <h2>Compete</h2>
          <p>
            {production
              ? "Enter free NFL test competitions and follow post-game points. EPL is unavailable until its data and scoring are verified."
              : "Enter leagues and track simulated rounds. Trade with fellow testers."}
          </p>
        </div>
      </section>
      <footer>
        <p>DOCKED · {brand.tagline}</p>
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
