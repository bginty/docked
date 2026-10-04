"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AppIcon, type AppIconName } from "./app-icon";
import { PwaStatus } from "./pwa-status";
import { BrandLogo } from "./brand-logo";
import { brand } from "@/brand/brand";
import { useEnvironmentPresentation } from "./environment-context";
const nav: { href: string; label: string; icon: AppIconName }[] = [
  { href: "/edges", label: "Edges", icon: "edge" },
  { href: "/feed", label: "Feed", icon: "feed" },
  { href: "/following", label: "Following", icon: "community" },
  { href: "/points", label: "Points", icon: "points" },
  { href: "/my-edge", label: "My Edge", icon: "profile" },
];

/** Legacy and detail routes keep their parent destination selected. */
export function appDestination(path: string) {
  if (/^\/(points|top-docked)(\/|$)/.test(path)) return "/points";
  if (/^\/(following|search)(\/|$)/.test(path)) return "/following";
  if (/^\/community\/edges(\/|$)/.test(path)) return "/edges";
  if (
    /^\/(feed|community|compose)(\/|$)/.test(path) ||
    path.startsWith("/research/matches/")
  )
    return "/feed";
  if (
    /^\/(profile|my-edge|dashboard|notifications|membership)(\/|$)/.test(path)
  )
    return "/my-edge";
  return "/edges";
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
}: {
  children: ReactNode;
  authenticated?: boolean;
}) {
  const path = usePathname();
  const { production } = useEnvironmentPresentation();
  const destination = appDestination(path);
  const shell = useEditingViewport(authenticated);
  if (!authenticated) return <div className="community-public">{children}</div>;
  return (
    <div ref={shell} className="community-shell" data-authenticated="true">
      <aside className="app-sidebar">
        <Link className="brand" href="/edges" aria-label="Docked Edges">
          <BrandLogo surface="dark" decorative />
        </Link>
        <p className="eyebrow">{brand.tagline}</p>
        <nav aria-label="App navigation">
          {nav.map((n) => (
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
        <div className="app-secondary">
          <Link href="/compose">
            <AppIcon name="plus" /> Create a post
          </Link>
          <Link href="/search">
            <AppIcon name="search" /> Search Docked
          </Link>
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
          18+ · {production ? "Sports research" : "Research preview"}
          <br />
          No guaranteed returns.
        </p>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-brand-lockup">
            <Link className="brand" href="/edges" aria-label="Docked Edges">
              <BrandLogo surface="dark" decorative />
            </Link>
            {!production && <span className="app-preview-label">PREVIEW</span>}
          </div>
          <nav aria-label="App utilities">
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
            aria-current={destination === n.href ? "page" : undefined}
          >
            <AppIcon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
