// Isolated React fixture adapters, not application auth or navigation overrides.
import type { AnchorHTMLAttributes } from "react";
export function usePathname() {
  return (window as unknown as { demoPath: string }).demoPath || "/home";
}
const fixtureRouter = {
  push: (url: string) => {
    Object.assign(window, { demoNavigation: url });
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
