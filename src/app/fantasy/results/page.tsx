import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { postgameResults } from "@/server/postgame-results";
import { PostgameResults } from "@/components/postgame-results";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Post-game points",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let records;
  try {
    records = await postgameResults();
  } catch {
    return (
      <AppShell authenticated>
        <section className="scoring-review">
          <h1>Post-game points unavailable</h1>
          <p>
            Sign in with your eligible beta account, or try again if the service
            is temporarily unavailable.
          </p>
          <Link href="/app/login">Sign in</Link> ·{" "}
          <Link href="/fantasy/play">Back to Play</Link>
        </section>
      </AppShell>
    );
  }
  return (
    <AppShell authenticated>
      <PostgameResults records={records} />
    </AppShell>
  );
}
