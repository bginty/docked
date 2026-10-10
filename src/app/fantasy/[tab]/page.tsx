import Link from "next/link";
import { SandboxSwaps } from "@/components/sandbox-swaps";
import { notFound } from "next/navigation";
import { fantasyTagline } from "@/core/fantasy";
import {
  fantasyPlatformEnabled as fantasyEnabled,
  fantasyProductionEnabled,
} from "@/core/fantasy-production";
import { fantasyRequest } from "@/server/fantasy";
import { AppShell } from "@/components/app-shell";
import { FantasyScreen } from "@/components/fantasy-screen";
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
}: {
  params: Promise<{ tab: string }>;
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
  let data;
  try {
    data = await fantasyRequest();
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
            ? "Sign in with a verified account and complete onboarding to collect your free Starter pack."
            : "Sign in with your invited Preview account. Access must be enabled for your account by the Preview operator."}
        </p>
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
  const feed = tab === "social" ? await communityFeed({ tab: "latest" }) : null;
  return (
    <AppShell authenticated>
      <div>
        {tab === "play" &&
          (process.env.VERCEL_ENV === "preview" ||
            process.env.NODE_ENV === "development") && (
            <p className="notice">
              <Link href="/fantasy/scoring">
                Scoring lab: EPL, NFL and AFL · simulated examples and beta
                rules
              </Link>
            </p>
          )}
        {tab === "market" && process.env.DOCKED_TWO_PERSON_BETA === "true" ? (
          <SandboxSwaps />
        ) : (
          <FantasyScreen key={tab} tab={tab} initial={data.state} />
        )}
        {process.env.DOCKED_OWNER_GAMEPLAY === "true" && (
          <p className="notice" role="note">
            {process.env.DOCKED_TWO_PERSON_BETA === "true"
              ? "Two-person private beta · fictional cards, simulated scoring and sandbox swaps. No real money or live sports results."
              : "Owner-only QA · fictional football cards and simulated scoring. No real money, live sports results or external members."}
          </p>
        )}
        {feed && (
          <section className="fantasy-social">
            <div className="actions">
              <Link href="/compose">Write a post</Link>
              <Link href="/following">Following</Link>
              <Link href="/search">Discover</Link>
            </div>
            <FeedContent
              feed={feed}
              base="/fantasy/social"
              tab="latest"
              compact
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
