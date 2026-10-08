import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  AccessGate,
  IntegrityNote,
} from "@/components/community-basics";
import { SocialComposer } from "@/components/social-composer";
import { appViewer } from "@/server/app-view";
import { communityProfile } from "@/server/community-social";
import { previewTesterCapabilities } from "@/server/preview-testers";
import Link from "next/link";
import { sports } from "@/content/sports";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Create a post or Edge",
  robots: { index: false, follow: false },
};
export default async function Compose({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const initialSport = sports.find((s) => s.slug === query.sport)?.slug;
  const { who, configured } = await appViewer();
  const social = who ? await communityProfile() : null;
  const previewCapabilities = who ? await previewTesterCapabilities() : [];
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="CREATE" title="Share a perspective. Own the record.">
        A social post starts a discussion. An Edge becomes a permanent,
        structured pre-event record.
      </AppHeading>
      {who ? (
        social?.status === "ready" && !social.profile ? (
          <section className="app-empty">
            <h2>Create your community identity first.</h2>
            <p>
              Choose a handle and profile visibility before publishing a post or
              permanent Edge.
            </p>
            <Link className="button" href="/profile">
              Create your profile
            </Link>
          </section>
        ) : (
          <SocialComposer
            initialSport={initialSport}
            previewFixtures={previewCapabilities.includes(
              "preview_market_fixtures",
            )}
          />
        )
      ) : (
        <AccessGate configured={configured} />
      )}
      <IntegrityNote />
    </AppShell>
  );
}
