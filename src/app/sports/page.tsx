import Link from "next/link";
import { sports } from "@/content/sports";
import { AppAuthShell } from "@/components/app-auth-shell";
export const metadata = { title: "Sports" };
export default function Sports() {
  return (
    <AppAuthShell>
      <h1>Choose your sport</h1>
      <p>
        Football fantasy cards are implemented in Preview. Other sports
        currently support community discussion only.
      </p>
      <nav aria-label="Sports">
        {sports.map((s) => (
          <p key={s.slug}>
            <Link href={"/sports/" + s.slug}>{s.title}</Link>
          </p>
        ))}
      </nav>
      <Link href="/app/onboarding">Save sport preferences</Link>
    </AppAuthShell>
  );
}
