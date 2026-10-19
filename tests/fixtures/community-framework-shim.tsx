// Isolated React fixture adapters, not application auth or navigation overrides.
import type { AnchorHTMLAttributes } from "react";
import { useEffect, useState } from "react";
export function useSearchParams() {
  const [query, setQuery] = useState(location.search);
  useEffect(() => {
    const read = () => setQuery(location.search);
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  return new URLSearchParams(query);
}
export function usePathname() {
  return (window as unknown as { demoPath: string }).demoPath || "/home";
}
const fixtureRouter = {
  push: (url: string) => {
    Object.assign(window, { demoNavigation: url });
    (
      window as unknown as { fixtureNavigate?: (url: string) => void }
    ).fixtureNavigate?.(url);
  },
  refresh: () => {},
  replace: (url: string) => {
    Object.assign(window, { demoNavigation: url });
  },
  back: () => {},
  forward: () => {},
  prefetch: () => Promise.resolve(),
};
export function useRouter() {
  return fixtureRouter;
}
export default function Link({
  prefetch: _prefetch,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  return <a {...props} />;
}
