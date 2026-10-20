"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { AppIcon, type AppIconName } from "./app-icon";
import { SportSelector, SportScope } from "./sport-context";
import { PwaStatus } from "./pwa-status";
import { WorkspaceWalletProvider } from "./use-workspace-wallet";
import { WorkspaceWalletLink } from "./workspace-wallet-link";
import { FantasyLogo } from "./fantasy-brand";
import { StartupReady } from "./startup-loading";
import { WorkspacePageTitle } from "./workspace-page-title";
import { useEnvironmentPresentation } from "./environment-context";
const nav: { href: string; label: string; icon: AppIconName }[] = [
  { href: "/fantasy/play", label: "Play", icon: "trophy" },
  { href: "/fantasy/cards", label: "Cards", icon: "feed" },
  { href: "/fantasy/market", label: "Market", icon: "points" },
  { href: "/fantasy/social", label: "Social", icon: "community" },
  { href: "/fantasy/profile", label: "Profile", icon: "profile" },
];
const ShellContext = createContext(false);
/** Shared fantasy layout retains navigation and the wallet provider between routes. */
export function PersistentAppShell({ children }: { children: ReactNode }) {
  return (
    <AppShell authenticated loading>
      <ShellContext.Provider value={true}>{children}</ShellContext.Provider>
    </AppShell>
  );
}
export function appDestination(path: string) {
  if (/^\/fantasy\/test-wallet(\/|$)/.test(path)) return "/fantasy/cards";
  if (/^\/fantasy\/(play|cards|market|social|profile)(\/|$)/.test(path))
    return path.split("/").slice(0, 3).join("/");
  if (/^\/(feed|following|community|compose|search)(\/|$)/.test(path))
    return "/fantasy/social";
  if (/^\/(profile|dashboard|notifications|admin)(\/|$)/.test(path))
    return "/fantasy/profile";
  return "/fantasy/play";
}

function useEditingViewport(authenticated: boolean) {
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = shell.current;
    const viewport = window.visualViewport;
    if (!authenticated || !node || !viewport) return;
    let baseline = viewport.height;
    let width = viewport.width;
    let frame = 0;
    const update = () => {
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLInputElement &&
            ![
              "button",
              "checkbox",
              "radio",
              "submit",
              "reset",
              "range",
              "file",
              "hidden",
              "color",
            ].includes(active.type)));
      // A focus alone (including a hardware keyboard) must not hide navigation.
      // Remember the unoccluded viewport because Android adjustResize can also
      // shrink innerHeight; ignore pinch zoom and browser-toolbar sized changes.
      if (Math.abs(viewport.width - width) > 40) {
        baseline = viewport.height;
        width = viewport.width;
      } else if (!editing || viewport.height > baseline) {
        baseline = Math.max(baseline, viewport.height);
      }
      const open =
        editing &&
        Math.abs(viewport.scale - 1) < 0.05 &&
        baseline - viewport.height > Math.max(120, baseline * 0.18);
      node.dataset.keyboardOpen = String(open);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      delete node.dataset.keyboardOpen;
    };
  }, [authenticated]);
  return shell;
}
export function AppShell({
  children,
  authenticated = false,
  loading = false,
}: {
  children: ReactNode;
  authenticated?: boolean;
  loading?: boolean;
}) {
  const path = usePathname();
  const { production, liveBeta } = useEnvironmentPresentation();
  const activeNav = nav;
  const destination = appDestination(path);
  const shell = useEditingViewport(authenticated);
  const inherited = useContext(ShellContext);
  if (inherited)
    return (
      <>
        {!loading && <StartupReady />}
        {children}
      </>
    );
  if (!authenticated)
    return (
      <div className="community-public">
        {!loading && <StartupReady />}
        {children}
      </div>
    );
  return (
    <WorkspaceWalletProvider>
      {!loading && <StartupReady />}
      <div
        ref={shell}
        className="community-shell"
        data-authenticated="true"
        data-workspace={destination.split("/").at(-1)}
      >
        <aside className="app-sidebar">
          <Link className="brand" href="/fantasy/play" aria-label="Docked home">
            <FantasyLogo />
          </Link>

          <SportSelector />
          <nav aria-label="App navigation">
            {activeNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={destination === n.href ? "page" : undefined}
              >
                <AppIcon name={n.icon} />
                {n.label}
              </Link>
            ))}
          </nav>
          <details className="app-secondary">
            <summary>More & settings</summary>
            <Link href="/compose">
              <AppIcon name="plus" /> Create a post
            </Link>
            <Link href="/search">
              <AppIcon name="search" /> Search Docked
            </Link>

            <Link href="/dashboard">Settings & privacy</Link>

            <Link href="/">Public site</Link>
          </details>
          <Link className="sidebar-account" href="/fantasy/profile">
            <AppIcon name="profile" />
            Your account <span aria-hidden="true">→</span>
          </Link>
          <p className="small-note">
            18+ · Fantasy Cards
            <br />
            Free play. No cash value.
          </p>
        </aside>
        <div className="app-workspace">
          <header className="app-topbar">
            <div className="app-brand-lockup">
              <Link
                className="brand"
                href="/fantasy/play"
                aria-label="Docked home"
              >
                <FantasyLogo />
              </Link>
              {(liveBeta || !production) && (
                <span className="app-preview-label">
                  {liveBeta ? "BETA" : "PREVIEW"}
                </span>
              )}
            </div>
            <strong className="workspace-location">
              {path.startsWith("/admin/operations") ? (
                "Owner operations"
              ) : path.startsWith("/admin") ? (
                "Staff operations"
              ) : path.startsWith("/fantasy/prizes") ? (
                "Prizes"
              ) : (
                <Suspense
                  fallback={nav.find((n) => n.href === destination)?.label}
                >
                  <WorkspacePageTitle
                    fallback={
                      nav.find((n) => n.href === destination)?.label ?? "Docked"
                    }
                  />
                </Suspense>
              )}
            </strong>
            <nav aria-label="App utilities">
              <span id="workspace-wallet-slot">
                <WorkspaceWalletLink />
              </span>
              <Link
                className="app-desktop-search"
                href="/search"
                aria-label="Search Docked"
              >
                <AppIcon name="search" />
              </Link>
              <Link href="/notifications" aria-label="Notifications">
                <AppIcon name="bell" />
              </Link>
              <Link href="/dashboard" aria-label="Settings">
                <AppIcon name="settings" />
              </Link>
            </nav>
          </header>
          <div className="shell-mobile-sport">
            <SportSelector mobile />
          </div>
          <PwaStatus allowInstall={destination === "/fantasy/profile"} />
          <div className="app-content">
            {["/fantasy/play", "/fantasy/cards", "/fantasy/market"].includes(
              destination,
            ) ? (
              <SportScope>{children}</SportScope>
            ) : (
              children
            )}
          </div>
          <p className="app-footnote">
            Invited test beta · No cash value. Competition rules apply.
          </p>
        </div>
        <nav className="app-bottom-nav" aria-label="Mobile app navigation">
          {activeNav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={destination === n.href ? "page" : undefined}
            >
              <AppIcon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </WorkspaceWalletProvider>
  );
}
