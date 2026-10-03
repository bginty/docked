import { notFound } from "next/navigation";
import { z } from "zod";
import { communityPost } from "@/server/community-social";
import { appViewer } from "@/server/app-view";
import { AppShell } from "@/components/app-shell";
import { AppHeading, CommunityEmpty } from "@/components/community-basics";
import { SocialCard } from "@/components/social-interactions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community discussion",
  robots: { index: false, follow: false },
};
export default async function Post({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [{ who }, data] = await Promise.all([appViewer(), communityPost(id)]);
  return (
    <AppShell authenticated={!!who}>
      <AppHeading
        eyebrow="COMMUNITY DISCUSSION"
        title="A perspective, in context."
      />
      {data.posts[0] ? (
        <SocialCard post={data.posts[0]} />
      ) : (
        <CommunityEmpty title="Discussion unavailable">
          {data.message ||
            "This discussion is not visible under your account, region or content permissions. Any underlying verified Edge remains in the permanent ledger."}
        </CommunityEmpty>
      )}
    </AppShell>
  );
}
