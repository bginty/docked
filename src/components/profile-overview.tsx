"use client";
import Link from "next/link";
import type { FantasyState } from "@/core/fantasy";
import type { PrivateAccountSummary } from "@/core/profile-overview";
import { RarityCounts } from "./rarity-counts";
import { useSport } from "./sport-context";
import { MemberAvatar } from "./member-avatar";
export function ProfileOverview({
  data,
  account,
}: {
  data: FantasyState;
  account?: PrivateAccountSummary;
  onRefresh?: () => void;
}) {
  const { sport } = useSport();
  const displayName =
    data.team_name ||
    account?.displayName ||
    data.members.find((m) => m.id === data.user_id)?.name ||
    "Your profile";
  const cards = data.cards.filter((c) => c.sport === sport);
  const entries = new Set(
    [...data.entries, ...(data.seven?.entries ?? [])]
      .filter((e) =>
        data.competitions.some(
          (c) => c.id === e.competition_id && c.sport === sport,
        ),
      )
      .map((e) => e.competition_id),
  );
  return (
    <div className="profile-overview">
      <header className="profile-overview-header">
        <MemberAvatar
          profile={{
            displayName,
            avatarUrl: account?.avatarUrl ?? null,
            isOfficial: false,
          }}
          size={76}
        />
        <div>
          <h1>{displayName}</h1>
          <p>Your profile · {sport.toUpperCase()}</p>
        </div>
        <div className="profile-header-actions">
          <Link className="pack-control secondary" href="/profile?tab=about">
            Edit profile
          </Link>
          <Link
            className="pack-control primary"
            href={`/fantasy/packs?sport=${sport}`}
          >
            Packs
          </Link>
          <Link className="pack-control secondary" href="/fantasy/test-wallet">
            Test Wallet
          </Link>
        </div>
      </header>
      <section className="fantasy-panel">
        <h2>Collection & record</h2>
        <div className="profile-record-stats">
          <Link href={`/fantasy/cards?sport=${sport}`}>
            <strong>{cards.length}</strong>
            <span>Cards</span>
          </Link>
          <Link href={`/fantasy/results?sport=${sport}`}>
            <strong>{entries.size}</strong>
            <span>Entries</span>
          </Link>
          <Link href={`/fantasy/packs?sport=${sport}&packs=history`}>
            <strong>View history</strong>
            <span>Packs opened</span>
            <small>Account-wide</small>
          </Link>
        </div>
        <RarityCounts cards={cards} sport={sport} />
        <div className="actions">
          <Link
            className="pack-control secondary"
            href={`/fantasy/cards?sport=${sport}`}
          >
            View Collection
          </Link>
          <Link
            className="pack-control secondary"
            href={`/fantasy/results?sport=${sport}`}
          >
            View Rankings
          </Link>
        </div>
      </section>
      <div className="profile-private-panels">
        <section className="fantasy-panel">
          <h2>
            Account details <span className="small-note">Private</span>
          </h2>
          <p className="small-note">Visible only to you</p>
          <dl>
            <dt>Email</dt>
            <dd>{account?.maskedEmail ?? "Email unavailable"}</dd>
            <dt>Email verification</dt>
            <dd>
              {account?.emailVerified === true
                ? "Verified"
                : account?.emailVerified === false
                  ? "Not verified"
                  : "Status unavailable"}
            </dd>
          </dl>
          <Link className="pack-control secondary" href="/dashboard">
            Manage Account
          </Link>
        </section>
        <section className="fantasy-panel">
          <h2>Account shortcuts</h2>
          <nav className="profile-shortcuts" aria-label="Account shortcuts">
            <Link
              className="pack-control secondary"
              href="/profile/withdrawals"
            >
              Withdrawals
            </Link>
            <Link className="pack-control secondary" href="/dashboard">
              Settings & Privacy
            </Link>
            <Link className="pack-control secondary" href="/profile">
              Social Profile
            </Link>
            <span id="profile-install-slot" />
            {account?.staffRole && (
              <Link
                className="pack-control secondary"
                href={
                  account.staffRole === "owner" ? "/admin/operations" : "/admin"
                }
              >
                {account.staffRole === "owner"
                  ? "Owner dashboard"
                  : "Staff dashboard"}
              </Link>
            )}
          </nav>
        </section>
      </div>
    </div>
  );
}
