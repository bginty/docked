import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  AccessGate,
  IntegrityNote,
} from "@/components/community-basics";
import { SocialComposer } from "@/components/social-composer";
import { appViewer } from "@/server/app-view";
import { communityProfile } from "@/server/community-social";
import Link from "next/link";
import { sports } from "@/content/sports";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Create a post",
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
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="CREATE" title="Share your fantasy sport.">
        Talk cards, teams and sport with the community.
      </AppHeading>
      {who ? (
        social?.status === "ready" && !social.profile ? (
          <section className="app-empty">
            <h2>Create your community identity first.</h2>
            <p>
              Choose a handle and profile visibility before publishing a post.
            </p>
            <Link className="button" href="/profile">
              Create your profile
            </Link>
          </section>
        ) : (
          <SocialComposer initialSport={initialSport} />
        )
      ) : (
        <AccessGate configured={configured} />
      )}
      <IntegrityNote />
    </AppShell>
  );
}
