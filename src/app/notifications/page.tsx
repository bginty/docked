import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  AccessGate,
  CommunityEmpty,
} from "@/components/community-basics";
import { NotificationCentre } from "@/components/notification-centre";
import { appViewer } from "@/server/app-view";
import { communityNotifications } from "@/server/community-social";
import { schedulePreviewNotifications } from "@/server/preview-maintenance";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};
export default async function Notifications() {
  const [{ who, configured }, data] = await Promise.all([
    appViewer(),
    communityNotifications(),
  ]);
  if (who && data.status === "ready") await schedulePreviewNotifications(who);
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="YOUR INBOX" title="Stay in the conversation.">
        Account notices and the updates you choose, in one place.
      </AppHeading>
      {!who ? (
        <AccessGate configured={configured} />
      ) : data.status !== "ready" ? (
        <CommunityEmpty title="Notifications unavailable">
          {data.message}
        </CommunityEmpty>
      ) : (
        <NotificationCentre data={data} />
      )}
    </AppShell>
  );
}
