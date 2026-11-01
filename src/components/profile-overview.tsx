"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import { packShopHref } from "@/core/pack-presentation";
import type { CollectionRecord } from "@/core/profile-overview";
import { SportNavigation } from "./sport-navigation";
import { NavigationShortcut } from "./navigation-shortcut";
import { LightSweep } from "./startup-loading";
import type { FantasyState } from "@/core/fantasy";
import type { PrivateAccountSummary } from "@/core/profile-overview";
import { RarityCounts } from "./rarity-counts";
import { useSport } from "./sport-context";
import { MemberAvatar } from "./member-avatar";
import { useEnvironmentPresentation } from "./environment-context";
export function ProfileOverview({
  data,
  account,
}: {
  data: Pick<FantasyState, "user_id" | "team_name" | "members">;
  account?: PrivateAccountSummary;
  onRefresh?: () => void;
}) {
  const { sport } = useSport();
  const { commercialSurface, publicCustomer } = useEnvironmentPresentation();
  const displayName =
    data.team_name ||
    account?.displayName ||
    data.members.find((m) => m.id === data.user_id)?.name ||
    "Your profile";
  const [record, setRecord] = useState<CollectionRecord | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const summary =
    record?.member === data.user_id && record.sport === sport ? record : null;
  useEffect(() => {
    const c = new AbortController();
    setRecord(null);
    setError("");
    void boundedFetch(`/api/profile/collection-record?sport=${sport}`, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok || value.member !== data.user_id || value.sport !== sport)
          throw Error(
            "Your collection summary could not be loaded. Please retry.",
          );
        if (!c.signal.aborted) setRecord(value);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            "Your collection summary could not be loaded. Please retry.",
          );
      });
    return () => c.abort();
  }, [sport, data.user_id, attempt]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setAttempt((n) => n + 1);
    };
    const events = [
      "docked-app-resume",
      "docked-market-changed",
      "docked:offers-updated",
      "focus",
      "online",
    ];
    events.forEach((e) => window.addEventListener(e, refresh));
    document.addEventListener("visibilitychange", refresh);
    return () => {
      events.forEach((e) => window.removeEventListener(e, refresh));
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
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
          <Link className="pack-control primary" href={packShopHref(sport)}>
            Packs
          </Link>
          <Link className="pack-control secondary" href="/fantasy/test-wallet">
            {commercialSurface || publicCustomer ? "Wallet" : "Test Wallet"}
          </Link>
        </div>
      </header>
      <section className="fantasy-panel">
        <h2>Collection & record</h2>
        <SportNavigation />
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </div>
        ) : !summary ? (
          <LightSweep compact label="Loading your collection summary…" />
        ) : (
          <>
            <div className="profile-record-stats">
              <Link href={`/fantasy/cards?sport=${sport}`}>
                <strong>{summary.total.toLocaleString()}</strong>
                <span>Cards</span>
              </Link>
              <Link href={`/fantasy/results?sport=${sport}`}>
                <strong>{summary.entries.toLocaleString()}</strong>
                <span>Entries</span>
              </Link>
              <Link href={packShopHref(sport, "history")}>
                <strong>{summary.opened.toLocaleString()}</strong>
                <span>Packs opened</span>
              </Link>
            </div>
            <RarityCounts counts={summary.counts} sport={sport} />
          </>
        )}
        <div className="actions">
          <NavigationShortcut compact href={`/fantasy/cards?sport=${sport}`}>
            View Collection
          </NavigationShortcut>
          <NavigationShortcut
            compact
            icon="edge"
            href={`/fantasy/results?sport=${sport}`}
          >
            View Rankings
          </NavigationShortcut>
          <NavigationShortcut compact href={packShopHref(sport, "history")}>
            {sport.toUpperCase()} Pack History
          </NavigationShortcut>
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
          <NavigationShortcut compact icon="settings" href="/dashboard">
            Manage Account
          </NavigationShortcut>
        </section>
        <section className="fantasy-panel">
          <h2>Account shortcuts</h2>
          <nav className="profile-shortcuts" aria-label="Account shortcuts">
            <NavigationShortcut compact icon="feed" href="/profile/withdrawals">
              Withdrawals
            </NavigationShortcut>
            <NavigationShortcut compact icon="settings" href="/dashboard">
              Settings & Privacy
            </NavigationShortcut>
            <NavigationShortcut compact icon="profile" href="/profile">
              Social Profile
            </NavigationShortcut>
            <span id="profile-install-slot" />
            {account?.staffRole && (
              <NavigationShortcut
                compact
                icon="shield"
                href={
                  account.staffRole === "owner" ? "/admin/operations" : "/admin"
                }
              >
                {account.staffRole === "owner"
                  ? "Owner dashboard"
                  : "Staff dashboard"}
              </NavigationShortcut>
            )}
          </nav>
        </section>
      </div>
      <section className="fantasy-panel profile-support">
        <NavigationShortcut compact href="/profile/identity-verification">
          Identity verification
        </NavigationShortcut>
        <h2>Support & feedback</h2>
        <p>
          Have a question, spotted an issue or have an idea for Docked? We’d
          love to hear from you.
        </p>
        <p>support@docked.com.au</p>
        <div className="actions">
          <NavigationShortcut compact href="mailto:support@docked.com.au">
            Email support
          </NavigationShortcut>
          <button
            type="button"
            className="pack-control secondary"
            onClick={async () => {
              setCopyStatus("");
              try {
                await navigator.clipboard.writeText("support@docked.com.au");
                setCopyStatus("Email address copied.");
              } catch {
                setCopyStatus(
                  "Could not copy. Select and copy support@docked.com.au above.",
                );
              }
            }}
          >
            Copy email
          </button>
        </div>
        <p role="status" aria-live="polite">
          {copyStatus}
        </p>
      </section>
    </div>
  );
}
