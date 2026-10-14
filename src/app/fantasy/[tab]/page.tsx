import Link from "next/link";
import { SocialComposer } from "@/components/social-composer";
import { boundedRead } from "@/core/bounded-request";

import { Marketplace } from "@/components/marketplace";
import { requireIdentity } from "@/server/auth";
import "../../marketplace.css";

import { notFound } from "next/navigation";

import { fantasyTagline } from "@/core/fantasy";

import {
  fantasyPlatformEnabled as fantasyEnabled,
  fantasyProductionEnabled,
} from "@/core/fantasy-production";

import { fantasyRequest } from "@/server/fantasy";

import { AppShell } from "@/components/app-shell";

import { FantasyScreen } from "@/components/fantasy-screen";

import { packExperienceEnabled } from "@/core/pack-experience";

import { communityFeed } from "@/server/community-social";

import { FeedContent } from "@/components/community-feed";

import { fantasyAssets } from "@/brand/fantasy-assets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fantasy Cards | COLLECT. BUILD. COMPETE.",

  description: "Collect player cards and build your fantasy team.",

  robots: { index: false, follow: false },

  openGraph: {
    title: "Docked | COLLECT. BUILD. COMPETE.",

    description: "Fantasy Cards Preview",

    images: [fantasyAssets.social],
  },

  twitter: {
    title: "Docked | COLLECT. BUILD. COMPETE.",

    images: [fantasyAssets.social],
  },
};

export default async function FantasyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ tab?: string; sport?: string; cursor?: string }>;
}) {
  const { tab } = await params;

  if (!["play", "cards", "market", "social", "profile", "admin"].includes(tab))
    notFound();

  if (!fantasyEnabled())
    return (
      <div className="fantasy-gate">
        <h1>Fantasy Cards</h1>

        <p>{fantasyTagline}</p>

        <p>
          Gameplay is not enabled in this protected Preview. Public registration
          is closed.
        </p>

        <Link className="button" href="/app">
          Account access
        </Link>

        <p>
          <Link href="/">Docked home</Link>
        </p>
      </div>
    );

  if (tab === "market" && process.env.DOCKED_FRIENDS_BETA === "true") {
    try {
      const who = await requireIdentity();
      return (
        <AppShell authenticated>
          <Marketplace key={who.user.id} member={who.user.id} />
        </AppShell>
      );
    } catch {
      return (
        <main className="fantasy-gate">
          <h1>Docked Market</h1>
          <p>Sign in with your invited account.</p>
          <Link href="/app/login">Sign in</Link>
        </main>
      );
    }
  }
  // Social has its own authenticated data path; inventory/scoring availability must not hide the feed.
  if (tab === "social") {
    try {
      await requireIdentity();
    } catch {
      return (
        <main className="fantasy-gate">
          <h1>Social</h1>
          <p>Sign in with your invited account to see your feed.</p>
          <Link href="/app/login">Sign in</Link>
          <Link href="/mfa">Verify owner access</Link>
        </main>
      );
    }
    const query = await searchParams;
    const feedTab =
      query.tab === "following" || query.tab === "for_you"
        ? query.tab
        : "latest";
    let feed;
    try {
      feed = await boundedRead(
        communityFeed({
          tab: feedTab,
          sport: query.sport,
          cursor: query.cursor,
        }),
      );
    } catch {
      return (
        <AppShell authenticated>
          <section>
            <h1>Social</h1>
            <p>Your feed could not be loaded. Please try again.</p>
            <a className="button" href="/fantasy/social">
              Retry
            </a>
          </section>
        </AppShell>
      );
    }
    return (
      <AppShell authenticated>
        <section className="fantasy-social">
          <h1 className="compact-page-title">Social</h1>
          <SocialComposer
            initialSport="nfl"
            inline
            memberName={feed.viewer?.displayName}
          />
          <nav className="community-tabs" aria-label="Social feeds">
            <Link
              href="/fantasy/social?tab=latest"
              aria-current={feedTab === "latest" ? "page" : undefined}
            >
              Feed
            </Link>
            <Link
              href="/fantasy/social?tab=following"
              aria-current={feedTab === "following" ? "page" : undefined}
            >
              Following
            </Link>
            {feed.viewer && (
              <Link href={`/profile/${feed.viewer.handle}`}>My posts</Link>
            )}
            <Link href="/search">Discover</Link>
          </nav>

          <FeedContent
            feed={feed}

            base="/fantasy/social"

            tab={feedTab}
            sport={query.sport}

            compact
          />
        </section>
      </AppShell>
    );
  }
  let data;

  try {
    data = await boundedRead(fantasyRequest());
  } catch (error) {
    return (
      <div className="fantasy-gate">
        <h1>
          {fantasyProductionEnabled()
            ? "Fantasy Cards"
            : "Fantasy Cards Preview"}
        </h1>

        <p>{fantasyTagline}</p>

        <p>
          {fantasyProductionEnabled()
            ? "This screen could not be loaded. Retry to check your saved state, or sign in if your session has expired."
            : "Sign in with your invited Preview account. Access must be enabled for your account by the Preview operator."}
        </p>

        <a className="button" href={`/fantasy/${tab}`}>
          Retry this screen
        </a>
        <Link className="button" href="/app/login">
          Sign in
        </Link>

        {error instanceof Error &&
          error.message === "Privileged MFA required" && (
            <p>
              <Link href="/mfa" style={{ textDecoration: "underline" }}>
                Verify your existing authenticator
              </Link>{" "}
              to continue owner gameplay. Do not set up a new factor.
            </p>
          )}

        <p>
          If you are already signed in, Preview access may be expired or
          temporarily unavailable.
        </p>
      </div>
    );
  }

  const testWallet = process.env.DOCKED_FRIENDS_BETA === "true";

  return (
    <AppShell authenticated>
      <div>
        {testWallet && !["play", "cards", "social"].includes(tab) && (
          <p className="actions">
            <Link href="/fantasy/test-wallet#packs">Packs</Link> ·{" "}
            <Link href="/fantasy/test-wallet">Open test wallet</Link>
          </p>
        )}

        {tab === "play" &&
          (process.env.VERCEL_ENV === "preview" ||
            process.env.NODE_ENV === "development") && (
            <p className="notice">
              <Link
                href={
                  data.state.nfl_beta ? "/fantasy/results" : "/fantasy/scoring"
                }
              >
                {data.state.nfl_beta
                  ? "NFL post-game points, breakdowns and standings"
                  : "Scoring lab: EPL, NFL and AFL · simulated examples and beta rules"}
              </Link>
            </p>
          )}

        {
          <FantasyScreen
            key={`${tab}:${data.state.user_id}`}

            tab={tab}

            initial={data.state}

            packExperience={packExperienceEnabled()}
          />
        }

        {process.env.DOCKED_OWNER_GAMEPLAY === "true" &&
          process.env.DOCKED_FRIENDS_BETA !== "true" && (
            <p className="notice" role="note">
              {data.state.nfl_beta
                ? "Protected NFL beta · real roster cards and post-game scoring. External admission remains closed; EPL unavailable. No payments or prizes."
                : process.env.DOCKED_TWO_PERSON_BETA === "true"
                  ? "Two-person private beta · fictional cards, simulated scoring and sandbox swaps. No real money or live sports results."
                  : "Owner-only QA · fictional football cards and simulated scoring. No real money, live sports results or external members."}
            </p>
          )}
      </div>
    </AppShell>
  );
}
