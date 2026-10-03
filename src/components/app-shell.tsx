"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "./app-icon";
import { PwaStatus } from "./pwa-status";
const nav: { href: string; label: string; icon: AppIconName }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/edges", label: "Edges", icon: "edge" },
  { href: "/compose", label: "Post", icon: "plus" },
  { href: "/community", label: "Community", icon: "community" },
  { href: "/profile", label: "Profile", icon: "profile" },
];
export function AppShell({
  children,
  authenticated = false,
}: {
  children: ReactNode;
  authenticated?: boolean;
}) {
  const path = usePathname();
  if (!authenticated) return <div className="community-public">{children}</div>;
  return (
    <div className="community-shell" data-authenticated="true">
      <aside className="app-sidebar">
        <Link className="brand" href="/home">
          DOCKED.
        </Link>
        <p className="eyebrow">SPORT. PRICE. COMMUNITY.</p>
        <nav aria-label="App navigation">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={
                path === n.href || path.startsWith(n.href + "/")
                  ? "page"
                  : undefined
              }
            >
              <AppIcon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="app-secondary">
          <Link href="/top-docked">
            <AppIcon name="trophy" />
            Top Docked
          </Link>
          <Link href="/membership">Membership</Link>
          <Link href="/dashboard">Settings & privacy</Link>
          <Link href="/results">Official results</Link>
          <Link href="/">Public site</Link>
        </div>
        <p className="small-note">
          18+ · Research preview
          <br />
          No guaranteed returns.
        </p>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <Link className="brand" href="/home">
            DOCKED.
          </Link>
          <span className="app-preview-label">PREVIEW · FREE FIRST</span>
          <nav aria-label="App utilities">
            <Link href="/search" aria-label="Search Docked">
              <AppIcon name="search" />
            </Link>
            <Link href="/notifications" aria-label="Notifications">
              <AppIcon name="bell" />
            </Link>
          </nav>
        </header>
        <PwaStatus />
        <div className="app-content">{children}</div>
        <p className="app-footnote">
          Informational sports community. You can use Docked without betting.
          Past performance does not guarantee future results.
        </p>
      </div>
      <nav className="app-bottom-nav" aria-label="Mobile app navigation">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={n.icon === "plus" ? "app-compose-link" : undefined}
            aria-current={
              path === n.href || path.startsWith(n.href + "/")
                ? "page"
                : undefined
            }
          >
            <AppIcon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
