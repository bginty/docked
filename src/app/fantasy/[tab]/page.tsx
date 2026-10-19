import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { StartupReady } from "@/components/startup-loading";
import Link from "next/link";
import { SocialHome } from "@/components/social-home";
import { z } from "zod";
import { boundedRead } from "@/core/bounded-request";

import { Marketplace } from "@/components/marketplace";
import { requireIdentity } from "@/server/auth";
import {
  privateAccountSummary,
  type PrivateAccountSummary,
} from "@/core/profile-overview";
import "../../marketplace.css";

import { notFound } from "next/navigation";

import { fantasyTagline } from "@/core/fantasy";

import { fantasyPlatformEnabled as fantasyEnabled } from "@/core/fantasy-production";

import { fantasyRequest } from "@/server/fantasy";

import { AppShell } from "@/components/app-shell";

import { FantasyScreen } from "@/components/fantasy-screen";

import { packExperienceEnabled } from "@/core/pack-experience";

import { communityFeed, ownProfileIdentity } from "@/server/community-social";

import { fantasyAssets } from "@/brand/fantasy-assets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Fantasy Cards | ${fantasyTagline}`,

  description: "Collect player cards and build your fantasy team.",

  robots: { index: false, follow: false },

  openGraph: {
    title: `Docked | ${fantasyTagline}`,

    description: "Fantasy Cards Preview",

    images: [fantasyAssets.social],
  },

  twitter: {
    title: `Docked | ${fantasyTagline}`,

    images: [fantasyAssets.social],
  },
};

export default async function FantasyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{
    tab?: string;
    sport?: string;
    cursor?: string;
    community?: string;
    player?: string;
  }>;
}) {
  const { tab } = await params;

  if (!["play", "cards", "market", "social", "profile", "admin"].includes(tab))
    notFound();

  if (!fantasyEnabled())
    return (
      <div className="fantasy-gate">
        <StartupReady />
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
    } catch (error) {
      const kind = memberAccessFailure(error);
      return (
        <FantasyLoadError
          authRequired={kind === "authentication"}
          mfaRequired={kind === "mfa"}
          permissionDenied={kind === "permission"}
        />
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
          <StartupReady />
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
          communityId: z.string().uuid().safeParse(query.community).success
            ? query.community
            : undefined,
          playerId: query.player?.slice(0, 150),
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
        <SocialHome
          feed={feed}
          tab={feedTab}
          view={
            query.tab === "communities" || query.tab === "discover"
              ? query.tab
              : undefined
          }
          communityId={
            z.string().uuid().safeParse(query.community).success
              ? query.community
              : undefined
          }
          playerId={query.player?.slice(0, 150)}
          sport={query.sport}
        />
      </AppShell>
    );
  }
  let data;

  try {
    data = await boundedRead(fantasyRequest());
  } catch (error) {
    const kind = memberAccessFailure(error);
    // This former catch-all conflated timeout/service errors with expired auth.
    // Do not log request data or claim the historical error had a known cause.
    console.error("fantasy_screen_unavailable", {
      kind,
      screen: tab,
    });
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }

  const testWallet = process.env.DOCKED_FRIENDS_BETA === "true";
  let account: PrivateAccountSummary | undefined;
  if (tab === "profile") {
    try {
      const owner = await boundedRead(requireIdentity());
      if (owner.user.id === data.state.user_id) {
        account = privateAccountSummary(owner.user);
        try {
          account = {
            ...account,
            ...(await boundedRead(ownProfileIdentity())),
          };
        } catch {
          /* Initial fallback remains available. */
        }
      }
    } catch {
      /* Keep unknown status explicit; no guessed verification or email. */
    }
  }

  return (
    <AppShell authenticated>
      <div>
        {testWallet &&
          !["play", "cards", "social", "profile"].includes(tab) && (
            <p className="actions">
              <Link href="/fantasy/test-wallet?view=packs#packs">Packs</Link> ·{" "}
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
                  ? "NFL points, breakdowns and rankings"
                  : "Scoring lab: EPL, NFL and AFL · simulated examples and beta rules"}
              </Link>
            </p>
          )}

        {
          <FantasyScreen
            key={`${tab}:${data.state.user_id}`}

            tab={tab}

            initial={data.state}
            account={account}

            packExperience={packExperienceEnabled()}
          />
        }

        {process.env.DOCKED_OWNER_GAMEPLAY === "true" &&
          process.env.DOCKED_FRIENDS_BETA !== "true" && (
            <p className="notice" role="note">
              {data.state.nfl_beta
                ? "Protected NFL beta · real roster cards and post-game scoring. External admission remains closed; EPL unavailable. No payments or prizes."
                : process.env.DOCKED_TWO_PERSON_BETA === "true"
                  ? "Private beta · fictional cards and simulated scoring. No real money or live sports results."
                  : "Owner-only QA · fictional football cards and simulated scoring. No real money, live sports results or external members."}
            </p>
          )}
      </div>
    </AppShell>
  );
}
