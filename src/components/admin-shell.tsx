"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { fantasyAssets } from "@/brand/fantasy-assets";
import {
  adminNavigation,
  adminHref,
  canAccessAdminSection,
  type AdminSection,
} from "@/core/admin-navigation";
import { AdminGlobalSearch } from "./admin-global-search";
import { AdminIcon } from "./admin-icon";

export function AdminShell({
  role,
  displayName,
  active = "dashboard",
  moderationCount = 0,
  unreadCount,
  build,
  children,
}: {
  role: string;
  displayName: string;
  active?: AdminSection;
  moderationCount?: number;
  unreadCount?: number | null;
  build?: string;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape" && menu) {
        setMenu(false);
        toggle.current?.focus();
      }
    }
    function back() {
      setMenu(false);
    }
    document.addEventListener("keydown", close);
    window.addEventListener("popstate", back);
    return () => {
      document.removeEventListener("keydown", close);
      window.removeEventListener("popstate", back);
    };
  }, [menu]);
  return (
    <div className="admin-reference">
      <a className="admin-skip" href="#admin-main">
        Skip to dashboard content
      </a>
      <aside
        className={`admin-sidebar ${menu ? "is-open" : ""}`}
        id="admin-navigation"
      >
        <Link className="admin-brand" href={adminHref("dashboard", role)}>
          <img src={fantasyAssets.splash} alt="Docked" />
          <span>PLAY. COLLECT. COMPETE.</span>
        </Link>
        <nav aria-label="Administration">
          {adminNavigation
            .filter((item) => canAccessAdminSection(role, item.id))
            .map((item) => (
              <Link
                key={item.id}
                href={adminHref(item.id, role)}
                aria-current={active === item.id ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
                {item.id === "moderation" && moderationCount > 0 && (
                  <b className="admin-badge">{moderationCount}</b>
                )}
              </Link>
            ))}
          {role === "owner" && (
            <Link href="/admin/ingestion" onClick={() => setMenu(false)}>
              <AdminIcon name="chart" />
              <span>Statistics ingestion</span>
            </Link>
          )}
        </nav>
        <div className="admin-sidebar-art">
          <img src="/brand/docked/admin/sidebar-football.webp" alt="" />
          <strong>
            MORE
            <br />
            THAN CARDS.
            <br />
            <em>A BIGGER GAME.</em>
          </strong>
          <small>{build ? `${build} | ` : ""}Admin Portal</small>
        </div>
      </aside>
      <header className="admin-topbar">
        <button
          className="admin-menu-toggle"
          ref={toggle}
          aria-label={
            menu
              ? "Close administration navigation"
              : "Open administration navigation"
          }
          aria-expanded={menu}
          aria-controls="admin-navigation"
          onClick={() => setMenu(!menu)}
        >
          ☰
        </button>
        <AdminGlobalSearch />
        <div className="admin-account">
          <Link
            href="/notifications"
            className="admin-notifications"
            aria-label={
              unreadCount
                ? `${unreadCount} unread notifications`
                : "Notifications"
            }
          >
            <AdminIcon name="bell" />
            {!!unreadCount && <b className="admin-badge">{unreadCount}</b>}
          </Link>
          <details>
            <summary>
              <span className="admin-avatar">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
              <span className="admin-account-name">
                {displayName}
                <small>{role === "owner" ? "Founder" : role}</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <nav aria-label="Account">
              <Link href="/fantasy/profile">My profile</Link>
              <Link href="/dashboard">Manage account</Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="admin-main" className="admin-main">
        {children}
      </main>
    </div>
  );
}
