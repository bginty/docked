import Link from "next/link";
import { notFound } from "next/navigation";
import { fantasyEnabled, fantasyTagline } from "@/core/fantasy";
import { fantasyRequest } from "@/server/fantasy";
import { AppShell } from "@/components/app-shell";
import { FantasyScreen } from "@/components/fantasy-screen";
import { communityFeed } from "@/server/community-social";
import { FeedContent } from "@/components/community-feed";
import { fantasyAssets } from "@/brand/fantasy-assets";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Fantasy Cards Preview | COLLECT. BUILD. COMPETE.",
  description: "Fictional player cards, fantasy competitions and test credits.",
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
  if (
    !["play", "cards", "market", "social", "profile", "admin"].includes(tab) ||
    !fantasyEnabled()
  )
    notFound();
  let data;
  try {
    data = await fantasyRequest();
  } catch {
    return (
      <div className="fantasy-gate">
        <h1>Fantasy Cards Preview</h1>
        <p>{fantasyTagline}</p>
        <p>
          Sign in with your invited Preview account. Access must be enabled for
          your account by the Preview operator.
        </p>
        <Link className="button" href="/app/login">
          Sign in
        </Link>
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
        <FantasyScreen key={tab} tab={tab} initial={data.state} />
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
