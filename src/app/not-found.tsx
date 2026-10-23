import Link from "next/link";
import { StartupReady } from "@/components/startup-loading";
export default function NotFound() {
  return (
    <div className="page">
      <StartupReady />
      <p className="eyebrow">404 / PAGE NOT FOUND</p>
      <h1>Nothing published here.</h1>
      <p>
        This page does not exist or is not available under the current access
        rules.
      </p>
      <Link className="button" href="/">
        Back to Docked
      </Link>
    </div>
  );
}
