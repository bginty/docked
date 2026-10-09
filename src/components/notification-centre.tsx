"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type {
  CommunityNotifications,
  NotificationPreferences,
} from "@/core/community-social";
import { communityAction } from "./social-interactions";
import { CommunityEmpty } from "./community-basics";
import { LocalTimestamp } from "./local-timestamp";
const preferences: [keyof NotificationPreferences, string][] = [
  ["followedMembers", "Followed member posts"],
  ["social", "Comments, replies, reactions and followers"],
  ["inApp", "Receive optional in-app notifications"],
];
export function NotificationCentre({ data }: { data: CommunityNotifications }) {
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function mark(id?: string) {
    setBusy(true);
    try {
      await communityAction({ action: "read", id }, "/api/notifications");
      setMessage(
        id ? "Notification marked read." : "Notifications marked read.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Read status not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      action: "preferences",
      officialEdges: false,
      researchUpdates: false,
      lineupUpdates: false,
      teamUpdates: false,
      leaderboard: false,
      competitions: false,
      dealsMarketing: false,
      email: false,
      push: false,
    };
    for (const [key] of preferences) body[key] = d.get(key) === "on";
    setBusy(true);
    try {
      await communityAction(body, "/api/notifications");
      setMessage(
        "In-app preferences saved. No external email or push is enabled.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preferences not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  const groups = [...new Set(data.items.map((n) => n.groupKey))];
  return (
    <>
      <div className="section-row">
        <h2>{data.unread} unread</h2>
        {data.unread > 0 && (
          <button
            className="button ghost small"
            disabled={busy}
            onClick={() => mark()}
          >
            Mark all read
          </button>
        )}
      </div>
      {data.items.length ? (
        groups.map((group) => (
          <section key={group}>
            <h2 className="notification-group-title">
              {group.replaceAll("_", " ")}
            </h2>
            <ul className="notification-list">
              {data.items
                .filter((n) => n.groupKey === group)
                .map((n) => (
                  <li
                    key={n.id}
                    className="notification-item"
                    data-unread={!n.readAt}
                  >
                    <h2>
                      <Link href={n.href}>{n.title}</Link>
                    </h2>
                    <p className="small-note">
                      {n.type.replaceAll("_", " ")} ·{" "}
                      {n.readAt ? "Read" : "Unread"}
                    </p>
                    <LocalTimestamp value={n.createdAt} />
                    {!n.readAt && (
                      <div>
                        <button
                          className="button ghost small"
                          disabled={busy}
                          onClick={() => mark(n.id)}
                        >
                          Mark read
                        </button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      ) : (
        <CommunityEmpty title="You’re all caught up">
          No notifications are available. Activity is never invented to fill
          your inbox.
        </CommunityEmpty>
      )}
      <p role="status" className="form-message">
        {message}
      </p>
      <section className="app-panel" id="preferences">
        <h2>Choose what reaches you.</h2>
        <form className="app-form" method="post" onSubmit={save}>
          {preferences.map(([key, label]) => (
            <label className="check" key={key}>
              <input
                name={key}
                type="checkbox"
                defaultChecked={data.preferences?.[key] ?? false}
              />
              <span>{label}</span>
            </label>
          ))}
          <label className="check">
            <input type="checkbox" disabled />
            <span>Email · unavailable in this preview</span>
          </label>
          <label className="check">
            <input type="checkbox" disabled />
            <span>Push · unavailable in this preview</span>
          </label>
          <p className="form-help">
            Optional categories are separate from essential account/system
            notices. Existing consent, quiet hours and caps still apply.
            Competition and deal notifications cannot be delivered while those
            features are disabled. Research choices are stored separately and do
            not enable delivery or create team follows. No loss-triggered or
            chasing messages.
          </p>
          <button className="button" disabled={busy}>
            Save notification preferences
          </button>
        </form>
      </section>
    </>
  );
}
