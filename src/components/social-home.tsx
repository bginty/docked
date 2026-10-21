import { memberAnnouncements } from "@/server/member-announcements";
import { SocialHomeContent } from "./social-home-content";
export async function SocialHome(
  props: Omit<Parameters<typeof SocialHomeContent>[0], "announcements">,
) {
  const announcements = props.feed.viewer
    ? await memberAnnouncements().catch(() => null)
    : [];
  return <SocialHomeContent {...props} announcements={announcements} />;
}
